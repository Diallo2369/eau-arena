"""Prépare les données du site à partir des fichiers officiels du contrôle sanitaire.

Entrées : data/raw/dis-AAAA.zip (année en cours et précédente), liste officielle des communes
(paquet npm @etalab/decoupage-administratif).

Sorties :
  data/build/site.json        tout ce dont la construction a besoin (pages, classement)
  public/data/index.json      index léger chargé par le navigateur (recherche, classement)
  public/data/dep/<dep>.json  détail des communes d'un département, chargé à la demande

Règles (voir aussi la page « À propos ») :
  - unité de calcul : l'unité de distribution (UDI), la portion de réseau où l'eau est homogène ;
  - période : les 15 derniers mois disponibles ; pour chaque critère, la valeur la plus haute ;
  - une commune desservie par plusieurs UDI prend le résultat de son réseau principal,
    celui qui a le plus de prélèvements (la fréquence des contrôles suit le volume d'eau distribué),
    et la page liste les autres secteurs ;
  - note : 10 points, retirés selon la part de la limite atteinte ; E = une limite dépassée.
"""
import csv, datetime as dt, io, json, os, re, statistics, sys, unicodedata, zipfile
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from ars import Repair, active, conforming, groups  # avis officiel de l'ARS (peut-on la boire ?)

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw")
BUILD = os.path.join(ROOT, "data", "build")
PUBLIC = os.path.join(ROOT, "public", "data")
COMMUNES = os.path.join(ROOT, "node_modules", "@etalab", "decoupage-administratif", "data", "communes.json")
DEPTS = os.path.join(ROOT, "node_modules", "@etalab", "decoupage-administratif", "data", "departements.json")

MONTHS = 15
LIMITS = {"no3": 50.0, "pe": 0.5, "pf": 0.1, "pb": 10.0}
BACT = {"ECOLI", "STRF", "ECO_NPP", "STRL", "ECOL_MP"}
CODES = BACT | {"NO3", "PESTOT", "SPFAS", "TH", "PB", "471811R", "TFA"}


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def years():
    ys = sorted(int(f[4:8]) for f in os.listdir(RAW) if re.fullmatch(r"dis-\d{4}\.zip", f))
    if not ys:
        sys.exit("Aucun fichier dans data/raw : lancez d'abord npm run data:fetch")
    return ys[-2:]


def open_member(year, kind):
    z = zipfile.ZipFile(os.path.join(RAW, f"dis-{year}.zip"))
    name = next(n for n in z.namelist() if kind in n.upper())
    return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8"))


def penalty(ratio):
    """Points retirés selon la part de la limite atteinte (ratio = valeur / limite)."""
    if ratio is None:
        return 0
    if ratio > 1:
        return 6
    if ratio >= 0.8:
        return 3
    if ratio >= 0.5:
        return 1.5
    if ratio >= 0.1:
        return 0.5
    return 0


def grade(u):
    """Note d'une UDI. Renvoie (lettre, points) ; lettre None si les analyses manquent."""
    if u["n"] == 0 or u.get("no3") is None:
        return None, None
    s = 10 - 2 * u["b"]
    over = False
    for k in ("no3", "pe", "pf"):
        v = u.get(k)
        if v is None:
            continue
        r = v / LIMITS[k]
        s -= penalty(r)
        if r > 1:
            over = True
    s = max(0, s)
    if over:
        return "E", s
    return ("A" if s >= 9 else "B" if s >= 7.5 else "C" if s >= 6 else "D" if s >= 4 else "E"), s


