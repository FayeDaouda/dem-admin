// Aperçu d'un rôle (Super Admin, Équipes › Rôles) : l'admin s'affiche comme
// pour ce rôle. Gardé pour l'onglet en cours (sessionStorage) ; envoyé au
// serveur par lib/api.js (en-tête X-Admin-Preview-Role), qui applique les
// droits du rôle et refuse toute action (lecture seule).
const KEY = 'dem_admin_apercu_role'

export function getPreview() {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') } catch { return null }
}

export function savePreview(role) {
  try {
    if (role) sessionStorage.setItem(KEY, JSON.stringify(role))
    else sessionStorage.removeItem(KEY)
  } catch { /* stockage indisponible : l'aperçu dure jusqu'au rechargement */ }
}
