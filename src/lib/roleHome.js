import { canSee, isSuperRole, pageHidden } from './droits'
import { NAV } from './menu'

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
  const home = canSee(adminRole, DASHBOARD_ACCESS)
    ? '/'
    : ACCESS_HOME.find(([key]) => canSee(adminRole, [key]))?.[1] ?? '/'
  if (isSuperRole(adminRole) || !pageHidden(adminRole, home)) return home
  // Page d'accueil décochée par le Super Admin : première page restante du menu
  return NAV.find(n => canSee(adminRole, n.roles) && !pageHidden(adminRole, n.to))?.to ?? home
}
