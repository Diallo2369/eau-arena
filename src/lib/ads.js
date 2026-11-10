// Publicité : tout se règle ici. Le jour du lancement :
//   1. enabled: true
//   2. client : l'identifiant AdSense (ca-pub-…), slots : l'identifiant de chaque bloc créé dans AdSense
//   3. vérifier que l'outil de consentement certifié de Google est activé dans AdSense (bandeau cookies)
//   4. compléter les mentions légales (éditeur, SIREN, hébergeur)
// Les textes « aucun cookie » du site s'adaptent automatiquement.
export const ADS = {
  enabled: false,
  client: "",          // ex. "ca-pub-1234567890123456"
  slots: {
    city: "",          // page commune : entre « Tout sur l'eau de… » et « Comparer »
    rank: "",          // classement : après la 5e commune de la liste
  },
};

// Emplacements fixes, un par écran au plus, toujours marqués « Annonce ». Pas d'annonces automatiques.
export function adSlot(key) {
  if (!ADS.enabled || !ADS.client || !ADS.slots[key]) return "";
  return `<aside class="ad" aria-label="Annonce"><span class="ad-l">Annonce</span><ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.client}" data-ad-slot="${ADS.slots[key]}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
}
export const NO_COOKIE = !ADS.enabled;
