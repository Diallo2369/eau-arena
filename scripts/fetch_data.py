"""Télécharge les résultats du contrôle sanitaire de l'eau distribuée (data.gouv.fr).

On garde l'année en cours et l'année précédente : le site retient les 15 derniers mois.
Les fichiers sont lourds (environ 250 Mo chacun), ils restent hors du dépôt (data/raw/ est ignoré).
"""
import json, os, sys, time, urllib.request

DATASET = "https://www.data.gouv.fr/api/1/datasets/resultats-du-controle-sanitaire-de-leau-distribuee-commune-par-commune/"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw")


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except Exception as e:  # serveurs parfois instables : on réessaie
            print(f"  essai {i + 1} échoué : {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise SystemExit(f"Impossible de télécharger {url}")


def download(url, dest, tries=5):
    for i in range(tries):
        try:
            tmp = dest + ".part"
            with urllib.request.urlopen(url, timeout=300) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            os.replace(tmp, dest)
            return
        except Exception as e:
            print(f"  essai {i + 1} échoué : {e}", file=sys.stderr)
            time.sleep(10 * (i + 1))
    raise SystemExit(f"Impossible de télécharger {url}")


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = json.loads(get(DATASET))
    # ressources « dis-AAAA.zip » (fichier national, pas la version par département)
    files = {}
    for r in meta["resources"]:
        t = r["title"]
        if t.startswith("dis-") and t.endswith(".zip") and "dept" not in t:
            files[int(t[4:8])] = r
    years = sorted(files)[-2:]
    manifest = {}
    for y in years:
        r = files[y]
        dest = os.path.join(OUT, f"dis-{y}.zip")
        size = r.get("filesize")
        if os.path.exists(dest) and size and os.path.getsize(dest) == size:
            print(f"dis-{y}.zip déjà à jour")
        else:
            print(f"Téléchargement de dis-{y}.zip ({(size or 0) // 1_000_000} Mo)…")
            download(r["url"], dest)
        manifest[str(y)] = {"url": r["url"], "updated": r.get("last_modified", "")[:10]}
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)


if __name__ == "__main__":
    main()
