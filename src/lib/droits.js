// ============================================================
//  Droits d'AFFICHAGE de l'admin — quels rôles voient quel écran.
//
//  Cette table ne donne aucun droit : le serveur (dem-backend,
//  src/modules/admin/admin.routes.js) reste seul juge et refuse toute
//  route non autorisée. Elle évite seulement de montrer un écran ou un
//  bouton qui renverrait un refus, ou une donnée qu'un rôle ne voit pas
//  aujourd'hui. Elle est recopiée des droits du serveur : toute
//  modification d'un côté se reporte de l'autre.
//
//  Le Super Admin (ou un ancien compte sans rôle) voit tout, comme côté
//  serveur (requireAdminRole).
// ============================================================

export function isSuperRole(role) {
  return !role || role === 'SUPER'
}

// roles absent = tous les rôles
export function canSee(role, roles) {
  if (isSuperRole(role)) return true
  if (!roles) return true
  return roles.includes(role)
}

// Onglets par page — rôles en plus du Super Admin.
export const TAB_ROLES = {
  marketing: {
    overview:    ['MARKETING'],                         // indicateurs : /admin/marketing/kpis
    acquisition: ['MARKETING', 'ASSISTANCE_EXECUTIVE'], // /admin/marketing/acquisition
    retention:   ['MARKETING'],
    courses:     ['MARKETING'],
    promotions:  ['MARKETING'],
  },
  badges: {
    clients:   ['MARKETING'],                           // /admin/client-badges/*
    coursiers: ['MARKETING', 'ASSISTANCE_EXECUTIVE'],   // /admin/badges/config, driver-distribution
  },
}

// Actions réservées, à l'intérieur d'un écran.
export const ACTION_ROLES = {
  giftForfait: [], // pass offerts : serveur Super + Finance, écran Promotions visible de Super + Marketing → Super seul
  feesSinceLaunch: [], // Finance › Revenus, frais depuis le lancement : /admin/acquisition/fees, Super seul
  passDue:      [], // Finance › Pass coursiers, dû et prélèvement : Super seul (décision du plan de refonte)
  passSettings: [], // Tarifs et zones, activation et montants des pass : PUT /admin/forfait/config, Super seul
  freeCourseOffer: [], // Marketing › Acquisition, offre 100 clients : /admin/acquisition/free-course, Super seul
  // Tarifs et zones : promo prix unique, frais de mise en relation, matrice
  // des zones, pass — lecture serveur Super + Finance ; la page est visible de
  // Super + Dev, donc masqués au rôle Dev (ils lui affichaient une erreur).
  tariffBlocks: ['FINANCE'],
  // Signaler un utilisateur : POST /admin/report-user (Super, Dev, SC, Ass.
  // exéc.) mais la recherche du client passe par /admin/clients, refusée à
  // l'Assistance exécutive → Super, Dev et Service Client.
  reportUser: ['DEV', 'SERVICE_CLIENT'],
  // Parrainage › compteur des parrainages DEM Pro : /admin/dem-pro/referrals ;
  // le rôle Marketing ne voit pas les parrainages DEM Pro aujourd'hui → Super seul.
  proReferralCounter: [],
  // Version de l'app : PUT /admin/app-version, Super seul (le Dev lit).
  appVersionEdit: [],
}
