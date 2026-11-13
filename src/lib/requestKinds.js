// Types de demandes au Super Admin (AdminRequest) — mêmes clés que le
// serveur (admin.requests.service.js:KINDS).
export const REQUEST_KIND_LABELS = {
  DEM_PRO_CREATE:   'Création compte DEM Pro',
  DEM_PRO_SUSPEND:  'Suspension compte DEM Pro',
  DEM_PRO_ACTIVATE: 'Réactivation compte DEM Pro',
  GESTE_FREE_RIDE:  'Course gratuite',
  GESTE_DISCOUNT:   'Remise',
  TARIFF_CHANGE:    'Modification tarifaire',
  DRIVER_SUSPEND:   'Suspension coursier',
  CHEF_SUSPEND:     'Suspension chef de flotte',
  // Responsable de flottes (niveau 2)
  ORDER_CANCEL:     "Annulation d'une course en cours",
  ORDER_REFUND:     'Remboursement client',
  CHEF_VALIDATE:    'Validation chef de flotte',
  CHEF_ACTIVATE:    'Réactivation chef de flotte',
  FLEET_EXTENSION:  'Extension de flotte',
  DRIVER_ACTIVATE:  'Réactivation coursier',
  DRIVER_DELETE:    'Suppression coursier',
  DRIVER_GIFT_PASS: 'Pass coursier offert',
  BROADCAST:        'Notification aux clients / DEM Pro / chefs',
  // Commercial / CRM Pro (niveau 2)
  PRO_BONUS:           'Bonus DEM Pro',
  PRO_PLAN_CHANGE:     'Changement de plan DEM Pro',
  PRO_REFERRAL_REWARD: 'Bonus de parrainage DEM Pro',
  // CM / CRM Client (niveau 2)
  CLIENT_REWARD:       'Récompense client',
  APP_ALERT:           "Alerte dans l'app",
  CLIENT_BAN:          'Bannir un client',
  CLIENT_BADGE:        'Badge client',
  PROMO_CODE:          'Code promo client',
}

export const REQUEST_STATUS_LABELS = {
  PENDING:    'En attente',
  NEEDS_INFO: 'Précision demandée',
  APPROVED:   'Validée',
  REJECTED:   'Refusée',
}

// Détails lisibles d'une demande (payload) — sans les identifiants techniques
export function requestDetails(r) {
  const p = r.payload ?? {}
  return [
    p.hours !== undefined && (p.hours ? `Durée : ${p.hours >= 24 && p.hours % 24 === 0 ? `${p.hours / 24} j` : `${p.hours} h`}` : 'Durée : définitive'),
    p.days && p.type !== 'PRO_TRIAL' && `Pass : ${p.days} jour${p.days > 1 ? 's' : ''}`,
    p.discountPercent && `Remise : ${p.discountPercent} %`,
    p.amount && `Montant : ${Number(p.amount).toLocaleString('fr-FR')} F`,
    p.orderId && `Course ${String(p.orderId).slice(0, 8).toUpperCase()}`,
    p.reasonLabel && `Motif d'annulation : ${p.reasonLabel}`,
    p.target && `Destinataires : ${p.target}`,
    p.plan && `Plan : ${p.plan}${p.expiresAt ? ` jusqu'au ${new Date(p.expiresAt).toLocaleDateString('fr-FR')}` : ''}`,
    p.type && { COURSE_FREE: 'Course offerte', COURSE_PERCENT: `Réduction ${p.value} %`, COURSE_FIXED: `Réduction ${p.value} F`, PRO_PLAN_DAYS: `${p.value} jours d'offre`,
      PRO_TRIAL: `Essai gratuit Business : ${p.days === 30 ? '1 mois' : p.days % 7 === 0 ? `${p.days / 7} semaine${p.days > 7 ? 's' : ''}` : `${p.days} jours`}` }[p.type],
    p.uses > 1 && `sur ${p.uses} courses`,
    p.title && `« ${p.title} — ${p.body} »`,
    p.requestedSize && `Taille demandée : ${p.requestedSize} coursiers`,
    p.message && `Alerte : « ${p.message} »`,
    p.code && `Code : ${p.code}${p.name ? ` (${p.name})` : ''}`,
    p.type && { FREE_COURSE: 'Course offerte', PERCENT_OFF: `Réduction ${p.value} %`, FIXED_OFF: `Réduction ${p.value} F` }[p.type],
    p.maxUsesTotal && `${p.maxUsesTotal} utilisations au plus`,
    p.active === false && "Retirer l'alerte",
    p.startsAt && `À partir du ${new Date(p.startsAt).toLocaleString('fr-FR')}`,
  ].filter(Boolean)
}
