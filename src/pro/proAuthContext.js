import { createContext, useContext } from 'react'
import { session } from './lib/session'

// Contenu d'un JWT (sans vérifier la signature : simple lecture du memberId)
function tokenPayload(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part.padEnd(part.length + (4 - part.length % 4) % 4, '=')))
  } catch { return null }
}

// Contexte de connexion de l'espace web DEM Pro (voir ProAuth.jsx)
export const ProAuthContext = createContext(null)
export const useProAuth = () => useContext(ProAuthContext)

// Le numéro n'est pas un compte DEM Pro : message affiché tel quel
export class NotProAccount extends Error {}

// ── Membres de l'équipe ─────────────────────────────────────────────────────
// Un membre connecté à la boutique (POST /auth/team-login) a un jeton du
// compte de la boutique avec memberId ; GET /users/me renvoie alors
// `teamMember` { id, name, phone, role: STAFF | MANAGER }. Mêmes droits que
// le serveur (auth.middleware.js : ownerOnly, managerOrOwner) et que l'app
// (dem_pro_home_screen.dart : _isMember, _isManager).

// Rôle du membre connecté, ou null pour le responsable. Tant que /users/me
// n'a pas répondu, un jeton de membre sans profil compte comme employé (le
// rôle le plus limité) : jamais d'écran du responsable affiché par erreur.
export function memberRoleOf(user) {
  if (user?.teamMember) return user.teamMember.role === 'MANAGER' ? 'MANAGER' : 'STAFF'
  return tokenPayload(session.accessToken)?.memberId ? 'STAFF' : null
}

// Zones réservées : OWNER = responsable seul, MANAGER = responsable et gérants
export const ACCESS = {
  dashboard: 'MANAGER',       // /dem-pro/me/insights, finances, ventes
  wallet: 'MANAGER',          // consultation du wallet
  clients: 'MANAGER',
  withdraw: 'OWNER',          // retraits
  offers: 'OWNER',            // essai, achat d'une offre
  paymentSettings: 'OWNER',   // paiement intégré
  team: 'OWNER',
  api: 'OWNER',
  referral: 'OWNER',
  profile: 'OWNER',           // nom, e-mail, NINEA, photo, numéro
  security: 'OWNER',          // code secret, appareils connectés
  deletion: 'OWNER',
}

export function canAccess(user, area) {
  const need = ACCESS[area]
  const role = memberRoleOf(user)
  if (!need || !role) return true
  return need === 'MANAGER' && role === 'MANAGER'
}

export const ROLE_LABEL = { STAFF: 'Employé', MANAGER: 'Gérant' }

// Messages des refus serveur pour un membre (403) — affichés par errMsg()
export const TEAM_MESSAGES = {
  TEAM_OWNER_ONLY: 'Cette action est réservée au responsable de la boutique. Demandez-lui de la faire depuis son compte.',
  TEAM_MANAGER_ONLY: 'Réservé au responsable et aux gérants de la boutique : votre rôle d\'employé n\'y donne pas accès.',
}
