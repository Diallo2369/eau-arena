// Réglages du site, en un seul endroit.
export const SITE_NAME = "Eau Arena";
export const SITE_URL = (import.meta.env.SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
export const INDEXABLE = Boolean(SITE_URL);
// Publicité : voir src/lib/ads.js
export const CONTACT = "contact@eauarena.fr";
