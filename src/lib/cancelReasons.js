// Libellés des motifs d'annulation enregistrés dans Order.cancelReason —
// un seul endroit pour les codes client et DEM Pro (app), système (dispatch)
// et admin
// (voir dem-backend : orders/cancel-reasons.js, admin/admin-cancel-reasons.js).
export const CANCEL_REASON_LABELS = {
  // Client
  CHANGED_MIND:      "Changement d'avis",
  TOO_LONG:          'Trop long',
  WRONG_ADDRESS:     'Adresse ou infos erronées',
  PRICE:             'Prix trop élevé',
  FOUND_ALTERNATIVE: 'Autre solution trouvée',
  DRIVER_ISSUE:      'Problème avec le livreur',
  OTHER:             'Autre',
  // Commerçant DEM Pro
  CUSTOMER_CANCELLED: 'Annulée par le client du commerçant',
  OUT_OF_STOCK:       'Article indisponible',
  ORDER_MISTAKE:      'Commande créée par erreur',
  // Système
  NO_DRIVER_FOUND:   'Aucun livreur trouvé (auto)',
  WALLET_INSUFFICIENT: 'Solde du wallet insuffisant (auto)',
  // Équipe DEM (admin)
  NO_DRIVER_AVAILABLE: 'Aucun livreur disponible (équipe)',
  ADDRESS_UNREACHABLE: 'Adresse introuvable (équipe)',
  DUPLICATE_ORDER:     'Commande en double (équipe)',
  PAYMENT_ISSUE:       'Problème de paiement (équipe)',
  SECURITY_CONCERN:    'Vérification de sécurité (équipe)',
  CLIENT_REQUEST:      'Demande du client au support',
  TECHNICAL_ISSUE:     'Problème technique (équipe)',
  // Statistiques
  NON_RENSEIGNE:     'Non renseigné',
}

export function cancelReasonLabel(code) {
  if (!code) return 'Non renseigné'
  return CANCEL_REASON_LABELS[code] ?? code
}
