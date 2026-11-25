// Formats de l'espace web DEM Pro (français, FCFA, heure de Dakar = UTC)
// fr-FR sépare les milliers par une espace fine (U+202F), quasi invisible
// en DM Sans gras : on la remplace par une espace insécable normale.
export const num = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, '\u00a0')
export const fcfa = (n) => `${num(n)}\u00a0F`
export const fcfaLong = (n) => `${num(n)}\u00a0FCFA`

export const phoneFmt = (p) => {
  const d = String(p ?? '').replace(/\D/g, '').replace(/^221/, '')
  return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : (p ?? '')
}

// Heure de Dakar (UTC, sans heure d'été) — la même que le serveur, quel que
// soit le réglage de l'ordinateur (un PC réglé sur Paris décalait les jours)
export const TZ = 'Africa/Dakar'
// Jour à Dakar, « AAAA-MM-JJ » (clé de regroupement)
export const dakarDay = (d = Date.now()) => new Date(d).toISOString().slice(0, 10)
// Minuit à Dakar, il y a `daysAgo` jours
export const dakarMidnight = (daysAgo = 0) => {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - daysAgo))
}
// Champ « date et heure » du navigateur lu et écrit en heure de Dakar
export const dakarInputToISO = (v) => (v ? new Date(`${v}:00Z`).toISOString() : null)
export const isoToDakarInput = (d) => new Date(d).toISOString().slice(0, 16)

// Pourcentage reçu du serveur, déjà en % arrondi au dixième (0,5 = 0,5 %) —
// dem_pro.service.js:getBusinessInsights. Ne jamais le multiplier par 100.
export const pctOf = (r) => {
  const n = Number(r) || 0
  return n > 0 && n < 10 ? Math.round(n * 10) / 10 : Math.round(n)
}

export function timeAgo(date) {
  if (!date) return ''
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000)
  if (s < 45) return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  if (s < 172800) return 'hier'
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ })
}

export const dateTime = (d) => d
  ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })
  : '—'

export const timeOnly = (d) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—'

export function greeting() {
  const h = new Date().getUTCHours()
  return h < 18 ? 'Bonjour' : 'Bonsoir'
}

export const todayLabel = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })

// Statuts d'une course, comme dans l'app — paires texte foncé / fond clair
// (contraste AA), sans violet
export const ORDER_STATUS = {
  SCHEDULED:  { label: 'Programmée',         color: '#475569', bg: '#F1F5F9', step: 0 },
  PENDING:    { label: 'Recherche coursier', color: '#B45309', bg: '#FFF7ED', step: 0 },
  ACCEPTED:   { label: 'Coursier en route',  color: '#0E6F87', bg: '#E6F7FB', step: 1 },
  PICKED_UP:  { label: 'Colis récupéré',     color: '#0E6F87', bg: '#E6F7FB', step: 2 },
  IN_TRANSIT: { label: 'En livraison',       color: '#0E6F87', bg: '#E6F7FB', step: 2 },
  DELIVERED:  { label: 'Livrée',             color: '#15803D', bg: '#ECFDF3', step: 3 },
  CANCELLED:  { label: 'Annulée',            color: '#B91C1C', bg: '#FEF2F2', step: -1 },
}
export const ACTIVE_STATUSES = new Set(['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'SCHEDULED'])
export const orderTotal = (o) => (Number(o?.price) || 0) + (Number(o?.demFee) || 0) - (Number(o?.discountAmount) || 0)

export const planName = (p) => ({ PREMIUM: 'Offre Premium', BUSINESS: 'Offre Business', STARTER: 'Offre Starter', PRO: 'Offre Pro' })[p] ?? 'Offre gratuite'

// Lien de commande public du commerçant (même lien que dans l'app)
// Lien public de la boutique (site dem.sn). VITE_SHOP_URL permet de pointer
// vers le site lancé en local pendant les tests.
const SHOP_URL = (import.meta.env?.VITE_SHOP_URL || 'https://www.dem.sn').replace(/\/$/, '')
export const orderLink = (userId) => `${SHOP_URL}/commander/${userId}`
