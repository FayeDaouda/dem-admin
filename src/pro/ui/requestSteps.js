import { Check, ChefHat, PackageCheck, Truck } from 'lucide-react'

// Étapes des commandes reçues (logique commune à la liste et au tableau).
// Badges et barre d'étapes : ui/RequestBadges.jsx.

// Commandes reçues par le lien de la boutique, par étape — mêmes étapes que
// l'app 1.2.5 (dem_pro_order_requests_screen.dart) et que le serveur
// (dem_pro.service.js:requestStep) :
//   NEW → (Accepter) CONFIRMED → PREPARING → READY → (Lancer la livraison)
//   IN_DELIVERY → DELIVERED ; refusée ou annulée : CANCELLED.
const DELIVERED = new Set(['DELIVERED', 'COMPLETED'])
// Étape : donnée par le serveur ; à défaut (ancien serveur), déduite du statut
export const stepOf = (r) => r.step ?? ({
  PENDING: 'NEW',
  ACCEPTED: r.prepStage === 'READY' ? 'READY' : r.prepStage === 'PREPARING' ? 'PREPARING' : 'CONFIRMED',
  CONFIRMED: DELIVERED.has(r.orderStatus) ? 'DELIVERED' : 'IN_DELIVERY',
}[r.status ?? 'PENDING'] ?? 'CANCELLED')
export const STEP_LABEL = {
  NEW: 'Nouvelle', CONFIRMED: 'Acceptée', PREPARING: 'En préparation', READY: 'Prête',
  IN_DELIVERY: 'En livraison', DELIVERED: 'Livrée', CANCELLED: 'Refusée ou annulée',
}
export const PREP = ['CONFIRMED', 'PREPARING', 'READY']

export const itemCount = (r) => (r.items ?? []).reduce((s, it) => s + (Number(it.quantity) || 1), 0)
export const articlesTotal = (r) => r.productAmount ?? r.total ?? (r.items ?? []).reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0)
// Prix complet (lien au prix complet) : livraison figée à la commande du client
export const deliveryOf = (r) => r.deliveryQuote ?? r.delivery ?? null
export const grandTotal = (r) => r.totalAmount ?? (deliveryOf(r) ? articlesTotal(r) + (Number(deliveryOf(r).total) || 0) : null)
export const lastAt = (r) => r.readyAt ?? r.preparingAt ?? r.acceptedAt ?? r.updatedAt ?? r.createdAt

// Action principale selon l'étape (tableau, carte et panneau)
export function nextAction(step) {
  if (step === 'NEW') return { kind: 'accept', label: 'Accepter', icon: Check }
  if (step === 'CONFIRMED') return { kind: 'PREPARING', label: 'Commencer la préparation', icon: ChefHat }
  if (step === 'PREPARING') return { kind: 'READY', label: 'Marquer prête', icon: PackageCheck }
  if (step === 'READY') return { kind: 'launch', label: 'Lancer la livraison', icon: Truck }
  return null
}

// Ordre des étapes du tableau ; « DONE » = colonne Terminées
const RANK = { NEW: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, IN_DELIVERY: 4, DELIVERED: 5, CANCELLED: 5, DONE: 5 }
// Déplacement permis ? Seulement vers l'avant, tant que la livraison n'est
// pas lancée ; « Terminées » se remplit toute seule (livrée, refusée).
export function moveRule(step, target) {
  if (target === step || (target === 'DONE' && RANK[step] === 5)) return { ok: false, same: true }
  if (step === 'IN_DELIVERY') return { ok: false, why: 'La livraison est lancée : la commande avance toute seule avec le coursier.' }
  if (RANK[step] === 5) return { ok: false, why: 'Cette commande est terminée.' }
  if (RANK[target] < RANK[step]) return { ok: false, why: 'Une commande ne revient pas à une étape précédente.' }
  if (target === 'DONE') return { ok: false, why: 'Une commande passe en « Terminées » une fois livrée. Pour l’arrêter, utilisez Refuser ou Annuler.' }
  return { ok: true }
}
