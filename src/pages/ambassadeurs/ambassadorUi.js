// Libellés et formats partagés de la page Ambassadeurs
export const STATUS = {
  PENDING:   { label: 'À valider', color: '#b45309', bg: '#fff7ed' },
  ACTIVE:    { label: 'Actif',     color: '#15803d', bg: '#ecfdf3' },
  REJECTED:  { label: 'Refusé',    color: '#b91c1c', bg: '#fef2f2' },
  SUSPENDED: { label: 'Suspendu',  color: '#475569', bg: '#f1f5f9' },
}
export const MEDAL = {
  START:  { label: 'Démarrage', emoji: '🚀' },
  BRONZE: { label: 'Bronze',    emoji: '🥉' },
  SILVER: { label: 'Argent',    emoji: '🥈' },
  GOLD:   { label: 'Or',        emoji: '🥇' },
}
export const GAIN_STATUS = {
  PENDING:   { label: 'En vérification', color: '#b45309' },
  AVAILABLE: { label: 'Versé au wallet', color: '#15803d' },
  CANCELLED: { label: 'Annulé',          color: '#b91c1c' },
}
export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} F`
export const dateShort = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dakar' }) : '—')
export const gainLabel = (g) => (g.kind === 'MEDAL' ? `Médaille ${MEDAL[g.code]?.label ?? g.code}` : 'Booster réussi')
