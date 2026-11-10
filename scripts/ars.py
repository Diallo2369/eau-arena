"""Avis officiel des agences régionales de santé (ARS) joint à chaque prélèvement.

Chaque prélèvement du contrôle sanitaire porte une conclusion rédigée par l'ARS (« conclusionprel »).
On en tire une réponse simple à « peut-on la boire ? », en restant prudent :
seules des formulations sans ambiguïté donnent une consigne ; sinon on affiche le texte tel quel.

Catégories, de la plus grave à la moins grave :
  ban   ne pas boire l'eau du robinet (interdiction ou restriction pour tous)
  boil  la faire bouillir avant de la boire
  risk  déconseillée à certaines personnes (femmes enceintes, nourrissons…)
  ok    l'ARS dit explicitement qu'elle peut être bue par tous
  none  rien d'explicite
  lift  la restriction précédente est levée
  local résultat valable pour un seul robinet (plomb, chlorure de vinyle) : pas une consigne pour le réseau
"""
import re
import unicodedata
from collections import Counter

SEVERITY = {"ban": 3, "boil": 2, "risk": 1}


def squash(t):
    """Minuscules, sans accents ni espaces ni ponctuation : rend les recherches insensibles
    aux coupures de mots présentes dans les textes officiels (« n écessité », « déc onseillée »)."""
    t = unicodedata.normalize("NFD", t.lower().replace("’", "'")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", t)


LIFT = (r"(interdiction|restriction)s?[a-z]{0,80}(estlevee|sontlevees|peutetrelevee|peuventetrelevees|estabroge)"
        r"|levee(s)?de(la|les|l)?(interdiction|restriction)|arretemunicipal[a-z0-9]{0,80}abroge")
LOCAL = (r"nest(pas)?representati(ve|f)(que)?(pour|de)|pasrepresentati(ve|f)s?de(la)?qualitedeleau"
         r"|ne(vaut|valent)quepourlepoint|premierjet")
BOIL = r"sans(desinfectionou)?ebullition|ebullitionprolongee|fairebouillir|bouillirleau"
BAN_ALL = (r"afinsdeboisson|alensembledelapopulation|impropre(a)?(la)?consommation"
           r"|nedoitpasetreutiliseepourlaconsommationhumaine|neconsommezpas|nepasconsommerleau(?!dupremierjet)")
RISK_WHO = (r"femmesenceintes|nourrisson|populations?(a|aux|des)?risques?|populationssensibles|personnesarisques?"
            r"|personnes(sensibles|fragil|vulnerab)|enfantsdemoins|jeunesenfants")
RISK = (r"nedoitpasetreconsommeepar(les)?(populations|personnes|femmes|nourrissons|enfants)"
        r"|deconseillee?s?(aux|pour|a)(les)?(femmes|nourrissons|enfants|populations|personnes)"
        r"|(interdi|restriction)[a-z0-9]{0,90}(pour|aux|par)(la|les|le)*(femmes|nourrissons|enfants|populations|personnes)")
BAN = (r"anecessite(une|la)restriction|aentraine(une)?interdiction|nedoitpasetre(utilisee|consommee|bue)"
       r"|interdi(t|te|ction)(temporaire|permanente)?(de|d)?(la)?consomm|interdictiondeconsommationpermanente"
       r"|consommation(deleau)?(est|doitetre)interdite|interditealaconsommation|maintiendelinterdiction"
       r"|prolongationdelinterdiction")
OK = (r"peut(donc|toutefois|cependant)?(continuera)?etre(consommee|bue|utilisee)partous|consommeepartous"
      r"|proprealaconsommation|sans(aucune)?restriction|na(toutefois|cependant|donc)?pasnecessite(de|une|aucune)?(la)?restriction"
      r"|naucunerestriction|nentrain(ant|e)pas(de)?(mesuresde|mesurede)?restriction|nayantpasengendrederestriction")


# Phrases conditionnelles (« au-delà de cette valeur, l'eau ne doit pas être bue ») : elles décrivent
# la règle, pas la situation. On les retire avant de chercher une consigne.
CONDITIONAL = r"au?dela(de)?(laquelle|cettevaleur|decettevaleur|duquel|decette)[a-z0-9]{0,140}"


def classify(text):
    s = re.sub(CONDITIONAL, "", squash(text))
    if re.search(LIFT, s):
        return "lift"
    if re.search(LOCAL, s):
        return "local"
    if re.search(BOIL, s):
        return "boil"
    if re.search(BAN_ALL, s):
        return "ban"
    if re.search(RISK, s) and re.search(RISK_WHO, s):
        return "risk"
    if re.search(BAN, s):
        return "ban"
    if re.search(OK, s):
        return "ok"
    return "none"


CONF = r"conformeauxexigences|respectelesexigences|conformeauxlimitesdequalite|eaudequalitesanitairesatisfaisante"
NOTCONF = r"nonconform|nesatisfai|nerespectepas|depass"


def conforming(text):
    """Avis sans consigne qui dit simplement que l'eau était conforme."""
    s = squash(text)
    return bool(re.search(CONF, s)) and not re.search(NOTCONF, s)


def groups(text):
    """Personnes visées par une consommation déconseillée, en clair."""
    s = squash(text)
    g = []
    if "femmesenceintes" in s:
        g.append("femmes enceintes et allaitantes" if "allaitantes" in s else "femmes enceintes")
    m = re.search(r"enfantsdemoinsde(\d+|deux|douze|six)(ans|mois)", s)
    m6 = re.search(r"nourrissonsdemoinsde(\d+|six)mois", s)
    if m:
        n = {"deux": "2", "douze": "12", "six": "6"}.get(m.group(1), m.group(1))
        g.append(f"enfants de moins de {n} {m.group(2)}")
    elif m6:
        n = {"six": "6"}.get(m6.group(1), m6.group(1))
        g.append(f"nourrissons de moins de {n} mois")
    elif "nourrisson" in s:
        g.append("nourrissons")
    if not g:
        g.append("personnes fragiles")
    return g


class Repair:
    """Les textes officiels sont découpés en lignes fixes : des espaces parasites coupent des mots
    (« fait l’obj et », « néc essaires »). On recolle deux morceaux quand le mot entier est courant
    dans l'ensemble des textes et que l'un des morceaux, seul, est rare."""

    def __init__(self, texts):
        self.freq = Counter(w.lower() for t in texts for w in t.split())

    def __call__(self, t):
        words = t.split()
        out = []
        i = 0
        while i < len(words):
            w = words[i]
            if i + 1 < len(words):
                n = words[i + 1]
                joined = (w + n).lower()
                fj, fa, fb = self.freq[joined], self.freq[w.lower()], self.freq[n.lower()]
                if fj >= 3 and min(fa, fb) < fj:
                    words[i + 1] = w + n
                    i += 1
                    continue
            out.append(w)
            i += 1
        return " ".join(out)


def active(samples):
    """Consigne en vigueur pour un réseau. samples : liste de (date, texte) de ses prélèvements.
    On lit les avis des 45 derniers jours avant le dernier prélèvement, du plus ancien au plus récent :
    une restriction reste en vigueur jusqu'à ce qu'un avis la lève. Renvoie (catégorie, date, texte, actuelle) :
    « actuelle » est vrai quand la consigne figure encore dans les avis du dernier prélèvement."""
    if not samples:
        return None
    import datetime as dt
    last = max(d for d, _ in samples)
    recent = sorted((d, t) for d, t in samples if d >= last - dt.timedelta(days=45) and t)
    cur = None
    by_date = {}
    for d, t in recent:
        by_date.setdefault(d, []).append((classify(t), t))
    for d in sorted(by_date):
        items = by_date[d]
        if any(k == "lift" for k, _ in items) and not any(k in SEVERITY for k, _ in items):
            cur = None
        for k, t in items:
            if k in SEVERITY and (cur is None or SEVERITY[k] >= SEVERITY[cur[0]]):
                cur = (k, d, t)
    if cur:
        latest = by_date[max(by_date)]
        return (*cur, any(k == cur[0] for k, _ in latest))
    # Pas de consigne : on garde l'avis le plus récent qui dit explicitement qu'on peut la boire,
    # sinon le plus récent tout court.
    oks = [(d, t) for d, t in recent if classify(t) == "ok"]
    if oks:
        d, t = oks[-1]
        return ("ok", d, t, True)
    d, t = recent[-1] if recent else (last, "")
    return ("none", d, t, True)
