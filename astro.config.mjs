import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Adresse définitive du site, à fournir au moment de la publication (variable SITE_URL).
// Sans elle, le site se construit sans plan du site ni adresses canoniques,
// et toutes les pages portent « noindex » : on ne risque pas de faire indexer une adresse provisoire.
const SITE_URL = process.env.SITE_URL || "";

export default defineConfig({
  site: SITE_URL || undefined,
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "never" },
  compressHTML: true,
  prefetch: false,
  integrations: SITE_URL ? [sitemap({ filter: (p) => !p.endsWith("/404/") })] : [],
  vite: { build: { assetsInlineLimit: 0 } },
});
