// Bloque la construction si les données sont manifestement fausses ou incomplètes.
import fs from "node:fs";

const fail = (m) => { console.error("Données refusées : " + m); process.exit(1); };
if (!fs.existsSync("data/build/site.json") || !fs.existsSync("public/data/index.json")) fail("lancez d'abord npm run data:prepare");
const site = JSON.parse(fs.readFileSync("data/build/site.json", "utf-8"));
const idx = JSON.parse(fs.readFileSync("public/data/index.json", "utf-8"));
const communes = Object.values(site.communes);
const udi = Object.values(site.udi);

if (communes.length < 30000) fail(`seulement ${communes.length} communes (attendu : plus de 30 000)`);
if (site.meta.noted < 0.9 * communes.length) fail(`seulement ${site.meta.noted} communes notées sur ${communes.length}`);
const end = new Date(site.meta.end), age = (Date.now() - end) / 864e5;
if (age > 200) fail(`les analyses les plus récentes datent du ${site.meta.end} : fichier source trop ancien`);
const slugs = new Set();
for (const c of communes) {
  if (!/^[0-9AB]{5}$/.test(c.c)) fail(`code commune invalide : ${c.c}`);
  if (/[?�]|Ã/.test(c.nom)) fail(`nom mal encodé : ${c.nom}`);
  if (slugs.has(c.slug)) fail(`adresse en double : ${c.slug}`);
  slugs.add(c.slug);
}
for (const u of udi) {
  for (const k of ["no3", "pe", "pf", "pb"]) if (u[k] != null && (u[k] < 0 || u[k] > 10000)) fail(`valeur impossible ${k}=${u[k]}`);
  if (u.L && !"ABCDE".includes(u.L)) fail(`note invalide ${u.L}`);
  if (u.b > u.n) fail("plus d'analyses avec microbes que d'analyses");
}
// Les grandes villes doivent être là
for (const code of ["75056", "13055", "69123", "31555", "06088", "44109"]) if (!site.communes[code]?.main) fail(`grande ville sans résultat : ${code}`);
if (idx.c.length !== communes.length) fail("index et données de construction ne correspondent pas");
console.log(`Données OK : ${communes.length} communes, ${site.meta.noted} notées, analyses du ${site.meta.start} au ${site.meta.end}.`);
