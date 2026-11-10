import { adSlot, NO_COOKIE } from "./ads.js";

// Calculs et rendu partagés entre la construction (Astro) et le navigateur.
// Un seul endroit à modifier : chaque page est générée à la construction avec ces fonctions,
// puis le navigateur les réutilise pour changer de page sans appel au serveur.

export const LIM = { no3: 50, pe: 0.5, pf: 0.1, pb: 10 };
export const LETTERS = ["A", "B", "C", "D", "E"];
export const SHORT = { A: "Bonne eau", B: "Bonne eau", C: "Eau moyenne", D: "Eau médiocre", E: "Limite dépassée" };
const ET = { ok: "Bon", warn: "À surveiller", bad: "Dépassement", na: "Pas encore mesuré" };

export const EXPL = {
  bact: "Des microbes dans l'eau peuvent rendre malade, par exemple donner la diarrhée. Il ne doit y en avoir aucun.",
  no3: "Les nitrates viennent surtout des engrais utilisés dans les champs. Au-dessus de la limite, on déconseille l'eau aux femmes enceintes et pour les biberons.",
  pe: "Ce sont des restes de produits utilisés pour protéger les cultures. La limite est très prudente : elle est fixée bien en dessous du niveau où ils deviennent dangereux.",
  pf: "Ce sont des produits chimiques utilisés dans les poêles antiadhésives, les vêtements imperméables ou les emballages. Ils ne disparaissent presque jamais dans la nature, d'où leur surnom. On les contrôle dans l'eau depuis 2026.",
};
export const TECH = { bact: "bactéries", no3: "venus des engrais", pe: "produits agricoles", pf: "PFAS" };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const fr = (v) => (v == null ? "—" : String(v).replace(".", ","));
export const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const dateFr = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d === 1 ? "1er" : d} ${MOIS[m - 1]} ${y}`; };
export const moisFr = (iso) => { const [y, m] = iso.split("-").map(Number); return `${MOIS[m - 1]} ${y}`; };

// Même règle que scripts/prepare_data.py : accents retirés, caractères non ASCII supprimés.
export function slugify(nom, code) {
  const s = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${s}-${code.toLowerCase()}`;
}
export const depOf = (code) => (code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2));
export const cityUrl = (nom, code) => `/eau/${slugify(nom, code)}/`;
export const rangTxt = (r, ex) => `${r === 1 ? "1re" : fmtInt(r) + "e"}${ex ? " ex aequo" : ""}`;

const lvl = (v, lim) => (v == null ? "na" : v / lim > 1 ? "bad" : v / lim > 0.8 ? "warn" : "ok");
const pct = (v, lim) => (v == null ? null : Math.round((v / lim) * 100));

// Les 4 critères d'un réseau (UDI)
export function criteria(u) {
  const c = [];
  c.push({ id: "bact", label: "Microbes", k: u.b ? "warn" : "ok", p: u.b ? 12 : 0, num: String(u.b),
    etat: u.b ? "À surveiller" : "Aucun", val: `${u.b} sur ${u.n}`, valLab: "analyses avec microbes", lim: "0",
    note: u.b ? `Des microbes ont été trouvés dans ${u.b} analyse${u.b > 1 ? "s" : ""} sur ${u.n}. Les autres étaient bonnes.` : "" });
  const pn = pct(u.no3, LIM.no3), kn = lvl(u.no3, LIM.no3);
  c.push({ id: "no3", label: "Nitrates", k: kn, p: pn, num: pn == null ? "—" : pn + " %", etat: ET[kn],
    val: u.no3 == null ? "—" : fr(u.no3) + " mg/L", valLab: "valeur la plus haute", lim: "50 mg/L",
    note: u.no3 != null && u.no3 >= 25 && u.no3l != null && u.no3l < u.no3 ? `Ce chiffre est le plus haut relevé en 15 mois. Lors de la dernière analyse, on était à ${fr(u.no3l)} mg/L.` : "" });
  const pp = pct(u.pe, LIM.pe), kp = lvl(u.pe, LIM.pe);
  c.push({ id: "pe", label: "Pesticides", k: kp, p: pp, num: pp == null ? "—" : pp + " %", etat: u.pe === 0 ? "Non détectés" : ET[kp],
    val: u.pe == null ? "—" : fr(u.pe) + " µg/L", valLab: "valeur la plus haute", lim: "0,5 µg/L",
    note: u.pe == null ? "Les pesticides n'ont pas été analysés sur ce réseau ces 15 derniers mois." :
      u.r4 != null && u.r4 > 0.1 ? `On trouve aussi le reste d'un ancien produit contre les champignons des cultures (le chlorothalonil), jusqu'à ${fr(u.r4)} µg/L. Il n'a pas de limite officielle, il n'est donc pas compté ici.` : "" });
  const pq = pct(u.pf, LIM.pf), kq = lvl(u.pf, LIM.pf);
  c.push({ id: "pf", label: "Polluants éternels", k: kq, p: pq, num: pq == null ? "—" : pq + " %", etat: u.pf === 0 ? "Non détectés" : ET[kq],
    val: u.pf == null ? "—" : fr(u.pf) + " µg/L", valLab: "valeur la plus haute", lim: "0,1 µg/L",
    note: u.pf == null ? "Ces polluants ne sont pas encore analysés sur ce réseau. Les contrôles se généralisent depuis 2026." : "" });
  return c;
}
export const provisional = (u) => u.pf == null || u.pe == null;

