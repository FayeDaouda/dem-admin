// Formats de l'espace web DEM Pro (français, FCFA, heure de Dakar = UTC)
export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} F`
export const fcfaLong = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`

export const phoneFmt = (p) => {
  const d = String(p ?? '').replace(/\D/g, '').replace(/^221/, '')
  return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : (p ?? '')
}

export function timeAgo(date) {
  if (!date) return ''
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000)
  if (s < 45) return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  if (s < 172800) return 'hier'
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export const dateTime = (d) => d
  ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'

export const timeOnly = (d) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
}

export const todayLabel = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// Statuts d'une course, comme dans l'app
export const ORDER_STATUS = {
  SCHEDULED:  { label: 'Programmée',         color: '#6d5dfc', bg: '#efedff', step: 0 },
  PENDING:    { label: 'Recherche coursier', color: '#d97706', bg: '#fff4e2', step: 0 },
  ACCEPTED:   { label: 'Coursier en route',  color: '#0671ba', bg: '#e6f3fb', step: 1 },
  PICKED_UP:  { label: 'Colis récupéré',     color: '#0cb8de', bg: '#e3f8fc', step: 2 },
  IN_TRANSIT: { label: 'En livraison',       color: '#0cb8de', bg: '#e3f8fc', step: 2 },
  DELIVERED:  { label: 'Livrée',             color: '#16a34a', bg: '#e8f7ee', step: 3 },
  CANCELLED:  { label: 'Annulée',            color: '#dc2626', bg: '#fdecec', step: -1 },
}
export const ACTIVE_STATUSES = new Set(['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'SCHEDULED'])
export const orderTotal = (o) => (Number(o?.price) || 0) + (Number(o?.demFee) || 0) - (Number(o?.discountAmount) || 0)

export const planName = (p) => ({ PREMIUM: 'Offre Premium', BUSINESS: 'Offre Business', STARTER: 'Offre Starter', PRO: 'Offre Pro' })[p] ?? 'Offre gratuite'

// Lien de commande public du commerçant (même lien que dans l'app)
export const orderLink = (userId) => `https://www.dem.sn/commander/${userId}`
