// Statut affiché d'un chef de flotte et d'un coursier de sa flotte — partagé
// par la liste et la fiche des chefs de flotte.

const CHEF_STATUS = {
  PENDING:  { text: 'En attente', color: '#b45309', bg: 'rgba(245,158,11,.14)' },
  ACTIVE:   { text: 'Actif',      color: '#15803d', bg: 'rgba(34,197,94,.12)' },
  REJECTED: { text: 'Refusé',     color: '#dc2626', bg: 'rgba(239,68,68,.12)' },
}
const SUSPENDED = { text: 'Suspendu', color: '#dc2626', bg: 'rgba(239,68,68,.12)' }

export function chefStatusInfo(c) {
  if (!c.isActive) return SUSPENDED
  return CHEF_STATUS[c.chefDeFlotteStatus] ?? { text: c.chefDeFlotteStatus ?? '—', color: '#888', bg: 'rgba(0,0,0,.06)' }
}

export function driverStatusInfo(d) {
  if (d.chefDeFlotteStatus === 'PENDING')  return CHEF_STATUS.PENDING
  if (d.chefDeFlotteStatus === 'REJECTED') return CHEF_STATUS.REJECTED
  if (d.chefDeFlotteStatus === 'ACTIVE' && !d.isActive) return SUSPENDED
  if (d.chefDeFlotteStatus === 'ACTIVE')   return CHEF_STATUS.ACTIVE
  return { text: d.chefDeFlotteStatus ?? '—', color: '#888', bg: 'rgba(0,0,0,.06)' }
}
