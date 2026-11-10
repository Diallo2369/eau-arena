// Navigation dans le navigateur : une fois le site ouvert, changer de page ne recharge rien.
// Les pages sont reconstruites ici avec les mêmes fonctions que celles de la construction (lib/core.js).
// Données : l'index des communes est chargé en tâche de fond ; le détail d'une commune vient du fichier
// de son département, chargé à l'arrivée sur la commune (ou en avance, au survol d'un lien).
import { renderHome, renderCity, renderRanking, rankFilter, rankRows, renderNews, renderAbout, cityFromDep, seo,
  depOf, norm, esc, gr, cityUrl } from "../lib/core.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const boot = JSON.parse($("#boot").textContent);
const app = $("#app");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Données ----------
let indexP = null;
let deps = {};
const loadIndex = () => (indexP ||= fetch("/data/index.json").then((r) => { if (!r.ok) throw r; return r.json(); }).then((j) => { deps = j.deps; return j.c; }).catch((e) => { indexP = null; throw e; }));
const depP = {};
const loadDep = (dep) => (depP[dep] ||= fetch(`/data/dep/${dep}.json`).then((r) => { if (!r.ok) throw r; return r.json(); }).catch((e) => { delete depP[dep]; throw e; }));
const codeFromPath = (p) => { const m = p.match(/^\/eau\/[a-z0-9-]*-([0-9a-z]{5})\/$/); return m ? m[1].toUpperCase() : null; };
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
idle(() => loadIndex().catch(() => {}));

// ---------- État des pages ----------
let city = null;            // { code, c, u, others, pick, sect }
const rankSt = { scope: "big", dep: "", L: "", desc: true, n: 50 };

// ---------- Routes ----------
function routeOf(path) {
  if (path === "/") return "home";
  if (path === "/classement/") return "rank";
  if (path === "/actualites/") return "news";
  if (path === "/a-propos/") return "about";
  if (codeFromPath(path)) return "city";
  return null;
}
function setHead(t, d) {
  document.title = t.includes("Eau Arena") || routeOf(location.pathname) === "home" ? t : `${t} | Eau Arena`;
  const m = $('meta[name="description"]'); if (m) m.setAttribute("content", d);
  const can = $('link[rel="canonical"]'); if (can) can.href = can.href.replace(/^(https?:\/\/[^/]+).*$/, "$1") + location.pathname;
}
function setNav(page) {
  document.body.dataset.page = page;
  $$("[data-nav]").forEach((a) => a.setAttribute("aria-current", a.dataset.nav === page ? "page" : "false"));
}

let loadingT;
function loading(on) {
  let b = $(".loading-bar");
  if (!b) { b = document.createElement("div"); b.className = "loading-bar"; document.body.append(b); }
  clearTimeout(loadingT);
  if (on) loadingT = setTimeout(() => { b.style.opacity = 1; b.style.width = "70%"; }, 120); // seulement si c'est lent
  else { b.style.width = "100%"; setTimeout(() => { b.style.opacity = 0; b.style.width = "0"; }, 200); }
}

async function render(path, { push = false, scrollTo = "top", hash = "" } = {}) {
  const page = routeOf(path);
  if (!page) { location.href = path; return; }
  loading(true);
  try {
    let html, head;
    if (page === "home") { html = renderHome(boot.popular); head = seo("home"); }
    else if (page === "about") { html = renderAbout(boot.meta); head = seo("about"); }
    else if (page === "news") { const idx = await loadIndex(); html = renderNews(idx, boot.meta); head = seo("news"); }
    else if (page === "rank") { const idx = await loadIndex(); html = renderRanking(idx, boot.meta, deps, rankSt); head = seo("rank", { year: boot.meta.end.slice(0, 4) }); }
    else {
      const code = codeFromPath(path);
      const d = cityFromDep(await loadDep(depOf(code)), code);
      if (!d) { location.href = path; return; }
      city = { code, ...d, pick: null, sect: null };
      html = renderCity({ ...city, noted: boot.meta.noted });
      const u = d.c.main ? d.u[d.c.main] : null;
      head = seo("city", { nom: d.c.nom, dep: d.c.dep, L: u?.L, year: boot.meta.end.slice(0, 4) });
    }
    if (push) history.pushState({}, "", path + hash);
    app.innerHTML = html;
    setHead(head.title, head.desc);
    setNav(page);
    enter(page);
    if (scrollTo === "result" && $("#resultat")) $("#resultat").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    else if (hash && $(hash)) $(hash).scrollIntoView();
    else window.scrollTo(0, 0);
    if (scrollTo !== "result") app.focus({ preventScroll: true });
  } catch (e) {
    location.href = path; // en cas de souci réseau, on retombe sur la vraie page
  } finally { loading(false); }
}

