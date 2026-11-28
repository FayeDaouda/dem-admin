// Préférences de l'espace web DEM Pro gardées dans ce navigateur (vue des
// commandes, son du comptoir, liste de démarrage). Le stockage peut être
// refusé (navigation privée, données bloquées) : chaque accès est protégé et
// l'écran fonctionne sans.
export const PREF = {
  requestsView: 'dem-pro:requests-view',   // 'list' | 'board'
  sound: 'dem-pro:counter-sound',          // 'on' | 'off' (absent : pas encore choisi)
  startHidden: (id) => `dem-pro:start-hidden:${id ?? 'x'}`,
  shopShared: (id) => `dem-pro:shop-shared:${id ?? 'x'}`,
}

export function readPref(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key)
    return v == null ? fallback : v
  } catch { return fallback }
}

export function writePref(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(value))
  } catch { /* stockage indisponible : préférence pour cette visite seulement */ }
}

// Lien de la boutique partagé ou copié depuis ce navigateur (liste de démarrage)
export function markShopShared(userId) {
  writePref(PREF.shopShared(userId), '1')
  try { window.dispatchEvent(new CustomEvent('dem-pro:shop-shared')) } catch { /* ignoré */ }
}
