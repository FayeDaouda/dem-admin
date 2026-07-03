// Route d'atterrissage par rôle admin — certains rôles n'ont pas accès au Dashboard partagé
const ROLE_HOME = {
  MARKETING: '/marketing',
  FINANCE: '/finance',
}

export function homeRouteForRole(adminRole) {
  return ROLE_HOME[adminRole] ?? '/'
}