// Liens internes : on intercepte le clic
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]");
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !routeOf(url.pathname)) return;
  if (url.pathname === location.pathname && url.hash) return; // ancre dans la page
  e.preventDefault();
  closeMenu();
  const fromSearch = !!a.closest(".sugg, .pop") || (routeOf(url.pathname) === "city" && routeOf(location.pathname) === "city" && !!a.closest(".cmp"));
  render(url.pathname, { push: true, scrollTo: fromSearch ? "result" : "top", hash: url.hash });
});
window.addEventListener("popstate", () => render(location.pathname, { scrollTo: "top" }));

// Préchargement : au survol ou au focus d'un lien de commune, on charge son département
const warm = (e) => {
  const a = e.target.closest && e.target.closest("a[href^='/eau/']");
  if (a) { const c = codeFromPath(new URL(a.href).pathname); if (c) loadDep(depOf(c)).catch(() => {}); }
};
document.addEventListener("pointerover", warm, { passive: true });
document.addEventListener("focusin", warm);

// ---------- Comportements de chaque page ----------
function enter(page) {
  app.classList.remove("anim"); void app.offsetWidth; app.classList.add("anim");
  if (page === "home" || page === "city") bindSearch();
  if (page === "city") { bindCity(); fill(); }
  if (page === "rank") bindRank();
  if (page === "news") animBars();
}

