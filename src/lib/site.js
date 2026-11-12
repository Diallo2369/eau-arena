// Réglages du site, en un seul endroit.
export const SITE_NAME = "Eau Arena";
export const SITE_URL = (import.meta.env.SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
export const INDEXABLE = Boolean(SITE_URL);
// Publicité : voir src/lib/ads.js
export const CONTACT = "contact@eauarena.fr";
// Mesure d'audience Cloudflare Web Analytics : sans cookie, chiffres agrégés. Le jeton n'est pas secret
// (il apparaît dans chaque page). Chargé seulement sur le site définitif. Vide = mesure désactivée.
export const ANALYTICS_TOKEN = "378022adb7c74e9989c644ccdbdf9c55";
