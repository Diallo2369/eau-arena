// Après la construction : robots.txt selon que l'adresse définitive est connue ou non.
import fs from "node:fs";
const site = (process.env.SITE_URL || "").replace(/\/$/, "");
const robots = site
  ? `User-agent: *\nAllow: /\nDisallow: /data/\n\nSitemap: ${site}/sitemap-index.xml\n`
  : "User-agent: *\nDisallow: /\n";
fs.writeFileSync("dist/robots.txt", robots);
// GitHub Pages : désactive Jekyll et publie le domaine personnalisé s'il est connu
fs.writeFileSync("dist/.nojekyll", "");
if (site && !/github\.io$/.test(new URL(site).hostname)) fs.writeFileSync("dist/CNAME", new URL(site).hostname + "\n");
console.log(site ? `robots.txt et CNAME écrits pour ${site}` : "Adresse définitive inconnue : robots.txt bloque l'indexation.");
