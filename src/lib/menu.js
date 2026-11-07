// Menu de l'admin (Layout.jsx) — aussi lu par la page Équipes pour montrer
// les pages qu'ouvre chaque rôle.
import {
  Gift, LayoutDashboard, Package, Users, Bike, Map, TrendingUp, ShieldCheck, AlertTriangle, ScrollText, UserCog, Briefcase, UsersRound, SlidersHorizontal, Award, GitBranch, Bell, Wallet, Table2, KeyRound, Wrench, Headset, Smartphone, Gauge, Activity, Contact, Banknote, Rocket, Settings,
} from 'lucide-react'
import { roleHas } from './droits'

// roles: undefined = tous les rôles. Sinon tableau des accès autorisés (SUPER bypass toujours) ;
// FLOTTE = Responsable de flottes (9 pages, dossier du 06/11/2026) ;
// COMMERCIAL = Commercial / CRM Pro (dossier du 07/11/2026).
// labelFor : nom de la page propre à un rôle (sinon `label`).
// hideForSuper : entrée réservée au rôle métier (le Poste Service Client est
// caché au Super Admin, décision du plan de refonte).
// keywords : autres mots qui retrouvent la page dans la recherche du menu.
// group : groupe du menu (GROUPS), dans l'ordre d'affichage.
export const GROUPS = [
  { key: 'pilotage',       label: 'Pilotage',       icon: Gauge },
  { key: 'operations',     label: 'Opérations',     icon: Activity },
  { key: 'comptes',        label: 'Comptes',        icon: Contact },
  { key: 'argent',         label: 'Finances',       icon: Banknote },
  { key: 'croissance',     label: 'Croissance',     icon: Rocket },
  { key: 'administration', label: 'Administration', icon: Settings },
]

export const NAV = [
  { group: 'pilotage',   to: '/',                icon: LayoutDashboard, label: 'Dashboard',            roles: ['SUPER','DEV','ASSISTANCE_EXECUTIVE','FLOTTE'] },
  { group: 'pilotage',   to: '/map',             icon: Map,             label: 'Carte live',           keywords: 'map positions suivi', roles: ['SUPER','DEV','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT','FLOTTE','COMMERCIAL'] },
  { group: 'operations', to: '/orders',          icon: Package,         label: 'Courses',              keywords: 'commandes livraisons orders tournées', roles: ['SUPER','DEV','FINANCE','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE','FLOTTE','COMMERCIAL'] },
  { group: 'operations', to: '/incidents',       icon: AlertTriangle,   label: 'Incidents',            keywords: 'sos alertes litiges', roles: ['SUPER','DEV','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE','FLOTTE'] },
  { group: 'operations', to: '/validation',      icon: ShieldCheck,     label: 'Validation',           keywords: 'documents vérification inscriptions', roles: ['SUPER','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT','FLOTTE','COMMERCIAL'] },
  { group: 'operations', to: '/service-client',  icon: Headset,         label: 'Poste Service Client', labelFor: role => (roleHas(role, 'COMMERCIAL') && !roleHas(role, 'SERVICE_CLIENT') ? 'Poste Commercial' : null), keywords: 'dashboard gestes demandes', roles: ['SUPER','SERVICE_CLIENT','COMMERCIAL'], hideForSuper: true },
  { group: 'comptes',    to: '/clients',         icon: Users,           label: 'Clients',              roles: ['SUPER','DEV','SERVICE_CLIENT','COMMERCIAL'] },
  { group: 'comptes',    to: '/drivers',         icon: Bike,            label: 'Coursiers',            keywords: 'livreurs motos drivers', roles: ['SUPER','DEV','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT','FLOTTE'] },
  { group: 'comptes',    to: '/dem-pro',         icon: Briefcase,       label: 'DEM Pro',              keywords: 'boutiques commerçants offres paliers parrainage', roles: ['SUPER','SERVICE_CLIENT','COMMERCIAL'] },
  { group: 'comptes',    to: '/chefs-de-flotte', icon: UserCog,         label: 'Chefs de flotte',      keywords: 'flottes', roles: ['SUPER','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT','FLOTTE'] },
  { group: 'comptes',    to: '/codes-acces',     icon: KeyRound,        label: 'Codes et accès',       keywords: 'otp sms débloquer code secret gel sessions sécurité', roles: ['SUPER','SERVICE_CLIENT'] },
  { group: 'argent',     to: '/finance',         icon: Wallet,          label: 'Finance',              keywords: 'dashboard revenus commission pass paiements impayés litiges wave orange money retraits', roles: ['SUPER','FINANCE'] },
  { group: 'argent',     to: '/tarifs',          icon: SlidersHorizontal, label: 'Tarifs et zones',    keywords: 'prix zones config promo prix unique heures de pointe', roles: ['SUPER','DEV'] },
  { group: 'croissance', to: '/marketing',       icon: TrendingUp,      label: 'Marketing',            keywords: 'dashboard acquisition rétention promotions codes promo campagnes 100 clients', roles: ['SUPER','MARKETING','ASSISTANCE_EXECUTIVE'] },
  { group: 'croissance', to: '/recompenses',     icon: Gift,            label: 'Récompenses',          keywords: 'cadeaux bonus', roles: ['SUPER','MARKETING'] },
  { group: 'croissance', to: '/parrainage',      icon: GitBranch,       label: 'Parrainage',           roles: ['SUPER','MARKETING'] },
  { group: 'croissance', to: '/badges',          icon: Award,           label: 'Badges',               keywords: 'badge client coursier paliers', roles: ['SUPER','MARKETING','ASSISTANCE_EXECUTIVE','FLOTTE'] },
  { group: 'croissance', to: '/notifications',   icon: Bell,            label: 'Notifications',        keywords: 'push broadcast envoi messages programmées historique alerte campagnes', roles: ['SUPER','MARKETING','FLOTTE'] },
  { group: 'croissance', to: '/relances',        icon: Table2,          label: 'Relances',             keywords: 'tableau appels prospection nouveaux profils inscrits inscriptions', roles: ['SUPER','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE','COMMERCIAL'] },
  { group: 'administration', to: '/equipes',     icon: UsersRound,      label: 'Équipes',              keywords: 'admins comptes rôles', roles: ['SUPER'] },
  { group: 'administration', to: '/audit',       icon: ScrollText,      label: 'Audit',                keywords: 'journal historique', roles: ['SUPER','DEV'] },
  { group: 'administration', to: '/maintenance', icon: Wrench,          label: 'Maintenance',          keywords: 'tâches fournisseur sms réglages code secret interrupteurs', roles: ['SUPER'] },
  { group: 'administration', to: '/version-app', icon: Smartphone,      label: "Version de l'app",     keywords: 'mise à jour version minimale', roles: ['SUPER','DEV'] },
]