function bindSearch() {
  const form = $("[data-search]"), q = $("#q"), sg = $("#sugg");
  if (!form) return;
  let act = -1, items = [];
  const draw = async () => {
    const n = norm(q.value.trim());
    if (!n) { sg.hidden = true; q.setAttribute("aria-expanded", "false"); return; }
    let idx;
    try { idx = await loadIndex(); } catch { sg.innerHTML = '<p class="empty">Recherche indisponible pour le moment. Réessayez dans un instant.</p>'; sg.hidden = false; return; }
    if (norm(q.value.trim()) !== n) return;
    const starts = [], contains = [];
    for (const r of idx) {
      const k = norm(r[1]);
      if (k.startsWith(n) || r[0].startsWith(n)) starts.push(r); else if (n.length > 2 && k.includes(n)) contains.push(r);
      if (starts.length >= 8) break;
    }
    items = starts.concat(contains).slice(0, 8);
    act = Math.min(act, items.length - 1);
    sg.innerHTML = items.length ? items.map((r, i) => `<a role="option" class="${i === act ? "active" : ""}" href="${cityUrl(r[1], r[0])}" aria-selected="${i === act}"><span class="n"><b>${esc(r[1])}</b><span>${depLabel(r[0])}</span></span>${gr(r[2] || null)}</a>`).join("")
      : '<p class="empty">Aucune commune ne correspond. Vérifiez l\'orthographe ou tapez le code postal de la commune.</p>';
    sg.hidden = false; q.setAttribute("aria-expanded", "true");
    if (items[0]) loadDep(depOf(items[Math.max(act, 0)][0])).catch(() => {});
  };
  q.addEventListener("input", () => { act = -1; draw(); });
  q.addEventListener("focus", () => { loadIndex().catch(() => {}); if (q.value && q.closest(".compact")) q.select(); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && items.length) { act = Math.min(act + 1, items.length - 1); draw(); e.preventDefault(); }
    else if (e.key === "ArrowUp" && items.length) { act = Math.max(act - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === "Escape") { sg.hidden = true; q.setAttribute("aria-expanded", "false"); }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (items.length) render(cityUrl(items[Math.max(act, 0)][1], items[Math.max(act, 0)][0]), { push: true, scrollTo: "result" });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-search]")) sg.hidden = true; });
}
const depLabel = (code) => { const d = depOf(code); return deps[d] ? `${deps[d]} (${d})` : d; };

function bindCity() {
  if (!city) {
    const pd = $("#pd"); if (!pd) return;
    const d = JSON.parse(pd.textContent); city = { ...d, pick: null, sect: null };
  }
  const rerender = (keepFocus) => {
    const y = window.scrollY;
    app.innerHTML = renderCity({ ...city, noted: boot.meta.noted });
    bindSearch(); bindCity(); settle();
    window.scrollTo(0, y);
    if (keepFocus) { const el = $(keepFocus); if (el) el.focus({ preventScroll: true }); }
  };
  $$("[data-pick]").forEach((b) => (b.onclick = () => { city.pick = b.dataset.pick; app.classList.remove("anim"); rerender(`[data-pick="${b.dataset.pick}"]`); }));
  $$("[data-sect]").forEach((b) => (b.onclick = () => { city.sect = b.dataset.sect; city.pick = null; app.classList.remove("anim"); rerender(`[data-sect="${b.dataset.sect}"]`); fill(); $("#resultat").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }));
  const f = $("[data-fiche]"); if (f) f.onclick = () => $("#fiche").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

async function bindRank() {
  const idx = await loadIndex().catch(() => null);
  if (!idx) return;
  const redraw = (full) => {
    if (full) { app.innerHTML = renderRanking(idx, boot.meta, deps, rankSt); app.classList.remove("anim"); bindRank(); return; }
    $("#rlist").innerHTML = rankRows(rankFilter(idx, rankSt), rankSt); bindMore();
    $$("[data-f]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === rankSt.L));
    $("[data-sort]").firstChild.textContent = rankSt.desc ? "Meilleures d'abord" : "Moins bonnes d'abord";
  };
  const bindMore = () => { const m = $("[data-more]"); if (m) m.onclick = () => { rankSt.n += 50; redraw(); }; };
  $$("[data-f]").forEach((b) => (b.onclick = () => { rankSt.L = b.dataset.f; rankSt.n = 50; redraw(); }));
  $("[data-sort]").onclick = () => { rankSt.desc = !rankSt.desc; rankSt.n = 50; redraw(); };
  $("[data-scope]").onchange = (e) => { const v = e.target.value; if (v.startsWith("dep:")) { rankSt.dep = v.slice(4); } else { rankSt.dep = ""; rankSt.scope = v; } rankSt.L = ""; rankSt.n = 50; redraw(true); };
  bindMore();
}

// ---------- Animations ----------
function countUp(nodes, dur = 1200) {
  if (!nodes.length) return;
  nodes.forEach((n) => (n.textContent = "0" + n.dataset.suf));
  const t0 = performance.now(), ease = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    let done = true;
    nodes.forEach((n) => { if (!n.isConnected) return; const t = Math.min(1, Math.max(0, (now - t0 - (+n.dataset.d || 0)) / dur)); if (t < 1) done = false; n.textContent = Math.round(+n.dataset.to * ease(t)) + n.dataset.suf; });
    if (!done) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function settle() { $$(".liquid").forEach((l) => { l.style.transition = "none"; l.style.height = l.dataset.h + "%"; }); }
function fill() {
  if (reduced) return settle();
  const nums = $$(".tube .num[data-to]");
  nums.forEach((n) => (n.textContent = "0" + n.dataset.suf));
  requestAnimationFrame(() => requestAnimationFrame(() => { $$(".liquid").forEach((l) => (l.style.height = l.dataset.h + "%")); countUp(nums); }));
}
function animBars() {
  const bars = $$("[data-w]");
  if (reduced) return;
  bars.forEach((b) => (b.style.width = "0"));
  requestAnimationFrame(() => requestAnimationFrame(() => { bars.forEach((b) => (b.style.width = b.dataset.w + "%")); countUp($$(".hb-v[data-to], .stack-leg b[data-to]"), 1100); }));
}

// ---------- Menu et barre du haut ----------
const mnav = $("#mnav"), mb = $("#menuBtn");
function closeMenu() { if (!mnav.hidden) { mnav.hidden = true; mb.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; } }
mb.onclick = () => { mnav.hidden = false; mb.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; $("#menuX").focus(); };
$("#menuX").onclick = () => { closeMenu(); mb.focus(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !mnav.hidden) { closeMenu(); mb.focus(); } });
let lastY = 0;
window.addEventListener("scroll", () => {
  const y = window.scrollY, bar = $(".bar");
  bar.classList.toggle("scrolled", y > 8);
  if (y > 160 && y > lastY + 4) bar.classList.add("hide"); else if (y < lastY - 4 || y < 160) bar.classList.remove("hide");
  lastY = y;
}, { passive: true });

// Première page : déjà affichée par le serveur, on ajoute seulement les comportements
history.replaceState({}, "", location.href);
enter(routeOf(location.pathname) || "other");
