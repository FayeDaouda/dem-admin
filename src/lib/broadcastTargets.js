// Cibles des notifications admin : 'all' ou profils séparés par des
// virgules ('clients,dem_pro') — même format que le serveur
// (admin.broadcast.service.js:normalizeTarget).
export const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Coursiers', dem_pro: 'DEM Pro', chefs: 'Chefs de flotte' }

// 'clients,dem_pro' → 'Clients + DEM Pro' ; 'segment:<id>' → nom du segment
// s'il est connu (segmentName de l'envoi), sinon « Segment de clients »
export function targetLabel(target, segmentName = null) {
  if (!target || target === 'all') return 'Tous'
  if (String(target).startsWith('segment:')) return segmentName ? `Segment « ${segmentName} »` : 'Segment de clients'
  return String(target).split(',').map(t => TARGET_LABELS[t] ?? t).join(' + ')
}
