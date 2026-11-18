import axios from 'axios'
import { session, deviceId } from './session'

// Client HTTP de l'espace web DEM Pro : même serveur et mêmes routes que
// l'app DEM Pro (/dem-pro/*, /orders/*, /users/dem-pro/*) — données
// synchronisées par construction.
const BASE = import.meta.env.VITE_API_URL ?? ''

export const PRO_APP_VERSION = 'pro-web-1.0.0'

const deviceHeaders = () => ({
  'X-Device-Id': deviceId(),
  'X-Platform': 'web',
  'X-App-Version': PRO_APP_VERSION,
})

// Sans jeton : connexion, code SMS, code secret
export const publicPro = axios.create({ baseURL: BASE || '/api', timeout: 15000 })
publicPro.interceptors.request.use((c) => { Object.assign(c.headers, deviceHeaders()); return c })

const proApi = axios.create({ baseURL: BASE || '/api', timeout: 20000 })

proApi.interceptors.request.use((c) => {
  Object.assign(c.headers, deviceHeaders())
  const t = session.accessToken
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

// Jeton expiré : un seul renouvellement à la fois, puis on rejoue l'appel
let refreshing = null
async function refreshTokens() {
  const rt = session.refreshToken
  if (!rt) throw new Error('no-refresh')
  const res = await publicPro.post('/auth/refresh', { refreshToken: rt })
  session.save({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken ?? rt })
  return res.data.accessToken
}

proApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && original && !original._retried) {
      original._retried = true
      try {
        refreshing ??= refreshTokens().finally(() => { refreshing = null })
        const token = await refreshing
        original.headers.Authorization = `Bearer ${token}`
        return proApi(original)
      } catch {
        session.clear()
        window.dispatchEvent(new CustomEvent('dem-pro:logged-out'))
      }
    }
    return Promise.reject(err)
  }
)

export const errMsg = (e, fallback = 'Une erreur est survenue. Réessayez.') =>
  e?.response?.data?.message ?? (e?.code === 'ECONNABORTED' ? 'Le serveur met trop de temps à répondre.' : !e?.response ? 'Connexion internet indisponible.' : fallback)

export default proApi
