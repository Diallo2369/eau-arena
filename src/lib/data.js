// Données lues à la construction (jamais envoyées telles quelles au navigateur).
import fs from "node:fs";
import path from "node:path";
import { othersFrom } from "./core.js";

const root = process.cwd();
let cache;

export function load() {
  if (cache) return cache;
  const site = JSON.parse(fs.readFileSync(path.join(root, "data/build/site.json"), "utf-8"));
  const index = JSON.parse(fs.readFileSync(path.join(root, "public/data/index.json"), "utf-8"));
  const deps = JSON.parse(fs.readFileSync(path.join(root, "node_modules/@etalab/decoupage-administratif/data/departements.json"), "utf-8"));
  const depNames = Object.fromEntries(deps.map((d) => [d.code, d.nom]));
  const byDep = {};
  for (const c of Object.values(site.communes)) (byDep[c.dep] ||= []).push(c);
  cache = { site, index: index.c, meta: { ...index.meta }, depNames, byDep };
  return cache;
}

// Même forme que les fichiers public/data/dep/<dep>.json, pour une commune
export function cityData(code) {
  const { site, byDep } = load();
  const c = site.communes[code];
  const u = {};
  for (const s of c.sect) if (site.udi[s.id]) u[s.id] = site.udi[s.id];
  const pick = (({ nom, slug, dep, depNom, pop, main, sect }) => ({ nom, slug, dep, depNom, pop, main, sect }))(c);
  const city = { ...pick, c: code, rang: site.rank[code] ?? null, ex: !!site.ex[code] };
  const others = othersFrom(byDep[c.dep].map((x) => ({ code: x.c, nom: x.nom, pop: x.pop, rang: site.rank[x.c], u: x.main ? site.udi[x.main] : null })), code);
  return { c: city, u, others };
}

