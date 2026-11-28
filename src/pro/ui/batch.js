import { orderTotal } from '../lib/format'

// Tournées groupées (envoi groupé, 2 à 5 arrêts) : statuts, montants et
// règles, partagés entre la liste/suivi (Batches.jsx) et la création
// (NewBatch.jsx). Mêmes règles que l'app (dem_pro_batch_*_screen.dart).
// Composants (badges, carte) : batchKit.jsx.

export const MIN_STOPS = 2
export const MAX_STOPS = 5

// Statut d'une tournée (BatchOrder.status) — paires texte foncé / fond clair
export const BATCH_STATUS = {
  SCHEDULED:   { label: 'Programmée',         color: '#475569', bg: '#F1F5F9' },
  PENDING:     { label: 'Recherche coursier', color: '#B45309', bg: '#FFF7ED' },
  ACCEPTED:    { label: 'Coursier en route',  color: '#0E6F87', bg: '#E6F7FB' },
  IN_PROGRESS: { label: 'En livraison',       color: '#0E6F87', bg: '#E6F7FB' },
  COMPLETED:   { label: 'Terminée',           color: '#15803D', bg: '#ECFDF3' },
  CANCELLED:   { label: 'Annulée',            color: '#B91C1C', bg: '#FEF2F2' },
}
export const BATCH_ACTIVE = new Set(['PENDING', 'ACCEPTED', 'IN_PROGRESS'])
// Annulable par le commerçant (batch.service.js:cancelBatch) — en ACCEPTED,
// le serveur refuse encore si le coursier est déjà au point de retrait.
export const BATCH_CANCELLABLE = new Set(['PENDING', 'SCHEDULED', 'ACCEPTED'])

// Statut d'un arrêt (Order.status)
export const STOP_STATUS = {
  SCHEDULED:  { label: 'Programmé',      color: '#475569', bg: '#F1F5F9' },
  PENDING:    { label: 'En attente',     color: '#475569', bg: '#F1F5F9' },
  ACCEPTED:   { label: 'Pris en charge', color: '#0E6F87', bg: '#E6F7FB' },
  PICKED_UP:  { label: 'Récupéré',       color: '#0E6F87', bg: '#E6F7FB' },
  IN_TRANSIT: { label: 'En route',       color: '#0E6F87', bg: '#E6F7FB' },
  DELIVERED:  { label: 'Livré',          color: '#15803D', bg: '#ECFDF3' },
  CANCELLED:  { label: 'Annulé',         color: '#B91C1C', bg: '#FEF2F2' },
}

// Total facturé : totalPrice (net de toute réduction) + frais DEM, jamais
// totalPrice seul (price_format.dart:batchChargeFor)
export const batchTotal = (b) => Math.max(0, (Number(b?.totalPrice ?? b?.total) || 0) + (Number(b?.demFee) || 0))
// Montant d'un arrêt, demandé au destinataire par le coursier
export const stopTotal = (o) => Math.max(0, orderTotal(o))

export const shortRef = (id) => String(id ?? '').slice(0, 8).toUpperCase()
export const sortedStops = (b) => [...(b?.orders ?? [])].sort((a, z) => (a.sequenceIndex ?? 0) - (z.sequenceIndex ?? 0))

// Une tournée « programmée » peut aussi être PENDING avec une heure future
export const isScheduled = (b) => b?.status === 'SCHEDULED' || (b?.status === 'PENDING' && !!b?.scheduledAt && new Date(b.scheduledAt) > new Date())

// Colis : même liste que l'app (_pkgTypes), écrite dans la description
export const PKG_TYPES = [
  ['documents', 'Documents'],
  ['small', 'Petit colis'],
  ['large', 'Grand colis'],
]

// Motifs d'annulation d'une tournée (cancel_reasons.dart:kDemProBatchCancelReasons)
export const BATCH_CANCEL_REASONS = [
  ['CUSTOMER_CANCELLED', 'Mes clients ont annulé'],
  ['OUT_OF_STOCK', 'Articles indisponibles'],
  ['TOO_LONG', 'L\'attente est trop longue'],
  ['WRONG_ADDRESS', 'Erreur d\'adresse ou de destinataire'],
  ['ORDER_MISTAKE', 'Tournée créée par erreur'],
  ['OTHER', 'Autre raison'],
]