export function verdict(u, crit) {
  const L = u.L;
  const over = crit.filter((c) => c.k === "bad");
  if (L === "E" && over.length) {
    return { k: "bad", titre: "Une limite de santé a été dépassée.", sous: `Au moins une analyse des 15 derniers mois a dépassé la limite : ${over.map((c) => c.label.toLowerCase()).join(", ")}. Suivez les avis de votre mairie et de l'agence régionale de santé.` };
  }
  const w = crit.filter((c) => c.k === "warn");
  const detail = w.length ? (w[0].id === "bact" ? "Des microbes ont été trouvés au moins une fois en 15 mois. Les autres analyses étaient bonnes." : `${w[0].label} : on s'est approché de la limite, sans la dépasser.`) : "";
  const T = {
    A: ["Oui, elle est bonne.", "Elle respecte toutes les limites de santé et fait partie des meilleures eaux de France."],
    B: ["Oui, elle est bonne.", "Elle respecte toutes les limites de santé, avec de légères traces de polluants."],
    C: ["Oui, elle est potable, mais moyenne.", "Elle respecte les limites, mais contient plus de polluants que la plupart des eaux."],
    D: ["Elle est potable, mais de qualité médiocre.", "Elle respecte les limites, mais fait partie des eaux les plus chargées en polluants."],
    E: ["Elle est potable, mais de qualité médiocre.", "Elle respecte les limites, mais fait partie des eaux les plus chargées en polluants."],
  }[L];
  return { k: "ok", titre: T[0], sous: detail || T[1] };
}

const calc = (th) => (th == null ? null : th < 15 ? "Peu calcaire" : th < 25 ? "Moyennement calcaire" : th < 35 ? "Calcaire" : "Très calcaire");
const calcLvl = (th) => (th < 15 ? 0 : th < 25 ? 1 : th < 35 ? 2 : 3);

// 4 communes les plus peuplées du même département, au format d'une ligne d'index
export function othersFrom(list, code) {
  const p = (v, l) => (v == null ? -1 : Math.round((v / l) * 100));
  return list.filter((x) => x.code !== code && x.u && x.u.L).sort((a, b) => b.pop - a.pop).slice(0, 4)
    .map((x) => [x.code, x.nom, x.u.L, x.rang, x.u.b, p(x.u.no3, 50), p(x.u.pe, 0.5), p(x.u.pf, 0.1), Math.round(x.pop / 1000)]);
}
// Données d'une commune à partir d'un fichier de département (public/data/dep/<dep>.json)
export function cityFromDep(dep, code) {
  const c = dep.c[code];
  if (!c) return null;
  const u = {};
  for (const s of c.sect) if (dep.u[s.id]) u[s.id] = dep.u[s.id];
  const others = othersFrom(Object.entries(dep.c).map(([k, x]) => ({ code: k, nom: x.nom, pop: x.pop, rang: x.rang, u: x.main ? dep.u[x.main] : null })), code);
  return { c: { ...c, c: code }, u, others };
}

