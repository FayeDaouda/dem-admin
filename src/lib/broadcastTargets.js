// Cibles des notifications admin : 'all' ou profils séparés par des
// virgules ('clients,dem_pro') — même format que le serveur
// (admin.broadcast.service.js:normalizeTarget).
export const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Livreurs', dem_pro: 'DEM Pro', chefs: 'Chefs de flotte' }

// 'clients,dem_pro' → 'Clients + DEM Pro'
export function targetLabel(target) {
  if (!target || target === 'all') return 'Tous'
  return String(target).split(',').map(t => TARGET_LABELS[t] ?? t).join(' + ')
}
