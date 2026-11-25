import { useCallback, useEffect, useState } from 'react'
import proApi, { publicPro } from './lib/proApi'
import { session, deviceName } from './lib/session'
import { closeProSocket } from './lib/proSocket'
import { ProAuthContext, NotProAccount } from './proAuthContext'

// Connexion à l'espace web DEM Pro : le même compte que dans l'app.
// Numéro → POST /auth/identify : PIN (code secret), OTP (code SMS) ou
// OTP_THEN_PIN (code SMS puis création du code secret, comme dans l'app).
function assertPro(user) {
  if (!user || user.role !== 'DEM_PRO') {
    throw new NotProAccount('Ce numéro n\'est pas un compte DEM Pro. Créez votre compte DEM Pro dans l\'application DEM, puis revenez ici.')
  }
}

export function ProAuthProvider({ children }) {
  const [user, setUser] = useState(() => session.user)
  const [loading, setLoading] = useState(() => !!session.accessToken)

  // Profil complet relu au démarrage (le jeton se renouvelle tout seul)
  const refreshMe = useCallback(async () => {
    const res = await proApi.get('/users/me')
    assertPro(res.data)
    session.save({ user: res.data })
    setUser(res.data)
    return res.data
  }, [])

  useEffect(() => {
    if (!session.accessToken) return
    refreshMe()
      .catch((e) => {
        // 401 : le client HTTP a déjà fermé la session si le serveur l'a refusée
        if (e instanceof NotProAccount) { session.clear(); setUser(null) }
        else if (!session.accessToken) setUser(null)
      })
      .finally(() => setLoading(false))
  }, [refreshMe])

  useEffect(() => {
    const onOut = () => { closeProSocket(); setUser(null) }
    window.addEventListener('dem-pro:logged-out', onOut)
    // Autres onglets : déconnexion ou connexion d'un AUTRE compte (ordinateur
    // partagé en boutique) — l'onglet suit, il n'agit jamais sur le mauvais compte
    const onStorage = (e) => {
      if (e.key === session.keys.access && !e.newValue) { closeProSocket(); setUser(null); return }
      if (e.key === session.keys.user) {
        const parse = (v) => { try { return JSON.parse(v ?? 'null') } catch { return null } }
        const before = parse(e.oldValue), next = parse(e.newValue)
        if (before && next && before.id !== next.id) { closeProSocket(); window.location.reload(); return }
        setUser(next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('dem-pro:logged-out', onOut)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  async function startSession(payload) {
    // Code secret : { accessToken, refreshToken, user } ; code SMS : { token, user }
    const accessToken = payload.accessToken ?? payload.token
    assertPro(payload.user)
    session.save({ accessToken, refreshToken: payload.refreshToken ?? null, user: payload.user })
    setUser(payload.user)
    refreshMe().catch(() => {})
    return payload.user
  }

  const api = {
    user, loading, refreshMe,
    identify: async (phone) => (await publicPro.post('/auth/identify', { phone })).data.next,
    loginWithPin: async (phone, pin) =>
      startSession((await publicPro.post('/auth/login', { phone, pin, deviceName: deviceName() })).data),
    sendOtp: async (phone) => (await publicPro.post('/auth/send-otp', { phone })).data,
    verifyOtp: async (phone, code) => startSession((await publicPro.post('/auth/verify-otp', { phone, code })).data),
    sendSetupOtp: async (phone) => (await publicPro.post('/auth/pin/otp/send', { phone })).data,
    verifySetupOtp: async (phone, code) => (await publicPro.post('/auth/pin/otp/verify', { phone, code })).data.otpTicket,
    setupPin: async (otpTicket, pin) =>
      startSession((await publicPro.post('/auth/pin/setup', { otpTicket, pin, deviceName: deviceName() })).data),
    logout: async () => {
      try { await proApi.post('/auth/logout', {}, { timeout: 4000 }) } catch { /* déconnexion locale quand même */ }
      closeProSocket()
      session.clear()
      setUser(null)
    },
  }

  return <ProAuthContext.Provider value={api}>{children}</ProAuthContext.Provider>
}