// ---------- Éléments graphiques ----------
const ico = (k) => {
  const P = {
    rank: '<path d="M5 20V12M12 20V5M19 20v-9"/>',
    ctrl: '<path d="M12 3l7 3v6c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
    calc: '<path d="M12 3.5c3.6 4.4 5.8 7.6 5.8 10.6a5.8 5.8 0 0 1-11.6 0c0-3 2.2-6.2 5.8-10.6z"/><circle cx="10" cy="14" r=".9"/><circle cx="13.5" cy="16.2" r=".9"/><circle cx="13" cy="12" r=".9"/>',
    pb: '<path d="M3 8h7v8H3M21 8h-7v8h7"/><path d="M10 10h4M10 14h4"/>',
    map: '<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  };
  return `<span class="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg></span>`;
};
export const gr = (L, cls = "") => (L ? `<span class="gr g-${L} ${cls}" aria-label="note ${L}">${L}</span>` : `<span class="gr g-none ${cls}" aria-label="pas de note">?</span>`);
const strip = (L) => `<div class="scale" role="img" aria-label="Note ${L} sur une échelle de A à E">${LETTERS.map((l, i) => `<span class="sc g-${l}${l === L ? " on" : ""}" style="--i:${i}">${l}</span>`).join("")}</div>`;
const chevR = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const arrowDown = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

// mini-barres à partir d'une ligne d'index [code, nom, L, rang, b, pn, pp, pq, popK]
export function minibars(r) {
  const vals = [["Microbes", r[4] ? 100 : 0, r[4] ? "warn" : "ok", r[4] ? `${r[4]} fois` : "aucun"],
    ["Nitrates", r[5], lvl(r[5] < 0 ? null : r[5], 100), r[5] < 0 ? "non mesuré" : r[5] + " %"],
    ["Pesticides", r[6], lvl(r[6] < 0 ? null : r[6], 100), r[6] < 0 ? "non mesuré" : r[6] + " %"],
    ["Polluants éternels", r[7], lvl(r[7] < 0 ? null : r[7], 100), r[7] < 0 ? "non mesuré" : r[7] + " %"]];
  return `<span class="mb" role="img" aria-label="${vals.map((v) => v[0] + " " + v[3]).join(", ")}">${vals.map((v) => `<i><b class="d-${v[2]}" style="height:${v[1] < 0 ? 0 : Math.max(v[1] > 0 ? 6 : 0, Math.min(v[1], 100))}%"></b></i>`).join("")}</span>`;
}

function tube(c, sel) {
  const h = c.p == null ? 0 : (Math.min(c.p, 125) / 125) * 100;
  const tick = sel ? "M5 12.5l4.5 4.5L19 7.5" : "M9 6l6 6-6 6";
  return `<button type="button" class="tube" data-pick="${c.id}" aria-pressed="${sel}">
    <span class="vial" aria-hidden="true"><span class="glass"><span class="liquid liq-${h > 0 ? c.k : "na"}" data-h="${h.toFixed(1)}">${h > 8 ? '<i class="bub"></i><i class="bub"></i><i class="bub"></i>' : ""}</span></span><span class="rim"></span><span class="limit"></span></span>
    <span class="num"${c.id === "bact" ? ` data-to="${Number(c.num)}" data-suf=""` : c.p != null ? ` data-to="${c.p}" data-suf=" %"` : ""}>${c.num}</span>
    <span class="st st-${c.k}">${c.etat}</span><span class="lab">${c.label}</span>
    <span class="see">${sel ? "Affiché" : "Voir"}<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${tick}"/></svg></span></button>`;
}

function detail(c) {
  return `<article class="dpanel" aria-live="polite">
    <div class="row"><h3>${c.label} <span class="tech">(${TECH[c.id]})</span></h3><span class="st st-${c.k}">${c.etat}</span></div>
    <dl class="figs dfigs">
      <div><dt>${c.valLab}</dt><dd>${c.val}</dd></div>
      <div><dt>limite à ne pas dépasser</dt><dd>${c.lim}</dd></div>
      <div><dt>on en est à</dt><dd class="kd-${c.k}">${c.id === "bact" ? (c.num === "0" ? "0 %" : "—") : c.num}</dd></div>
    </dl>
    <p class="ex">${EXPL[c.id]}</p>
    ${c.note ? `<p class="callout">${esc(c.note)}</p>` : ""}
  </article>`;
}

// ---------- Recherche (en haut de l'accueil et des pages commune) ----------
export function searchBlock(city, popular) {
  return `<section class="deep hero-s"><div class="wrap home${city ? " compact" : ""}">
    ${city ? `<p class="promise">Mon eau du robinet est-elle bonne&nbsp;?</p>` : `<h1><span>Mon eau du robinet</span> <span>est-elle bonne&nbsp;?</span></h1>`}
    <form class="search" role="search" action="/" data-search>
      <label for="q">Renseignez votre commune</label>
      <div class="field"><input id="q" name="q" type="text" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list" value="${city ? esc(city) : ""}">${city ? `<a class="clear" href="/" aria-label="Effacer et revenir à l'accueil"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></a>` : ""}</div>
      <div id="sugg" class="sugg" role="listbox" hidden></div>
    </form>
    ${!city && popular ? `<div class="pop"><span>Recherches fréquentes</span><div class="pop-list">${popular.map((r) => `<a class="chipc" href="${cityUrl(r[1], r[0])}">${gr(r[2])}${esc(r[1])}</a>`).join("")}</div></div>` : ""}
  </div></section>`;
}

// ---------- Accueil ----------
export function renderHome(popular) {
  return `${searchBlock(null, popular)}
  <div class="wrap">
    <section class="how-wrap" aria-labelledby="howT">
      <h2 id="howT">Comment ça marche</h2>
      <ol class="how">
        <li class="step"><span class="n">1</span><div class="vis vis-search" aria-hidden="true"><span>Toulouse</span></div><h3>Renseignez votre commune</h3><p>Nous retrouvons les analyses officielles de l'eau qui arrive à votre robinet.</p></li>
        <li class="step"><span class="n">2</span><div class="vis vis-scale" aria-hidden="true"><i class="g-A on">A</i><i class="g-B">B</i><i class="g-C">C</i><i class="g-D">D</i><i class="g-E">E</i></div><h3>Lisez la réponse</h3><p>Une phrase simple et une note de A à E pour comparer avec les autres communes.</p></li>
        <li class="step"><span class="n">3</span><div class="vis vis-tubes" aria-hidden="true"><i style="--h:20%"></i><i style="--h:62%" class="w"></i><i style="--h:35%"></i><i style="--h:12%"></i></div><h3>Comprenez le détail</h3><p>Microbes, nitrates, pesticides, polluants éternels : chaque critère comparé à sa limite de santé.</p></li>
      </ol>
    </section>
    <p class="foot">Les données viennent du contrôle sanitaire des agences régionales de santé. ${NO_COOKIE ? "Aucune inscription, aucun cookie." : "Aucune inscription."} <a href="/a-propos/">Pourquoi ce site ?</a></p>
  </div>`;
}

// ---------- Page commune ----------
// d : { c (commune), u (réseaux du département), noted, others:[lignes d'index] , pick, sect }
export function renderCity(d) {
  const c = d.c;
  const sid = d.sect || c.main;
  if (!sid || !d.u[sid] || !d.u[sid].L) return renderNoData(d);
  const u = d.u[sid];
  const crit = criteria(u);
  const cur = crit.find((x) => x.id === d.pick) || crit.find((x) => x.k !== "ok") || crit[1];
  const v = verdict(u, crit);
  const prov = provisional(u);
  const multi = c.sect.length > 1;
  const sectors = multi ? c.sect.map((s) => ({ ...s, L: d.u[s.id]?.L || null })) : [];
  const sName = (s) => s.q || s.nom || "Secteur";
  const pbHigh = u.pb != null && u.pb > LIM.pb;
  const isMain = sid === c.main;
  return `${searchBlock(c.nom)}
  <section class="deep res-top" id="resultat"><div class="wrap res hero2">
    <div>
      <h1><span class="kicker">L'eau du robinet à</span>${esc(c.nom)}</h1>
      ${multi ? `<p class="where">${isMain ? "Secteur principal" : "Secteur"} : ${esc(sName(c.sect.find((s) => s.id === sid)))}</p>` : ""}
    </div>
    <div class="h-ans">
      ${strip(u.L)}
      <div class="verdict"><h2>${v.titre}</h2></div>
      <button type="button" class="next-btn" data-fiche>Plus de détails sur l'eau de ${esc(c.nom)}${arrowDown}</button>
    </div>
  </div>
  <div class="ana" id="analyses"><div class="wrap">
    <div class="ana-head"><h2>Ce qu'on a trouvé dans l'eau</h2><div class="ana-meta"><p class="tap-hint"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.8-2.4L4.5 15.5a1.6 1.6 0 0 1 2.4-2.1L9 15"/></svg>Touchez une fiole pour voir son détail</p><p class="legend"><i></i>limite à ne pas dépasser</p></div></div>
    <div class="ana-grid">
      <div class="tubes" role="group" aria-label="Les 4 critères">${crit.map((x) => tube(x, x.id === cur.id)).join("")}</div>
      ${detail(cur)}
    </div>
  </div></div></section>
  <div class="wrap light">
    ${multi ? `<section class="sectors"><h2>${c.sect.length} réseaux desservent ${esc(c.nom)}</h2><p class="ab-lead">L'eau peut venir de sources différentes selon le quartier. Nous affichons par défaut le réseau principal, celui qui est le plus contrôlé. Choisissez le vôtre :</p>
      <div class="sect-list">${sectors.map((s) => `<button type="button" class="ccard${s.id === sid ? " on" : ""}" data-sect="${s.id}" aria-pressed="${s.id === sid}"${s.L ? "" : " disabled"}>${gr(s.L)}<span class="cn"><b>${esc(sName(s))}</b><span>${s.id === c.main ? "Réseau principal" : s.L ? SHORT[s.L] : "Pas assez d'analyses"}</span></span></button>`).join("")}</div></section>` : ""}
    <section class="good" id="fiche">
      <h2>Tout sur l'eau de ${esc(c.nom)}</h2>
      <div class="good-grid">
        <article class="gcard"><div class="gtop">${ico("rank")}<span class="t">Classement national</span></div>
          <b class="big">${c.rang ? rangTxt(c.rang, c.ex) : "—"}<small> sur ${fmtInt(d.noted)} communes</small></b>
          <span class="d">Note ${u.L}${prov ? ", provisoire : certains critères ne sont pas encore analysés ici" : ""}${!isMain ? ` pour ce secteur. Le classement porte sur le réseau principal de la commune` : ""}. <a href="/classement/">Voir le classement</a></span></article>
        <article class="gcard"><div class="gtop">${ico("ctrl")}<span class="t">Contrôles sanitaires</span></div>
          <b class="big">${fmtInt(u.n)}<small> analyse${u.n > 1 ? "s" : ""} en 15 mois</small></b>
          <span class="okline k-${v.k === "bad" ? "bad" : "ok"}">${v.k === "bad" ? "Au moins une limite dépassée" : "Toutes les limites respectées sur le réseau"}</span>
          <span class="d">Dernière analyse le ${dateFr(u.last)}. Eau distribuée par ${esc(u.dist)}.</span></article>
        <article class="gcard"><div class="gtop">${ico("calc")}<span class="t">Calcaire</span></div>
          <b class="big">${calc(u.th) || "Pas de mesure"}</b>
          ${u.th != null ? `<div class="seg" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i <= calcLvl(u.th) ? "on" : ""}"></i>`).join("")}</div>` : ""}
          <span class="d">Sans effet sur la santé. Il joue sur le goût et sur les traces blanches dans la bouilloire.</span></article>
        <article class="gcard"><div class="gtop">${ico("pb")}<span class="t">Plomb au robinet</span></div>
          <b class="big k-${u.pb == null ? "na" : pbHigh ? "bad" : "ok"}">${u.pb == null ? "Pas de mesure" : pbHigh ? "Au-dessus de la limite" : "Bon"}</b>
          <span class="d">${pbHigh ? "Du plomb a été trouvé au robinet d'un logement. Il vient presque toujours des vieux tuyaux de l'immeuble, pas de l'eau du réseau. En cas de doute, laissez couler l'eau quelques secondes avant de la boire." : "Il est mesuré au robinet de logements et dépend surtout des tuyaux de chaque immeuble."}</span></article>
      </div>
    </section>
    ${adSlot("city")}
    ${d.others && d.others.length ? `<section class="cmp">
      <div class="cmp-head"><h2>Comparer avec une autre commune</h2><a href="/classement/">Tout le classement</a></div>
      <div class="cmp-list">${d.others.map((r, i) => `<a class="ccard" href="${cityUrl(r[1], r[0])}" style="--i:${i}">${gr(r[2])}<span class="cn"><b>${esc(r[1])}</b><span>${r[2] ? SHORT[r[2]] : "Pas de note"}</span></span>${r[2] ? minibars(r) : ""}</a>`).join("")}</div>
      <p class="cmp-leg">Les petites barres reprennent les 4 fioles : microbes, nitrates, pesticides, polluants éternels.</p>
    </section>` : ""}
    <p class="foot">Source : contrôle sanitaire des agences régionales de santé (ministère de la Santé). Pour chaque critère, on retient la valeur la plus haute mesurée en 15 mois, jusqu'en ${moisFr(u.last)}. <a href="/a-propos/">Comment lire ces résultats</a></p>
  </div>`;
}

function renderNoData(d) {
  const c = d.c;
  return `${searchBlock(c.nom)}
  <section class="deep res-top" id="resultat"><div class="wrap res hero2"><div>
    <h1><span class="kicker">L'eau du robinet à</span>${esc(c.nom)}</h1>
    <div class="verdict" style="max-width:52ch"><h2>Pas assez d'analyses récentes.</h2><p>Aucune analyse complète n'a été publiée pour le réseau de cette commune ces 15 derniers mois. Renseignez-vous auprès de votre mairie, qui affiche les derniers résultats.</p></div>
  </div></div></section>
  <div class="wrap light"><p class="foot">Source : contrôle sanitaire des agences régionales de santé. <a href="/a-propos/">Comment lire les résultats</a></p></div>`;
}

// ---------- Classement ----------
// idx : lignes [code, nom, L, rang, b, pn, pp, pq, popK] ; st : { scope, dep, L, desc, n }
export const SCOPES = [["big", "Villes de plus de 50 000 habitants"], ["mid", "Villes de plus de 10 000 habitants"], ["all", "Toutes les communes"]];
export function rankFilter(idx, st) {
  let r = idx.filter((x) => x[2]);
  if (st.dep) r = r.filter((x) => depOf(x[0]) === st.dep);
  else if (st.scope === "big") r = r.filter((x) => x[8] >= 50);
  else if (st.scope === "mid") r = r.filter((x) => x[8] >= 10);
  return r.sort((a, b) => a[3] - b[3] || b[8] - a[8]);
}
export function rankRows(list, st) {
  let r = st.L ? list.filter((x) => x[2] === st.L) : list;
  if (!st.desc) r = r.slice().reverse();
  if (!r.length) return `<p class="empty-rk">Aucune commune avec la note ${st.L} dans cette sélection.</p>`;
  const shown = r.slice(0, st.n || 50);
  const cell = (label, v, k) => `<span class="met"><span class="ml">${label}</span><span class="mv k${k}">${v}</span><span class="mt"><i class="d-${k}" style="width:${typeof v === "string" && v.endsWith("%") ? Math.max(parseInt(v) > 0 ? 3 : 0, Math.min(parseInt(v), 100)) : v === "Aucun" ? 0 : 100}%"></i></span></span>`;
  const p = (v) => (v < 0 ? "—" : v + " %");
  const k = (v) => (v < 0 ? "na" : v > 100 ? "bad" : v > 80 ? "warn" : "ok");
  return shown.map((e, i) => (i === 5 ? adSlot("rank") : "") + `<a class="rrow" href="${cityUrl(e[1], e[0])}" style="--i:${Math.min(i, 20)}"><span class="pos">${fmtInt(e[3])}</span>${gr(e[2])}<span class="nm"><b>${esc(e[1])}</b><span>${depOf(e[0])}${e[8] ? ` · ${fmtInt(e[8] * 1000)} hab.` : ""}</span></span><span class="mets">${cell("Microbes", e[4] ? `${e[4]} fois` : "Aucun", e[4] ? "warn" : "ok")}${cell("Nitrates", p(e[5]), k(e[5]))}${cell("Pesticides", p(e[6]), k(e[6]))}${cell("Polluants éternels", p(e[7]), k(e[7]))}</span><span class="mobmb">${minibars(e)}</span>${chevR}</a>`).join("")
    + (r.length > shown.length ? `<button type="button" class="more-rows" data-more>Afficher 50 communes de plus <small>(${fmtInt(r.length - shown.length)} restantes)</small></button>` : "");
}
export function renderRanking(idx, meta, deps, st) {
  const list = rankFilter(idx, st);
  const cnt = (L) => list.filter((e) => e[2] === L).length;
  const top = list.slice(0, 3), low = list.slice(-3).reverse();
  const pc = (e) => `<a class="pcard" href="${cityUrl(e[1], e[0])}"><span class="pos-big">${rangTxt(e[3])} en France</span>${gr(e[2])}<b>${esc(e[1])}</b><span class="pd">${depOf(e[0])}</span>${minibars(e)}</a>`;
  const scopeName = st.dep ? `Département : ${esc(deps[st.dep] || st.dep)}` : SCOPES.find((s) => s[0] === st.scope)[1];
  const lowAll = low.some((e) => e[2] === "E");
  return `<section class="deep"><div class="wrap rk-hero">
      <h1>Où l'eau du robinet est-elle la meilleure&nbsp;?</h1>
      <p class="rk-sub">${fmtInt(meta.noted)} communes classées sur les mêmes 4 critères. Les communes à égalité partagent le même rang.</p>
      <div class="rk-scope">
        <label for="scope">Afficher</label>
        <select id="scope" data-scope>${SCOPES.map((s) => `<option value="${s[0]}"${!st.dep && st.scope === s[0] ? " selected" : ""}>${s[1]}</option>`).join("")}<optgroup label="Un département">${Object.entries(deps).map(([k, v]) => `<option value="dep:${k}"${st.dep === k ? " selected" : ""}>${k} · ${esc(v)}</option>`).join("")}</optgroup></select>
      </div>
      <div class="tiles" role="list" aria-label="Nombre de communes par note">${LETTERS.map((L) => `<div class="tile${cnt(L) ? "" : " zero"}" role="listitem">${gr(L)}<span class="tn"><b>${fmtInt(cnt(L))}</b> ${cnt(L) > 1 ? "communes" : "commune"}</span><span class="tl">${SHORT[L]}</span></div>`).join("")}</div>
    </div></section>
    <div class="wrap rk-body">
      ${list.length >= 6 ? `<div class="duo">
        <section><h2 class="rk-h2">Les meilleures</h2><div class="podium">${top.map(pc).join("")}</div></section>
        <section><h2 class="rk-h2">Les moins bonnes</h2><div class="podium low">${low.map(pc).join("")}</div>
          <p class="low-note">${lowAll ? "Au moins une de ces eaux a dépassé une limite de santé ces 15 derniers mois." : "Ces eaux restent potables : aucune limite de santé n'a été dépassée. Elles contiennent simplement plus de polluants que les autres."}</p></section>
      </div>` : ""}
      <div class="rk-tools">
        <h2 class="rk-h2">${scopeName}</h2>
        <div class="rk-ctrl">
          <div class="fchips" role="group" aria-label="Filtrer par note"><button type="button" data-f="" aria-pressed="${!st.L}">Toutes</button>${LETTERS.map((L) => `<button type="button" data-f="${L}" aria-pressed="${st.L === L}"${cnt(L) ? "" : " disabled"}><i class="g-${L}"></i>${L}</button>`).join("")}</div>
          <button type="button" class="sortb" data-sort>${st.desc ? "Meilleures d'abord" : "Moins bonnes d'abord"}<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg></button>
        </div>
      </div>
      <div class="rhead" aria-hidden="true"><span>Rang</span><span></span><span>Commune</span><span class="hm"><span>Microbes</span><span>Nitrates</span><span>Pesticides</span><span>Polluants éternels</span></span><span></span></div>
      <div class="rlist" id="rlist">${rankRows(list, st)}</div>
      <p class="cmp-leg">Le rang est national. Valeurs les plus hautes des 15 derniers mois, en part de la limite de santé.</p>
    </div>`;
}

// ---------- Actualités ----------
export const NEWS = [
  { date: "10 février 2026", tag: "Réglementation", titre: "Le contrôle des polluants éternels arrive sur la facture d'eau", txt: "Depuis janvier 2026, la recherche de 20 PFAS est obligatoire dans l'eau potable. Les collectivités financent ces analyses et en répercutent le coût sur les abonnés : environ 40 à 50 € hors taxes par analyse selon la FNCCR.", src: "Weka, d'après l'AFP", url: "https://www.weka.fr/actualite/sante/article/detection-des-pfas-une-nouvelle-ligne-dans-la-facture-d-eau-210502/" },
  { date: "24 décembre 2025", tag: "Réglementation", titre: "Un arrêté fixe la liste des polluants éternels à rechercher", txt: "Paru au Journal officiel, il rend obligatoire la recherche de 20 PFAS dans l'eau du robinet à partir du 12 janvier 2026. Le TFA, un polluant éternel très répandu, s'y ajoutera à partir du 1er janvier 2027.", src: "Agra, d'après le Journal officiel", url: "https://www.agra.fr/lives/pesticidespfas-le-tfa-integrera-le-controle-sanitaire-de-leau-potable-en-2027-jo" },
  { date: "23 janvier 2025", tag: "Étude", titre: "Des PFAS trouvés dans 29 communes sur 30 testées", txt: "UFC-Que Choisir et Générations futures ont analysé l'eau de 30 communes. Le TFA est présent dans 24 échantillons, mais les autres PFAS restent sous la limite française de 100 ng/L.", src: "UFC-Que Choisir", url: "https://www.quechoisir.org/action-ufc-que-choisir-polluants-eternels-dans-l-eau-du-robinet-une-large-presence-detectee-dans-96-des-communes-testees-n148808" },
];
function hbars(title, sub, rows) {
  return `<figure class="chart"><figcaption><h3>${title}</h3><p>${sub}</p></figcaption>
    <div class="hb">${rows.map((r, i) => `<a class="hb-row" href="${cityUrl(r.nom, r.code)}"><span class="hb-n">${esc(r.nom)}</span><span class="hb-t">${r.p == null ? "<em>pas encore mesuré</em>" : `<b class="d-${r.k}" data-w="${Math.max(r.p > 0 ? 1.5 : 0, Math.min(r.p, 100))}" style="width:${Math.max(r.p > 0 ? 1.5 : 0, Math.min(r.p, 100))}%;transition-delay:${i * 50}ms"></b>`}<i class="hb-lim" aria-hidden="true"></i></span><span class="hb-v"${r.p == null ? "" : ` data-to="${r.p}" data-suf=" %" data-d="${i * 50}"`}>${r.p == null ? "—" : r.p + " %"}</span></a>`).join("")}</div>
    <p class="hb-foot"><i></i>limite de santé (100 %)</p></figure>`;
}
export function renderNews(idx, meta) {
  const big = idx.filter((r) => r[2]).slice(0, 15);
  const mk = (j) => big.map((r) => ({ code: r[0], nom: r[1], p: r[j] < 0 ? null : r[j], k: r[j] < 0 ? "na" : r[j] > 100 ? "bad" : r[j] > 80 ? "warn" : "ok" })).sort((a, b) => (b.p ?? -1) - (a.p ?? -1));
  const total = LETTERS.reduce((s, L) => s + (meta.dist[L] || 0), 0);
  return `<section class="deep"><div class="wrap rk-hero">
      <h1>Actualités</h1>
      <p class="rk-sub">Ce qui change pour l'eau du robinet, et ce que disent les analyses, en chiffres et en images.</p>
    </div></section>
    <div class="wrap rk-body">
      <h2 class="rk-h2">Infographies</h2>
      <figure class="chart wide"><figcaption><h3>La qualité de l'eau en France, commune par commune</h3><p>Répartition des ${fmtInt(total)} communes notées, selon leur réseau principal.</p></figcaption>
        <div class="stack" role="img" aria-label="${LETTERS.map((L) => `${meta.dist[L] || 0} communes en ${L}`).join(", ")}">${LETTERS.map((L, i) => `<span class="g-${L}" data-w="${((meta.dist[L] || 0) / total) * 100}" style="width:${((meta.dist[L] || 0) / total) * 100}%;transition-delay:${i * 90}ms"></span>`).join("")}</div>
        <div class="stack-leg">${LETTERS.map((L) => `<span>${gr(L)}<b data-to="${Math.round(((meta.dist[L] || 0) / total) * 100)}" data-suf=" %">${Math.round(((meta.dist[L] || 0) / total) * 100)} %</b><small>${SHORT[L]}</small></span>`).join("")}</div>
      </figure>
      <div class="charts">
        ${hbars("Nitrates dans les grandes villes", "Valeur la plus haute en 15 mois, en part de la limite de 50 mg/L. Les 15 villes les plus peuplées.", mk(5))}
        ${hbars("Polluants éternels dans les grandes villes", "Somme des 20 PFAS, valeur la plus haute, en part de la limite de 0,1 µg/L.", mk(7))}
      </div>
      <p class="cmp-leg">Calculé à partir du contrôle sanitaire des agences régionales de santé, de ${moisFr(meta.start)} à ${moisFr(meta.end)}.</p>
      <h2 class="rk-h2" style="margin-top:48px">Actualités</h2>
      <div class="news">${NEWS.map((n) => `<article class="ncard"><div class="nmeta"><span class="ntag">${n.tag}</span><time>${n.date}</time></div><h3>${n.titre}</h3><p>${n.txt}</p><a href="${n.url}" target="_blank" rel="noopener">Source : ${n.src}<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a></article>`).join("")}</div>
    </div>`;
}

// ---------- À propos ----------
export function renderAbout(meta) {
  const crit = [["bact", "Microbes", "0", "Bactéries", 8], ["no3", "Nitrates", "50 mg/L", "Venus des engrais", 62], ["pe", "Pesticides", "0,5 µg/L", "Produits agricoles", 35], ["pf", "Polluants éternels", "0,1 µg/L", "PFAS", 14]];
  const tl = [["2020", "Directive européenne 2020/2184", "L'Union européenne impose de surveiller les PFAS dans l'eau potable, avec une limite de 0,1 µg/L pour la somme de 20 substances."],
    ["Février 2025", "Loi française sur les PFAS", "La loi du 27 février 2025 renforce la lutte contre les polluants éternels."],
    ["Décembre 2025", "Arrêté au Journal officiel", "Il fixe la liste des 20 PFAS que les agences régionales de santé doivent rechercher."],
    ["12 janvier 2026", "Début des contrôles", "Les 20 PFAS sont recherchés dans l'eau du robinet. Les résultats arrivent commune par commune."],
    ["1er janvier 2027", "Ajout du TFA", "Le polluant éternel le plus répandu rejoindra la liste des substances contrôlées."]];
  const pts = [["moins de 10 %", "0"], ["10 à 50 %", "0,5"], ["50 à 80 %", "1,5"], ["80 à 100 %", "3"], ["au-dessus de la limite", "6"], ["microbes trouvés", "2 par analyse"]];
  return `<section class="deep"><div class="wrap rk-hero">
      <h1>Pourquoi ce site&nbsp;?</h1>
      <p class="rk-sub">Les analyses de l'eau du robinet sont publiques, mais illisibles. Eau Arena les traduit en une réponse simple.</p>
    </div></section>
    <div class="wrap rk-body ab">
      <div class="why">
        <article class="gcard"><div class="gtop">${ico("ctrl")}<span class="t">Très contrôlée</span></div><b class="big">Des centaines d'analyses</b><span class="d">Chaque réseau d'eau est contrôlé des dizaines, parfois des centaines de fois par an par l'agence régionale de santé. Tous les résultats sont publics.</span></article>
        <article class="gcard"><div class="gtop">${ico("rank")}<span class="t">Mais illisible</span></div><b class="big">Des listes techniques</b><span class="d">Les résultats officiels sont publiés en longues listes de mesures, avec des noms de molécules et des unités que seuls les chimistes comprennent.</span></article>
        <article class="gcard"><div class="gtop">${ico("calc")}<span class="t">Notre réponse</span></div><b class="big">Une seule question</b><span class="d">« Mon eau du robinet est-elle bonne ? » Une phrase, une note de A à E et quatre critères, sans inscription et sans rien vendre.</span></article>
      </div>
      <h2 class="rk-h2 ab-h">Ce qui a changé avec les polluants éternels</h2>
      <ol class="tl">${tl.map((t, i) => `<li class="${i === 3 ? "now" : ""}"><span class="tl-d">${t[0]}</span><div><h3>${t[1]}</h3><p>${t[2]}</p></div></li>`).join("")}</ol>
      <h2 class="rk-h2 ab-h">Les quatre critères</h2>
      <p class="ab-lead">Chaque critère est comparé à sa limite de santé, fixée par la réglementation. On retient la valeur la plus haute mesurée en 15 mois.</p>
      <div class="cgrid">${crit.map((c) => `<article class="gcard ccrit"><div class="cc-top"><span class="mini-vial" aria-hidden="true"><i style="height:${c[4]}%"></i><b></b></span><div><h3>${c[1]}</h3><span class="tech2">${c[3]}</span></div></div><p class="cc-lim">Limite : <b>${c[2]}</b></p><span class="d">${EXPL[c[0]]}</span></article>`).join("")}</div>
      <p class="ab-note">mg/L : milligramme par litre, soit un millième de gramme. µg/L : microgramme par litre, soit un millionième de gramme.</p>
      <h2 class="rk-h2 ab-h">Comment lire une fiole</h2>
      <div class="read">
        <div class="read-vis" aria-hidden="true"><span class="rv"><i class="rv-ok" style="height:40%"></i><b></b></span><span class="rv"><i class="rv-warn" style="height:72%"></i><b></b></span><span class="rv"><i class="rv-bad" style="height:92%"></i><b></b></span></div>
        <ul class="read-list">
          <li><span class="sw sw-ok"></span><div><b>Bon</b><span>jusqu'à 80 % de la limite</span></div></li>
          <li><span class="sw sw-warn"></span><div><b>À surveiller</b><span>entre 80 et 100 % de la limite</span></div></li>
          <li><span class="sw sw-bad"></span><div><b>Dépassement</b><span>au-dessus du trait pointillé</span></div></li>
        </ul>
      </div>
      <h2 class="rk-h2 ab-h">La note de A à E</h2>
      <p class="ab-lead">Elle sert à comparer les communes entre elles. Elle ne dit pas à elle seule si l'eau est potable : c'est la réponse en haut de chaque page qui le dit.</p>
      <div class="note-grid">
        <div class="gcard">
          <div class="scale-big" aria-hidden="true">${LETTERS.map((L, i) => `<span class="g-${L}"><b>${L}</b><small>${["dès 9", "dès 7,5", "dès 6", "dès 4", "limite dépassée"][i]}</small></span>`).join("")}</div>
          <span class="d">Chaque eau part de 10 points. La lettre E est réservée aux eaux qui ont dépassé une limite de santé, ou qui ont perdu plus de 6 points. Quand un critère n'a pas encore été analysé, la note est dite provisoire.</span>
        </div>
        <div class="gcard"><h3 class="gh3">Points retirés</h3><dl class="ptlist">${pts.map((x) => `<div><dt>${x[0]}</dt><dd>− ${x[1]}</dd></div>`).join("")}</dl></div>
      </div>
      <h2 class="rk-h2 ab-h">Commune et réseau d'eau</h2>
      <div class="why two">
        <article class="gcard"><div class="gtop">${ico("map")}<span class="t">Un réseau, une eau</span></div><span class="d">Les analyses sont faites par « unité de distribution » : une portion de réseau où l'eau vient de la même source et reçoit le même traitement. Une commune peut être desservie par plusieurs réseaux selon le quartier.</span></article>
        <article class="gcard"><div class="gtop">${ico("ctrl")}<span class="t">Le réseau principal</span></div><span class="d">La note d'une commune est celle de son réseau le plus contrôlé : la fréquence des contrôles suit le volume d'eau distribué. Les autres réseaux restent consultables sur la page de la commune.</span></article>
      </div>
      <h2 class="rk-h2 ab-h">Ce qui n'entre pas dans la note</h2>
      <div class="why two">
        <article class="gcard"><div class="gtop">${ico("calc")}<span class="t">Calcaire</span></div><span class="d">Il n'a pas d'effet sur la santé. Il joue seulement sur le goût et sur les traces blanches dans la bouilloire.</span></article>
        <article class="gcard"><div class="gtop">${ico("pb")}<span class="t">Plomb</span></div><span class="d">Il vient surtout des vieux tuyaux de chaque immeuble, pas de l'eau du réseau. Il est mesuré au robinet de particuliers.</span></article>
      </div>
      <h2 class="rk-h2 ab-h">Nos engagements</h2>
      <ul class="pledge">${["Aucune inscription", ...(NO_COOKIE ? ["Aucun cookie", "Aucune donnée de visiteur conservée"] : []), "Aucun classement payé", "Publicité clairement signalée, sans influence sur les notes", "Uniquement des données officielles"].filter((t) => NO_COOKIE ? !t.startsWith("Publicité") : true).map((t) => `<li><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${t}</li>`).join("")}</ul>
      <p class="ab-note" style="margin-top:20px">Source des analyses : « Résultats du contrôle sanitaire de l'eau distribuée commune par commune », ministère de la Santé, publié sur data.gouv.fr sous Licence Ouverte. Période couverte : ${moisFr(meta.start)} à ${moisFr(meta.end)}.</p>
    </div>`;
}

// ---------- Titres et descriptions pour Google ----------
export function seo(kind, x) {
  const y = x?.year || "";
  switch (kind) {
    case "city": return {
      title: `Eau du robinet à ${x.nom} (${x.dep}) : qualité ${y}, note ${x.L || "—"}`,
      desc: x.L ? `L'eau du robinet à ${x.nom} est-elle bonne ? Note ${x.L}, nitrates, pesticides, polluants éternels (PFAS), microbes : les analyses officielles expliquées simplement.` : `Qualité de l'eau du robinet à ${x.nom} : analyses officielles du contrôle sanitaire.` };
    case "rank": return { title: `Classement de l'eau du robinet ${y} : les meilleures et les moins bonnes communes`, desc: "Où l'eau du robinet est-elle la meilleure ? Classement national des communes selon les analyses officielles : microbes, nitrates, pesticides, polluants éternels." };
    case "news": return { title: "Eau du robinet : actualités et infographies sur les PFAS et les nitrates", desc: "Contrôle des polluants éternels, nitrates dans les grandes villes, répartition des notes : l'actualité de l'eau du robinet en chiffres." };
    case "about": return { title: "Pourquoi ce site ? Méthode et sources", desc: "Comment Eau Arena lit les analyses officielles de l'eau du robinet : critères, limites de santé, note de A à E." };
    default: return { title: "Mon eau du robinet est-elle bonne ? Qualité de l'eau par commune", desc: "Renseignez votre commune : une réponse simple et une note de A à E, d'après les analyses officielles de l'eau du robinet. Nitrates, pesticides, PFAS." };
  }
}
