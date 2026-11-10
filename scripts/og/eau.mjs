// Régénère les reflets d'eau du fond (public/eau-1.webp, public/eau-2.webp), à lancer seulement
// si l'on change le motif : node scripts/og/eau.mjs  (nécessite Playwright et Python avec Pillow)
// Le motif était calculé par le navigateur (filtre SVG) à chaque affichage, ce qui ralentissait le défilement.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const svgs = JSON.parse(fs.readFileSync(new URL("./eau-textures.json", import.meta.url), "utf8"));
const b = await chromium.launch();
for (const [i, [svg, size, op]] of [[svgs[0], 600, 0.11], [svgs[1], 900, 0.06]].entries()) {
  const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 2 });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style><div style="opacity:${op}">${svg}</div>`);
  await p.screenshot({ path: `/tmp/eau-${i + 1}.png`, omitBackground: true });
  await p.close();
  execFileSync("python3", ["-c", `from PIL import Image
a=Image.open('/tmp/eau-${i + 1}.png').getchannel('A').resize((${size},${size}),Image.LANCZOS)
w=Image.new('RGBA',a.size,(255,255,255,0)); w.putalpha(a)
w.save('public/eau-${i + 1}.webp','WEBP',lossless=True,method=6,exact=False)`]);
}
await b.close();
