import { NAV } from './menu'

// Accès qu'un rôle de la page Équipes peut ouvrir — les mêmes que vérifie le
// serveur (requireAdminRole, utils/admin-roles.js). Chaque accès ouvre les
// pages du menu qui le citent (lib/menu.js) et les actions qui vont avec.
export const ACCESS = [
  { key: 'DEV',                  label: 'Dev' },
  { key: 'FINANCE',              label: 'Finance' },
  { key: 'MARKETING',            label: 'Marketing' },
  { key: 'SERVICE_CLIENT',       label: 'Service client' },
  { key: 'ASSISTANCE_EXECUTIVE', label: 'Assistance exécutive' },
  { key: 'FLOTTE',               label: 'Responsable de flottes' },
  { key: 'COMMERCIAL',           label: 'Commercial / CRM Pro' },
  { key: 'CM',                   label: 'CM / CRM Client' },
]

/** Pages du menu ouvertes par ces accès (Super Admin : toutes). */
export function pagesFor(access, isSuper = false) {
  return NAV
    .filter(n => (isSuper ? !n.hideForSuper : n.roles?.some(r => access.includes(r))))
    .map(n => n.label)
}
