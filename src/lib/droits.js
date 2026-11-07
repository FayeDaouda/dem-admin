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
//
//  Les listes ci-dessous nomment des ACCÈS (DEV, FINANCE, MARKETING,
//  SERVICE_CLIENT, ASSISTANCE_EXECUTIVE, FLOTTE = Responsable de flottes,
//  COMMERCIAL = Commercial / CRM Pro). Un rôle de la page Équipes en ouvre
//  un ou plusieurs : le serveur les renvoie à la connexion (adminAccess) ;
//  à défaut (session plus ancienne), un rôle d'origine ouvre son propre accès.
// ============================================================

export function isSuperRole(role) {
  return !role || role === 'SUPER'
}

let current = { role: null, access: null }

/** Appelé par AuthContext à chaque connexion ou relecture du compte. */
export function setCurrentAccess(role, access) {
  current = { role: role ?? null, access: Array.isArray(access) ? access : null }
}

function accessOf(role) {
  return role === current.role && current.access ? current.access : [role]
}

// roles absent = tous les rôles
export function canSee(role, roles) {
  if (isSuperRole(role)) return true
  if (!roles) return true
  return accessOf(role).some(a => roles.includes(a))
}

/**
 * Demandes de niveau 2 au Super Admin (Responsable de flottes) : bouton
 * « Demander » à la place d'une action qui lui est réservée.
 */
export function asksSuper(role) {
  return roleHas(role, 'FLOTTE') || roleHas(role, 'COMMERCIAL')
}

