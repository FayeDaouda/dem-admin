// Formats d'affichage partagés par les pages admin — montants toujours au
// franc près (jamais arrondis au millier : un "0k" masquait des montants
// réels de quelques centaines de francs).

export const formatF = (v) => `${Math.round(v ?? 0).toLocaleString('fr-FR')} F`

// Graduations d'axe de graphique (compactes, le détail exact est dans le tooltip)
export const formatAxisF = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000).toLocaleString('fr-FR')}k` : `${v}`)

export const formatCount = (v) => Math.round(v ?? 0).toLocaleString('fr-FR')

// Canal d'encaissement d'une course livrée — voir
// dem-backend/src/modules/admin/admin.kpi-definitions.js:paymentChannelOf
export const CHANNEL_LABELS = {
  ONLINE:   'Payée en ligne',
  CASH:     'Cash (livreur)',
  UNPAID:   'Non payée',
  DISPUTED: 'Litige',
}

export const CHANNEL_BADGE_STATUS = {
  ONLINE: 'PAID', CASH: 'DELIVERED', UNPAID: 'PENDING', DISPUTED: 'DISPUTED',
}

export const OPERATOR_LABELS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }
