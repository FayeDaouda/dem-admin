import { TAB_ROLES, ACTION_ROLES } from './droits'

// ============================================================
//  Onglets de chaque page, pour la fenêtre d'un rôle (Équipes › Rôles) :
//  le Super Admin peut en décocher (« /marketing#promotions » dans
//  hiddenPages). Recopié des pages : mêmes clés que leurs onglets (?tab=…),
//  à tenir à jour quand une page gagne ou perd un onglet.
//
//  roles : accès qui voient l'onglet (comme dans la page) ; absent = tous
//  ceux qui ouvrent la page. Liste vide = Super Admin seul, jamais proposé.
// ============================================================

const t = (key, label, roles) => ({ key, label, roles })

export const PAGE_TABS = {
  '/service-client': [
    t('overview', "Vue d'ensemble", ['SERVICE_CLIENT']),
    t('gestes',   'Gestes commerciaux'),
    t('requests', 'Mes demandes'),
    t('journal',  'Mon journal', ['CM']),
  ],
  '/validation': [
    t('ambassadors',      'Chefs de flotte',      TAB_ROLES.validation.ambassadors),
    t('drivers',          'Coursiers en attente', TAB_ROLES.validation.drivers),
    t('kyc-review',       'Pièces à revoir',      TAB_ROLES.validation['kyc-review']),
    t('dem-pro',          'DEM Pro',              TAB_ROLES.validation['dem-pro']),
    t('fleet',            'Extensions de flotte', TAB_ROLES.validation.fleet),
    t('my-requests',      'Mes demandes',         TAB_ROLES.validation['my-requests']),
  ],
  '/dem-pro': [
    t('comptes',    'Comptes'),
    t('offres',     'Offres DEM Pro'),
    t('parrainage', 'Parrainage'),
  ],
  '/finance': [
    t('revenue',   'Revenus'),
    t('paiements', 'Paiements'),
    t('pass',      'Pass coursiers'),
  ],
  '/tarifs': [
    t('tarifs',    'Prix des courses'),
    t('pass',      'Pass coursiers', [...ACTION_ROLES.tariffBlocks, ...ACTION_ROLES.passSettings]),
    t('dempro',    'DEM Pro'),
    t('surge',     'Heures de pointe'),
    t('zone',      'Zone de livraison'),
    t('technique', 'Réglage technique'),
  ],
  '/marketing': [
    t('acquisition', 'Acquisition',          TAB_ROLES.marketing.acquisition),
    t('retention',   'Rétention',            TAB_ROLES.marketing.retention),
    t('courses',     'Comportement courses', TAB_ROLES.marketing.courses),
    t('promotions',  'Promotions',           TAB_ROLES.marketing.promotions),
  ],
  '/recompenses': [
    t('grant',   'Attribuer'),
    t('history', 'Historique'),
    t('rules',   'Règles automatiques', ACTION_ROLES.rewardsAll),
  ],
  '/badges': [
    t('clients',   'Clients',   TAB_ROLES.badges.clients),
    t('coursiers', 'Coursiers', TAB_ROLES.badges.coursiers),
  ],
  '/notifications': [
    t('envoyer',    'Envoyer et programmer', TAB_ROLES.notifications.envoyer),
    t('segments',   'Segments',              TAB_ROLES.notifications.segments),
    t('resultats',  'Résultats',             TAB_ROLES.notifications.resultats),
    t('codes',      'Codes de campagne',     TAB_ROLES.notifications.codes),
    t('historique', 'Historique',            TAB_ROLES.notifications.historique),
    t('alerte',     "Alerte dans l'app",     TAB_ROLES.notifications.alerte),
  ],
  '/relances': [
    t('inscrits', 'Nouveaux inscrits'),
    t('appels',   'Journal des appels'),
  ],
}

/** Identifiant rangé dans hiddenPages pour un onglet : « /marketing#promotions ». */
export const tabId = (path, key) => `${path}#${key}`

/** Onglets d'une page que voient ces accès (au moins deux, sinon rien à choisir). */
export function tabsFor(path, access) {
  const tabs = (PAGE_TABS[path] ?? []).filter(x => !x.roles || x.roles.some(r => access.includes(r)))
  return tabs.length >= 2 ? tabs : []
}
