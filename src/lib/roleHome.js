import { canSee } from './droits'

// Route d'atterrissage par rôle admin — certains rôles n'ont pas accès au Dashboard partagé.
// Selon les accès du rôle (page Équipes) : le Dashboard s'il l'ouvre (comme
// le menu, Layout.jsx), sinon la page du premier accès qui en a une.
const DASHBOARD_ACCESS = ['DEV', 'ASSISTANCE_EXECUTIVE', 'FLOTTE', 'COMMERCIAL', 'CM'] // Commercial : Dashboard Pro ; CM : Dashboard CM
const ACCESS_HOME = [
  ['SERVICE_CLIENT', '/service-client'],
  ['FINANCE', '/finance'],
  ['MARKETING', '/marketing'],
]

export function homeRouteForRole(adminRole) {
  if (canSee(adminRole, DASHBOARD_ACCESS)) return '/'
  return ACCESS_HOME.find(([key]) => canSee(adminRole, [key]))?.[1] ?? '/'
}
