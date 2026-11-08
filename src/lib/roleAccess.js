import { NAV } from './menu'

// Accès qu'un rôle de la page Équipes peut ouvrir — les mêmes que vérifie le
// serveur (requireAdminRole, utils/admin-roles.js). Chaque accès ouvre les
// pages du menu qui le citent (lib/menu.js) et les actions qui vont avec.
// short : nom court, pour écrire plusieurs accès à la suite (« Finance / Marketing »)
export const ACCESS = [
  { key: 'DEV',                  label: 'Dev',                    short: 'Dev' },
  { key: 'FINANCE',              label: 'Finance',                short: 'Finance' },
  { key: 'MARKETING',            label: 'Marketing',              short: 'Marketing' },
  { key: 'SERVICE_CLIENT',       label: 'Service client',         short: 'Service client' },
  { key: 'ASSISTANCE_EXECUTIVE', label: 'Assistance exécutive',   short: 'Assistance exécutive' },
  { key: 'FLOTTE',               label: 'Responsable de flottes', short: 'Flottes' },
  { key: 'COMMERCIAL',           label: 'Commercial / CRM Pro',   short: 'Commercial' },
  { key: 'CM',                   label: 'CM / CRM Client',        short: 'CM' },
]

/** Accès cochés, dans l'ordre de la liste, séparés par « / » : « Finance / Marketing ». */
export function accessLine(access) {
  return ACCESS.filter(a => access?.includes(a.key)).map(a => a.short).join(' / ')
}

/** Entrées du menu ouvertes par ces accès (Super Admin : toutes). */
export function pageEntriesFor(access, isSuper = false) {
  return NAV.filter(n => (isSuper ? !n.hideForSuper : n.roles?.some(r => access.includes(r))))
}

/** Pages du menu ouvertes par ces accès, moins les pages décochées (hiddenPages). */
export function pagesFor(access, isSuper = false, hiddenPages = []) {
  return pageEntriesFor(access, isSuper)
    .filter(n => isSuper || !hiddenPages.includes(n.to))
    .map(n => n.label)
}
