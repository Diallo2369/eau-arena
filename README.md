# Eau Arena

**Mon eau du robinet est-elle bonne ?** Les analyses officielles de l'eau potable, commune par commune, expliquées simplement : une phrase, une note de A à E et quatre critères (microbes, nitrates, pesticides, polluants éternels).

Site entièrement statique, sans serveur ni base de données, publié par GitHub Pages.

## En bref

| | |
| --- | --- |
| Données | « Résultats du contrôle sanitaire de l'eau distribuée commune par commune », ministère de la Santé, data.gouv.fr, Licence Ouverte |
| Communes | 34 806 pages, une par commune (environ 520 Mo une fois construit) |
| Période | les 15 derniers mois disponibles ; pour chaque critère, la valeur la plus haute |
| Générateur | Astro 7, JavaScript sans framework, CSS fait main |
| Mise à jour | automatique chaque lundi (GitHub Actions), ou à chaque envoi sur `main` |

## Commandes

```bash
npm ci                 # dépendances (Node 22 minimum)
npm run data:fetch     # télécharge les 2 derniers fichiers annuels (~250 Mo chacun) dans data/raw/
npm run data:prepare   # calcule les notes : data/build/site.json, public/data/index.json, public/data/dep/*.json
npm run build          # contrôle des données, puis construction dans dist/
npm run preview        # aperçu local sur http://localhost:4321
LIMIT_PAGES=300 npm run build   # construction rapide avec les 300 communes les plus peuplées
```

## Où modifier quoi

| Fichier | Rôle |
| --- | --- |
| `scripts/fetch_data.py` | téléchargement des fichiers officiels (avec nouvelles tentatives) |
| `scripts/prepare_data.py` | règles de calcul : période, critères, note, réseau principal, classement |
| `scripts/check_data.mjs` | bloque la construction si les données sont incomplètes ou mal encodées |
| `src/lib/core.js` | **tout le rendu des pages** et les textes, partagé entre la construction et le navigateur |
| `src/lib/site.js` | réglages : nom du site, publicité (`ADS`), adresse de contact |
| `src/scripts/app.js` | navigation sans rechargement, recherche, fioles, classement, animations |
| `src/styles/site.css` | tout le style |
| `src/pages/` | une route par type de page |

## Navigation sans appel au serveur

Chaque page existe en vrai fichier HTML pour Google. Une fois le site ouvert, le navigateur ne recharge plus rien : il reconstruit les pages avec `src/lib/core.js`.

- `public/data/index.json` (environ 550 Ko compressé) : nom, note et 4 pourcentages de chaque commune. Chargé en tâche de fond après l'affichage, pour la recherche et le classement.
- `public/data/dep/<département>.json` : détail des communes d'un département, chargé à l'arrivée sur une commune, ou en avance au survol d'un lien. Les communes voisines sont ensuite instantanées.

## Règles de calcul

- **Unité** : l'unité de distribution (UDI), portion de réseau où l'eau est homogène. Un prélèvement compte pour chaque réseau auquel il est rattaché.
- **Commune à plusieurs réseaux** (6 656 cas) : la note est celle du réseau principal, celui qui a le plus de prélèvements (la fréquence des contrôles suit le volume distribué). La page liste les autres secteurs.
- **Critères** : microbes (E. coli, entérocoques), nitrates (limite 50 mg/L), total des pesticides (0,5 µg/L), somme des 20 PFAS (0,1 µg/L). Calcaire et plomb affichés à part, hors note.
- **Note** : 10 points ; on retire 0 / 0,5 / 1,5 / 3 / 6 points selon la part de la limite atteinte (moins de 10 %, 10-50 %, 50-80 %, 80-100 %, au-delà), et 2 points par prélèvement avec microbes. A dès 9, B dès 7,5, C dès 6, D dès 4. E si une limite est dépassée ou sous 4 points. Note « provisoire » si les pesticides ou les PFAS n'ont pas été analysés.
- **Classement** : par points, puis par nombre de prélèvements avec microbes, puis par charge moyenne en polluants.

## Mise en ligne sur GitHub Pages

1. Settings > Pages > Source : **GitHub Actions**.
2. Settings > Secrets and variables > Actions > Variables : `SITE_URL` = adresse définitive (ex. `https://eauarena.fr`). Sans elle, le site est publié mais fermé à Google (`noindex` et `robots.txt`).
3. Domaine personnalisé : le fichier `CNAME` est écrit automatiquement à partir de `SITE_URL` ; côté DNS, un enregistrement CNAME `www` vers `<compte>.github.io` et les 4 adresses A de GitHub pour le domaine nu.

Limite à connaître : GitHub Pages accepte un site de 1 Go au plus ; le site en fait environ 520 Mo.
