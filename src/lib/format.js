// Formats d'affichage partagés par les pages admin — montants toujours au
// franc près (jamais arrondis au millier : un "0k" masquait des montants
// réels de quelques centaines de francs).

export const formatF = (v) => `${Math.round(v ?? 0).toLocaleString('fr-FR')} F`

// Graduations d'axe de graphique (compactes, le détail exact est dans le tooltip)
// Sous 10 000, une décimale : 1 500 → « 1,5k » (et non « 2k », qui doublait
// la graduation 2 000).
export const formatAxisF = (v) => {
  if (Math.abs(v) < 1000) return `${v}`
  const k = v / 1000
  return `${k.toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(k) < 10 ? 1 : 0 })}k`
}

export const formatCount = (v) => Math.round(v ?? 0).toLocaleString('fr-FR')

// Heures pleines écoulées depuis une date (« en vérification depuis 15 h »).
export const hoursSince = (date, now = Date.now()) => Math.floor((now - new Date(date).getTime()) / 3_600_000)

// Canal d'encaissement d'une course livrée — voir
// dem-backend/src/modules/admin/admin.kpi-definitions.js:paymentChannelOf
export const CHANNEL_LABELS = {
  ONLINE:   'Payée en ligne',
  CASH:     'Cash (coursier)',
  UNPAID:   'Non payée',
  DISPUTED: 'Litige',
}

export const CHANNEL_BADGE_STATUS = {
  ONLINE: 'PAID', CASH: 'DELIVERED', UNPAID: 'PENDING', DISPUTED: 'DISPUTED',
}

export const OPERATOR_LABELS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }
