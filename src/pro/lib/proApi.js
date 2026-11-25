import axios from 'axios'
import { session, deviceId, deviceName } from './session'

// Client HTTP de l'espace web DEM Pro : même serveur et mêmes routes que
// l'app DEM Pro (/dem-pro/*, /orders/*, /users/dem-pro/*) — données
// synchronisées par construction.
const BASE = import.meta.env.VITE_API_URL ?? ''

export const PRO_APP_VERSION = 'pro-web-1.0.0'

const deviceHeaders = () => ({
  'X-Device-Id': deviceId(),
  // Nom lisible dans « Appareils connectés » (connexion par code SMS aussi)
  // (en-tête HTTP : caractères ASCII seulement)
  'X-Device': deviceName().replace(/\s*·\s*/g, ' - '),
  'X-Platform': 'web',
  'X-App-Version': PRO_APP_VERSION,
})

// Sans jeton : connexion, code SMS, code secret
export const publicPro = axios.create({ baseURL: BASE || '/api', timeout: 15000 })
publicPro.interceptors.request.use((c) => { Object.assign(c.headers, deviceHeaders()); return c })

const proApi = axios.create({ baseURL: BASE || '/api', timeout: 20000 })

// ── Session ──────────────────────────────────────────────────────────────────
// Même règle que l'app (session_manager.dart) :
//  - jeton d'accès de 15 min, renouvelé AVANT son expiration ;
//  - un seul renouvellement à la fois (les autres attendent le même) ;
//  - coupure réseau, serveur indisponible, trop de requêtes : la session est
//    GARDÉE et l'erreur remontée comme une erreur réseau ;
//  - seul un refus du serveur (session close, compte gelé) déconnecte.

// Erreurs 401 « métier » : code faux, ticket SMS expiré… — affichées telles
// quelles, jamais de renouvellement (sinon l'appel serait rejoué avec le même
// code faux et compté deux fois).
const CREDENTIAL_CODES = new Set([
  'INVALID_CREDENTIALS', 'PIN_INCORRECT', 'OTP_INVALID', 'OTP_TICKET_INVALID', 'SESSION_REQUIRED',
])
// Session refusée par le serveur : se reconnecter, avec le motif
const LOGOUT_CODES = new Set(['SESSION_REVOKED', 'ACCOUNT_FROZEN', 'ACCOUNT_DELETED'])

// Date d'expiration d'un JWT (sans vérifier la signature)
export function tokenExpiry(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(part.padEnd(part.length + (4 - part.length % 4) % 4, '=')))
    return typeof exp === 'number' ? exp * 1000 : null
  } catch { return null }
}

// Fin de session : message gardé pour l'écran de connexion
export function endSession(message) {
  session.clear()
  if (message) session.setNotice(message)
  window.dispatchEvent(new CustomEvent('dem-pro:logged-out', { detail: { message } }))
}

class RefreshUnavailable extends Error {}

let refreshing = null
async function doRefresh() {
  const rt = session.refreshToken
  if (!rt) throw new RefreshUnavailable('no-refresh')
  try {
    const res = await publicPro.post('/auth/refresh', { refreshToken: rt })
    session.save({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken ?? rt })
    return res.data.accessToken
  } catch (e) {
    const status = e?.response?.status
    // 401 : session close (autre appareil, code réinitialisé, vol détecté) —
    // 423 : compte gelé. Le serveur ne la rouvrira pas : déconnexion.
    if (status === 401 || status === 423) {
      endSession(e.response?.data?.message ?? 'Votre session a expiré. Reconnectez-vous.')
      throw e
    }
    // Réseau, 429, 5xx : on garde la session, on réessaiera
    throw new RefreshUnavailable('network')
  }
}

// Renouvelle la session (une seule fois même si appelé en parallèle)
export function refreshSession() {
  refreshing ??= doRefresh().finally(() => { refreshing = null })
  return refreshing
}

// Jeton à envoyer maintenant : renouvelé à l'avance s'il expire dans moins
// d'une minute. Sans jeton de renouvellement (ancienne connexion par SMS,
// 30 jours), renvoyé tel quel.
export async function validAccessToken() {
  const token = session.accessToken
  if (!token || !session.refreshToken) return token
  const exp = tokenExpiry(token)
  if (exp && exp - Date.now() > 60_000) return token
  try { return await refreshSession() } catch { return session.accessToken }
}

proApi.interceptors.request.use(async (c) => {
  Object.assign(c.headers, deviceHeaders())
  const t = await validAccessToken()
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

const networkError = (original, cause) => {
  const e = new axios.AxiosError('Connexion internet indisponible.', 'ERR_NETWORK', original)
  e.cause = cause
  return e
}

proApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const status = err.response?.status
    const code = err.response?.data?.code
    if (status !== 401 || !original) return Promise.reject(err)

    if (CREDENTIAL_CODES.has(code)) return Promise.reject(err)
    if (LOGOUT_CODES.has(code)) {
      endSession(err.response.data?.message)
      return Promise.reject(err)
    }
    // Jeton expiré (TOKEN_EXPIRED) ou invalide : un renouvellement, puis
    // l'appel est rejoué une fois
    if (session.refreshToken && !original._retried) {
      original._retried = true
      try {
        const token = await refreshSession()
        original.headers.Authorization = `Bearer ${token}`
        return proApi(original)
      } catch (e) {
        if (e instanceof RefreshUnavailable && session.refreshToken) {
          return Promise.reject(networkError(original, err))
        }
        return Promise.reject(err)
      }
    }
    // Ancienne connexion sans renouvellement, ou refusé après renouvellement
    endSession('Votre session a expiré. Reconnectez-vous.')
    return Promise.reject(err)
  }
)

export const errMsg = (e, fallback = 'Action impossible pour le moment. Réessayez dans un instant.') =>
  e?.response?.data?.message ?? (e?.code === 'ECONNABORTED' ? 'Le serveur met trop de temps à répondre.' : !e?.response ? 'Connexion internet indisponible.' : fallback)

export default proApi
