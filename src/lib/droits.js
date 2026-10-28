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
  // Validation (page visible de Super, Ass. exéc. et Service Client) : chefs
  // de flotte, coursiers, pièces et DEM Pro ouverts aux trois ; extensions de
  // flotte (/admin/fleet-extensions) et décisions sur les demandes
  // (/admin/requests/:id/approve|reject) : Super seul.
  validation: {
    fleet:              [],
    'service-requests': [],
    'finance-requests': [],
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
  // Courses : actions de la fiche (admin.routes.js)
  orderDispatch: [],                         // choisir / attribuer un coursier, relancer la recherche : Super seul
  orderCancel:   ['ASSISTANCE_EXECUTIVE'],   // annuler : Super + Ass. exéc.
  orderMarkPaid: ['FINANCE'],                // marquer payé : Super + Finance
  orderForceStatus: [],                      // colis récupéré / livré à la place du coursier (/force-status) : Super seul
  // Incidents : changer le statut ou les notes (PATCH /admin/incidents/:id) : Super + Ass. exéc.
  incidentUpdate: ['ASSISTANCE_EXECUTIVE'],
  // Validation › chefs de flotte, Suspendre : PATCH /admin/chefs-de-flotte/:id/suspend, Super seul.
  chefSuspend: [],
  // Validation › pièces à revoir, Rejeter une pièce et Vérifier :
  // /admin/drivers/:id/documents/:field/reject et /verify, Super + Ass. exéc.
  // (le Service Client garde la lecture).
  kycReview: ['ASSISTANCE_EXECUTIVE'],
  // Clients (page visible de Super, Dev et Service Client) :
  // créer (POST /admin/clients) : Super seul ;
  clientCreate: [],
  // modifier (PATCH /admin/clients/:id) : Super + Service Client ;
  clientEdit: ['SERVICE_CLIENT'],
  // bannir / débannir, supprimer, décider d'un changement de numéro
  // (/ban, /unban, DELETE, /phone-change) : Super seul ; la conversion en
  // DEM Pro reste réservée au Super comme avant.
  clientManage: [],
  // Coursiers (page visible de Super, Dev, Ass. exéc. et Service Client) :
  // créer (POST /admin/drivers) et envoyer des pièces (PATCH .../documents) : Super seul ;
  driverCreate: [],
  driverDocsUpload: [],
  // modifier (PATCH /admin/drivers/:id) : Super + Ass. exéc. + Service Client ;
  driverEdit: ['ASSISTANCE_EXECUTIVE', 'SERVICE_CLIENT'],
  // activer / refuser un nouveau coursier (/validate) et suspendre /
  // réactiver (/suspend, /activate) : Super + Ass. exéc. (le Service Client
  // passe par « Demander une suspension », comme avant) ;
  driverValidate: ['ASSISTANCE_EXECUTIVE'],
  driverSuspend:  ['ASSISTANCE_EXECUTIVE'],
  // supprimer, désarchiver, décider d'un changement de numéro : Super seul ;
  driverManage: [],
  // statistiques de paiement (/payment-stats) : Super + Finance.
  driverPaymentStats: ['FINANCE'],
  // Signaler un coursier depuis sa fiche : POST /admin/report-user (Super,
  // Dev, SC, Ass. exéc.) — sans recherche de client, donc ouvert à l'Ass. exéc.
  reportDriver: ['DEV', 'SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE'],
  // Chefs de flotte (page visible de Super, Ass. exéc. et Service Client) :
  // créer, supprimer, suspendre (POST, DELETE, /suspend) : Super seul ;
  chefManage: [],
  // modifier et mot de passe provisoire (PATCH /:id, /reset-password) :
  // Super + Service Client ;
  chefEdit: ['SERVICE_CLIENT'],
  // valider / réactiver le chef (/validate) : Super + Ass. exéc. ;
  chefValidate: ['ASSISTANCE_EXECUTIVE'],
  // coursiers de la flotte (valider, suspendre, réactiver, rattacher,
  // retirer) : Super + Ass. exéc. — le Service Client garde la lecture ;
  fleetDriverActions: ['ASSISTANCE_EXECUTIVE'],
  // signaler un chef : POST /admin/report-user (Super, Dev, SC, Ass. exéc.).
  reportChef: ['DEV', 'SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE'],
  // Tarifs et zones : réglages (PUT /admin/config — tarif hors zone, DEM Pro,
  // heures de pointe, réglage technique) et zone de livraison (PUT
  // /admin/delivery-zone) : Super seul ; le Dev les voit en lecture.
  configEdit: [],
  // Version de l'app : PUT /admin/app-version, Super seul (le Dev lit).
  appVersionEdit: [],
  // Exporter les listes Clients, Coursiers, DEM Pro et Chefs de flotte (PDF,
  // Word, Excel) : fichiers de numéros de téléphone en masse → Super seul.
  // Export fait dans le navigateur à partir des listes déjà lisibles : aucune
  // route serveur à recopier ici.
  listExport: [],
}
