import { FileText, Package, Boxes, UtensilsCrossed, Gem, Shapes } from 'lucide-react'

// Catégories de colis — mêmes clés que le serveur (orders/package-categories.js)
// et que l'app (core/utils/package_categories.dart). Le supplément éventuel
// de chaque catégorie vient de GET /orders/package-categories.
export const PACKAGE_CATEGORIES = [
  { key: 'DOCUMENTS', label: 'Documents', hint: 'Enveloppes, contrats, factures', icon: FileText },
  { key: 'SMALL', label: 'Petit colis', hint: 'Léger, moins de 5 kg', icon: Package },
  { key: 'LARGE', label: 'Grand colis', hint: 'Lourd ou encombrant', icon: Boxes },
  { key: 'FOOD', label: 'Repas', hint: 'Plats, courses, alimentaire', icon: UtensilsCrossed },
  { key: 'VALUABLE', label: 'Objet de valeur', hint: 'Téléphone, bijoux… code exigé à la remise', icon: Gem },
  { key: 'OTHER', label: 'Autre', hint: 'Ce qui ne rentre pas ailleurs', icon: Shapes },
]
export const DEFAULT_CATEGORY = 'SMALL'
export const categoryOf = (key) => PACKAGE_CATEGORIES.find(c => c.key === key) ?? null

// « Grand colis · Fragile » (null sans catégorie ni fragile)
export function packageLabel(order) {
  const parts = [categoryOf(order?.packageCategory)?.label, order?.isFragile ? 'Fragile' : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

// Objets que DEM ne transporte pas — confirmés à la création
export const PROHIBITED_ITEMS = [
  'Argent liquide',
  'Armes, munitions, objets tranchants dangereux',
  'Drogues et médicaments sans ordonnance',
  'Produits inflammables, explosifs ou toxiques (gaz, essence…)',
  'Animaux vivants',
  'Objets volés ou contrefaits',
]