/** Le rôle (hors Super Admin) ouvre-t-il cet accès ? */
export function roleHas(role, key) {
  return !isSuperRole(role) && accessOf(role).includes(key)
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
    coursiers: ['MARKETING', 'ASSISTANCE_EXECUTIVE', 'FLOTTE'], // /admin/badges/config, driver-distribution (lecture ; seuils : Super)
  },
  // Validation (page visible de Super, Ass. exéc. et Service Client) : chefs
  // de flotte, coursiers, pièces et DEM Pro ouverts aux trois ; extensions de
  // flotte (/admin/fleet-extensions) et décisions sur les demandes
  // (/admin/requests/:id/approve|reject) : Super seul.
  validation: {
    // Chefs, coursiers, pièces : pas le Commercial (comptes DEM Pro seulement)
    ambassadors:        ['SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE', 'FLOTTE'],
    drivers:            ['SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE', 'FLOTTE'],
    'kyc-review':       ['SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE', 'FLOTTE'],
    // DEM Pro : Service Client et Commercial (Valider / Refuser), pas le Resp. flottes
    'dem-pro':          ['SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE', 'COMMERCIAL'],
    // Extensions de flotte : Responsable de flottes en lecture (décision : Super)
    fleet:              ['FLOTTE'],
    // Demandes du Responsable de flottes : décision du Super (Demandes Flotte),
    // suivi par le demandeur (Mes demandes, masqué au Super)
    'fleet-requests':   [],
    'my-requests':      ['FLOTTE'],
    'service-requests': [],
    'finance-requests': [],
  },
  // Notifications : le Responsable de flottes envoie et programme des push
  // aux coursiers seulement (serveur : admin.broadcast.controller.js).
  notifications: {
    envoyer:    ['MARKETING', 'FLOTTE'],
    historique: ['MARKETING'],
    alerte:     ['MARKETING'],
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
  // Notifications à tous les profils (sinon : coursiers seulement, Resp. flottes)
  broadcastAll: ['MARKETING'],
  // Parrainage › compteur des parrainages DEM Pro : /admin/dem-pro/referrals ;
  // le rôle Marketing ne voit pas les parrainages DEM Pro aujourd'hui → Super seul.
  proReferralCounter: [],
  // Courses : actions de la fiche (admin.routes.js)
  orderDispatch: ['FLOTTE', 'COMMERCIAL'],   // choisir / attribuer / suggérer un coursier, relancer la recherche : Super + Resp. flottes + Commercial (courses DEM Pro seulement)
  orderDispatchAll: ['FLOTTE'],              // dispatch sur toutes les courses (sinon : courses DEM Pro)
  orderCancel:   ['ASSISTANCE_EXECUTIVE', 'FLOTTE'], // annuler : Super + Ass. exéc. ; Resp. flottes : course en attente seulement (orderCancelAny)
  orderCancelAny: ['ASSISTANCE_EXECUTIVE'],  // annuler aussi une course en cours
  orderMarkPaid: ['FINANCE'],                // marquer payé : Super + Finance
  orderForceStatus: [],
  // Créer une course au nom d'un client (commande par téléphone / WhatsApp) :
  // POST /admin/orders, Super + Resp. flottes
  orderCreateForClient: ['FLOTTE'],
  // Créer un compte DEM Pro (POST /admin/dem-pro) : Super + Commercial
  proCreate: ['COMMERCIAL'],
  // Semaine gratuite et bonus d'un Pro (/admin/dem-pro/:id/trial, /bonus) : Super + Commercial
  proBonus: ['COMMERCIAL'],
  // Fiche coursier : notes internes (GET/POST /admin/drivers/:id/notes), Super + Resp. flottes
  driverNotes: ['FLOTTE'],
  // Shifts de la flotte DEM : planning d'un coursier et créneaux
  // (PUT /admin/drivers/:id/shifts, /admin/shifts/slots), Super + Resp. flottes
  shiftEdit: ['FLOTTE'],                      // colis récupéré / livré à la place du coursier (/force-status) : Super seul
  // Incidents : changer le statut ou les notes (PATCH /admin/incidents/:id) : Super + Ass. exéc.
  incidentUpdate: ['ASSISTANCE_EXECUTIVE', 'FLOTTE'],
  // Validation › chefs de flotte, Suspendre : PATCH /admin/chefs-de-flotte/:id/suspend, Super seul.
  chefSuspend: [],
  // Validation › pièces à revoir, Rejeter une pièce et Vérifier :
  // /admin/drivers/:id/documents/:field/reject et /verify, Super + Ass. exéc.
  // (le Service Client garde la lecture).
  kycReview: ['ASSISTANCE_EXECUTIVE', 'FLOTTE'],
  // Validation › chefs de flotte, Valider / Refuser une inscription :
  // PATCH /admin/chefs-de-flotte/:id/validate, Super + SC + Ass. exéc.
  // (Resp. flottes : lecture, décision du Super Admin).
  chefDecision: ['SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE'],
  // Validation › extensions de flotte, Approuver / Refuser : Super seul.
  fleetDecision: [],
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
  driverCreate: ['FLOTTE'],
  driverDocsUpload: [],
  // modifier (PATCH /admin/drivers/:id) : Super + Ass. exéc. + Service Client + Resp. flottes ;
  driverEdit: ['ASSISTANCE_EXECUTIVE', 'SERVICE_CLIENT', 'FLOTTE'],
  // activer / refuser un nouveau coursier (/validate) et suspendre /
  // réactiver (/suspend, /activate) : Super + Ass. exéc. (le Service Client
  // passe par « Demander une suspension », comme avant) ;
  driverValidate: ['ASSISTANCE_EXECUTIVE', 'FLOTTE'],
  driverSuspend:  ['ASSISTANCE_EXECUTIVE', 'FLOTTE'],
  // suspendre sans limite de durée ; sinon 72 h au plus (Resp. flottes,
  // contrôlé par le serveur, admin.drivers.controller.js)
  driverSuspendUnlimited: ['ASSISTANCE_EXECUTIVE'],
  // supprimer, désarchiver, décider d'un changement de numéro : Super seul ;
  driverManage: [],
  // statistiques de paiement (/payment-stats) : Super + Finance.
  driverPaymentStats: ['FINANCE'],
  // Signaler un coursier depuis sa fiche : POST /admin/report-user (Super,
  // Dev, SC, Ass. exéc.) — sans recherche de client, donc ouvert à l'Ass. exéc.
  reportDriver: ['DEV', 'SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE', 'FLOTTE'],
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
