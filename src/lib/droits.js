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
    campaigns:   ['MARKETING'],
  },
  badges: {
    clients:   ['MARKETING'],                           // /admin/client-badges/*
    coursiers: ['MARKETING', 'ASSISTANCE_EXECUTIVE'],   // /admin/badges/config, driver-distribution
  },
}

// Actions réservées, à l'intérieur d'un écran.
export const ACTION_ROLES = {
  giftForfait: [], // pass offerts : serveur Super + Finance, écran Promotions visible de Super + Marketing → Super seul
}