def main():
    ys = years()
    print("Années :", ys)

    # 1. Prélèvements : date, réseaux concernés, distributeur.
    # Un même prélèvement apparaît sur plusieurs lignes, une par réseau (UDI) qu'il représente :
    # ses résultats valent pour chacun de ces réseaux.
    prel = {}
    concl = {}  # conclusion de l'ARS pour chaque prélèvement
    last_date = dt.date(1900, 1, 1)
    for y in ys:
        for r in open_member(y, "PLV"):
            d = dt.date.fromisoformat(r["dateprel"])
            e = prel.setdefault(r["referenceprel"], [set(), d, r["distrlib"] or r["moalib"]])
            e[0].add(r["cdreseau"])
            if r["conclusionprel"].strip():
                concl[r["referenceprel"]] = r["conclusionprel"].strip()
            last_date = max(last_date, d)
    m = last_date.year * 12 + last_date.month - 1 - (MONTHS - 1)
    start = dt.date(m // 12, m % 12 + 1, 1)
    print(f"Période retenue : du {start} au {last_date}")
    prel = {k: v for k, v in prel.items() if v[1] >= start}

    udi = defaultdict(lambda: {"n": 0, "dist": defaultdict(int), "last": None, "pl": []})
    for ref, (nets, d, dist) in prel.items():
        for res in nets:
            u = udi[res]
            u["n"] += 1
            u["pl"].append((d, concl.get(ref, "")))
            u["dist"][dist] += 1
            u["last"] = max(u["last"], d) if u["last"] else d

    # 2. Résultats d'analyse
    acc = defaultdict(lambda: defaultdict(list))
    bact_pos = defaultdict(set)
    for y in ys:
        for r in open_member(y, "RESULT"):
            code = r["cdparametresiseeaux"]
            if code not in CODES:
                continue
            p = prel.get(r["referenceprel"])
            if not p:
                continue
            v = num(r["valtraduite"])
            if v is None:
                continue
            nets, d, _ = p
            for res in nets:
                if code in BACT:
                    if v > 0:
                        bact_pos[res].add(r["referenceprel"])
                else:
                    acc[res][code].append((d, v))

    repair = Repair(set(concl.values()))
    out_udi = {}
    advice_n = defaultdict(int)
    for res, u in udi.items():
        a = acc.get(res, {})
        rec = {"n": u["n"], "b": len(bact_pos.get(res, ())), "last": u["last"].isoformat(),
               "dist": max(u["dist"], key=u["dist"].get).strip()}

        def mx(code):
            vals = a.get(code)
            return round(max(v for _, v in vals), 4) if vals else None

        no3 = a.get("NO3")
        rec["no3"] = mx("NO3")
        rec["no3l"] = round(max(no3)[1], 3) if no3 else None
        rec["pe"] = mx("PESTOT")
        rec["pf"] = mx("SPFAS")
        rec["r4"] = mx("471811R")
        rec["tfa"] = mx("TFA")
        rec["pb"] = mx("PB")
        th = a.get("TH")
        rec["th"] = round(statistics.median(v for _, v in th), 1) if th else None
        rec["L"], rec["s"] = grade(rec)
        # Avis de l'ARS : gardé quand il restreint la consommation, ou pour les notes D et E
        av = active(u["pl"])
        if av and (av[0] in ("ban", "boil", "risk") or (rec["L"] in ("D", "E") and av[2])):
            k, d, t, now = av
            if k == "none" and conforming(t):
                k = "conf"
            rec["ars"] = {"k": k, "d": d.isoformat(), "t": repair(t)}
            # Consigne « actuelle » : encore présente au dernier prélèvement et datant de moins de 60 jours
            # avant la fin des données. Sinon on la présente comme passée, en renvoyant vers la mairie.
            if k in ("ban", "boil", "risk") and not (now and (last_date - d).days <= 60):
                rec["ars"]["old"] = 1
            if k == "risk":
                rec["ars"]["g"] = groups(t)
            advice_n[k + ("-passée" if rec["ars"].get("old") else "")] += 1
        out_udi[res] = rec

    print("Avis ARS retenus :", dict(advice_n))

    # 3. Communes et réseaux qui les desservent (fichier le plus récent)
    names = {}
    with open(COMMUNES, encoding="utf-8") as f:
        for c in json.load(f):
            if c["type"] in ("commune-actuelle",):
                names[c["code"]] = c
    deps = {}
    with open(DEPTS, encoding="utf-8") as f:
        for d in json.load(f):
            deps[d["code"]] = d["nom"]

    links = defaultdict(list)
    netname = {}
    for r in open_member(ys[-1], "COM_UDI"):
        q = r["quartier"].strip()
        links[r["inseecommune"]].append((r["cdreseau"], "" if q in ("-", "En totalité") else q))
        netname[r["cdreseau"]] = r["nomreseau"].strip()

    communes = {}
    used_slugs = set()
    for code, lst in links.items():
        c = names.get(code)
        if not c:
            continue
        seen, secteurs = set(), []
        for res, q in lst:
            if res in seen:
                continue
            seen.add(res)
            secteurs.append({"id": res, "q": q, "nom": netname.get(res, "")})
        with_data = [s for s in secteurs if out_udi.get(s["id"], {}).get("L")]
        if not with_data:
            main_id = None
        else:
            main_id = max(with_data, key=lambda s: out_udi[s["id"]]["n"])["id"]
        sl = f"{slug(c['nom'])}-{code.lower()}"
        used_slugs.add(sl)
        communes[code] = {"c": code, "nom": c["nom"], "dep": c["departement"], "depNom": deps.get(c["departement"], ""),
                          "pop": c.get("population") or 0, "slug": sl, "main": main_id, "sect": secteurs}

    noted = [c for c in communes.values() if c["main"]]
    print(f"Communes : {len(communes)} dont {len(noted)} notées ; UDI avec données : {sum(1 for u in out_udi.values() if u['L'])}")
    dist = defaultdict(int)
    for c in noted:
        dist[out_udi[c["main"]]["L"]] += 1
    print("Répartition des notes :", dict(sorted(dist.items())))

    # Rang national : d'abord les points, puis la charge en polluants (moyenne des parts de limite),
    # pour départager les milliers de communes à 10 points. Égalité parfaite = même rang.
    def load(u):
        parts = [u[k] / LIMITS[k] for k in ("no3", "pe", "pf") if u.get(k) is not None]
        return round(sum(parts) / len(parts), 4) if parts else 0

    key = lambda c: (-out_udi[c["main"]]["s"], out_udi[c["main"]]["b"], load(out_udi[c["main"]]))
    order = sorted(noted, key=key)
    rank, prev, pos = {}, None, 0
    for i, c in enumerate(order, 1):
        k = key(c)
        if k != prev:
            pos, prev = i, k
        rank[c["c"]] = pos
    ties = defaultdict(int)
    for v in rank.values():
        ties[v] += 1

    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(os.path.join(PUBLIC, "dep"), exist_ok=True)
    meta = {"start": start.isoformat(), "end": last_date.isoformat(), "generated": dt.date.today().isoformat(),
            "noted": len(noted), "communes": len(communes), "dist": dist, "years": ys}

    def pct(v, lim):
        return None if v is None else round(v / lim * 100)

    # Index léger, trié par population : [code, nom, lettre, rang, microbes, %nitrates, %pesticides, %pfas,
    # population en milliers, et en option consigne ARS en cours]. L'adresse (slug) et le département se déduisent du nom et du code.
    index = []
    for c in sorted(communes.values(), key=lambda c: -c["pop"]):
        u = out_udi.get(c["main"]) if c["main"] else None
        pk = round(c["pop"] / 1000)
        if not u:
            index.append([c["c"], c["nom"], 0, 0, 0, 0, 0, 0, pk])
            continue
        n = lambda v: -1 if v is None else v
        row = [c["c"], c["nom"], u["L"], rank[c["c"]], u["b"], n(pct(u["no3"], 50)), n(pct(u["pe"], 0.5)),
               n(pct(u["pf"], 0.1)), pk]
        a = u.get("ars")
        if a and a["k"] in ("ban", "boil", "risk") and not a.get("old"):
            row.append(1 if a["k"] == "risk" else 2)  # consigne de l'ARS en cours : 2 ne pas boire, 1 déconseillée
        index.append(row)
    with open(os.path.join(PUBLIC, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": {"start": meta["start"], "end": meta["end"], "noted": len(noted), "dist": dist},
                   "deps": {k: deps[k] for k in sorted({c["dep"] for c in communes.values()}) if k in deps}, "c": index},
                  f, ensure_ascii=False, separators=(",", ":"))

    # Détail par département
    by_dep = defaultdict(lambda: {"c": {}, "u": {}})
    for c in communes.values():
        d = by_dep[c["dep"]]
        d["c"][c["c"]] = {k: c[k] for k in ("nom", "slug", "dep", "depNom", "pop", "main", "sect")} | {
            "rang": rank.get(c["c"]), "ex": ties.get(rank.get(c["c"]), 0) > 1}
        for s in c["sect"]:
            if s["id"] in out_udi:
                d["u"][s["id"]] = out_udi[s["id"]]
    for dep, d in by_dep.items():
        with open(os.path.join(PUBLIC, "dep", f"{dep}.json"), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(BUILD, "site.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "communes": communes, "udi": out_udi, "rank": rank,
                   "ex": {k: ties[v] > 1 for k, v in rank.items()}}, f,
                  ensure_ascii=False, separators=(",", ":"))
    print("Fichiers écrits.")


if __name__ == "__main__":
    main()
