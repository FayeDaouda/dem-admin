// Libellés et règles d'affichage DEM Pro partagés par la page DEM Pro et la
// fiche commerçant — une seule définition.

export const hasPaidTier = a => (a.proPlan ?? 'FREE') !== 'FREE'

export const SECTOR_LABELS = {
  commerce:     'Commerce',
  restauration: 'Restauration',
  services:     'Services',
  artisanat:    'Artisanat',
  autre:        'Autre',
}
export const SECTOR_COLORS = {
  commerce:     '#6366f1',
  restauration: '#f59e0b',
  services:     '#06b6d4',
  artisanat:    '#ec4899',
  autre:        '#8b5cf6',
}

export const VOLUME_LABELS = {
  low:    '1–4 / sem.',
  medium: '5–8 / sem.',
  high:   '9+ / sem.',
}

export const PLAN_LABELS = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' }
export const PLAN_COLORS = { FREE: '#888', PRO: '#0077b6', BUSINESS: '#6366f1' }

// Suspendu = compte désactivé, quel que soit son statut de validation (même
// règle que le filtre "Suspendus" et la carte "Actifs").
export function proStatusInfo(a) {
  if (!a.isActive) return { text: '⚠ Suspendu', color: '#ef4444' }
  if (a.proStatus === 'PENDING')  return { text: '⏳ En attente', color: '#f59e0b' }
  if (a.proStatus === 'ACTIVE')   return { text: '✓ Actif', color: '#22c55e' }
  if (a.proStatus === 'REJECTED') return { text: '✗ Refusé', color: '#ef4444' }
  return { text: a.proStatus ?? '—', color: '#888' }
}

// Libellé d'un plan, y compris ceux que la liste ci-dessus ne connaît pas
// encore (paliers Starter / Premium du nouveau système).
export const planLabel = (plan) => PLAN_LABELS[plan] ?? (plan ? plan[0] + plan.slice(1).toLowerCase() : '—')

export const PLAN_STATUS_LABELS = {
  ACTIVE: 'Actif', TRIAL: 'Essai offert', EXPIRED: 'Expiré', CANCELLED: 'Annulé',
}

// Issue réelle d'un achat d'abonnement (admin.dem-pro-accounts.service:_purchaseStatus)
export const PURCHASE_STATUS = {
  ACTIVE:          { label: 'Payé — en cours',   color: '#16a34a' },
  EXPIRED:         { label: 'Payé — expiré',     color: '#64748b' },
  PENDING_PAYMENT: { label: 'Paiement en cours', color: '#0ea5e9' },
  ABANDONED:       { label: 'Abandonné',         color: '#f59e0b' },
  FAILED:          { label: 'Paiement échoué',   color: '#ef4444' },
  NOT_STARTED:     { label: 'Jamais payé',       color: '#94a3b8' },
}

// Écritures du wallet commerçant (WalletTransaction.type)
export const WALLET_TX_LABELS = {
  CREDIT_PRO_SALE:    'Vente créditée',
  CREDIT_TOPUP:       'Paiement en ligne reçu',
  DEBIT_SUBSCRIPTION: 'Abonnement',
  DEBIT_CASHOUT:      'Retrait',
}

export const SAMIRPAY_STATUS = {
  SUCCESS: { label: 'Réussi',     color: '#16a34a' },
  PENDING: { label: 'En cours',   color: '#0ea5e9' },
  FAILED:  { label: 'Échoué',     color: '#ef4444' },
}

// Boutique en ligne (OrderRequest)
export const REQUEST_STATUS = {
  PENDING:   { label: 'En attente', color: '#f59e0b' },
  CONFIRMED: { label: 'Acceptée',   color: '#16a34a' },
  REJECTED:  { label: 'Refusée',    color: '#ef4444' },
}

// Moyen de paiement choisi par le client sur la boutique (informatif, réglé à la livraison)
export const STOREFRONT_PAYMENT_LABELS = {
  CASH: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', FREE_MONEY: 'Free Money',
}

export const SITE_ICON_LABELS = {
  store: 'Boutique', warehouse: 'Entrepôt', office: 'Bureau', home: 'Domicile', other: 'Autre',
}

// Tournées groupées (BatchOrder.status)
export const BATCH_STATUS = {
  SCHEDULED:   { label: 'Programmée',            color: '#0ea5e9' },
  PENDING:     { label: "En attente d'un livreur", color: '#f59e0b' },
  ACCEPTED:    { label: 'Acceptée',              color: '#6366f1' },
  IN_PROGRESS: { label: 'En cours',              color: '#6366f1' },
  COMPLETED:   { label: 'Terminée',              color: '#16a34a' },
  CANCELLED:   { label: 'Annulée',               color: '#ef4444' },
}
