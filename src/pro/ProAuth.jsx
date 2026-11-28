import { useCallback, useEffect, useMemo, useState } from 'react'
import proApi, { publicPro } from './lib/proApi'
import { session, deviceName } from './lib/session'
import { closeProSocket } from './lib/proSocket'
import { ProAuthContext, NotProAccount, TEAM_MESSAGES, memberRoleOf, canAccess } from './proAuthContext'

// Connexion à l'espace web DEM Pro : le même compte que dans l'app.
// Numéro → POST /auth/identify : PIN (code secret), OTP (code SMS) ou
// OTP_THEN_PIN (code SMS puis création du code secret, comme dans l'app).
// Numéro membre d'une équipe : le serveur renvoie `teamAccounts` ; on
// propose la boutique ou le compte personnel, puis POST /auth/team-login
// (comme l'app, auth_navigation.dart:completeLogin).
const NOT_PRO = 'Ce numéro n\'est pas un compte DEM Pro. Créez votre compte DEM Pro dans l\'application DEM, puis revenez ici.'
function assertPro(user) {
  if (!user || user.role !== 'DEM_PRO') throw new NotProAccount(NOT_PRO)
}

// Refus « réservé au responsable / aux gérants » : message clair partout
// (errMsg lit data.message), et profil relu — le rôle du membre a pu
// changer depuis l'ouverture de la page.
let onTeamRefusal = null
proApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const code = err?.response?.data?.code
    if (err?.response?.status === 403 && TEAM_MESSAGES[code]) {
      err.response.data = { ...err.response.data, message: TEAM_MESSAGES[code] }
      err.teamRefusal = code
      onTeamRefusal?.()
    }
    return Promise.reject(err)
  },
)

const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

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

  // Refus d'équipe : profil relu au plus toutes les 30 s
  useEffect(() => {
    let last = 0
    onTeamRefusal = () => {
      if (Date.now() - last < 30_000) return
      last = Date.now()
      refreshMe().catch(() => {})
    }
    return () => { onTeamRefusal = null }
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
        // Même boutique mais autre personne (responsable ↔ membre) : rechargé aussi
        const who = (u) => `${u?.id}|${u?.teamMember?.id ?? ''}`
        if (before && next && who(before) !== who(next)) { closeProSocket(); window.location.reload(); return }
        setUser(next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('dem-pro:logged-out', onOut)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  function startSession(payload) {
    // Code secret : { accessToken, refreshToken, user } ; code SMS : { token, user }
    const accessToken = payload.accessToken ?? payload.token
    assertPro(payload.user)
    session.save({ accessToken, refreshToken: payload.refreshToken ?? null, user: payload.user })
    setUser(payload.user)
    refreshMe().catch(() => {})
    return payload.user
  }

  // Après le code secret ou le code SMS : un numéro membre d'une équipe
  // choisit d'abord (Login affiche le choix) ; rien n'est enregistré avant.
  function afterLogin(payload) {
    const teams = Array.isArray(payload?.teamAccounts) ? payload.teamAccounts : []
    if (teams.length > 0) {
      return {
        choose: {
          teams,
          payload,
          // Le compte personnel ne s'ouvre ici que s'il est DEM Pro
          personalIsPro: payload.user?.role === 'DEM_PRO',
          personalName: payload.user?.name ?? null,
        },
      }
    }
    return { user: startSession(payload) }
  }

  // Entrée dans la boutique : jeton de la boutique (sans renouvellement,
  // 30 jours) qui REMPLACE la session personnelle du membre, fermée côté
  // serveur — comme l'app (auth_storage.dart:replaceSessionWithToken).
  async function enterTeam(pending, membershipId) {
    const personal = pending.payload.accessToken ?? pending.payload.token
    let res
    try {
      res = await publicPro.post('/auth/team-login', { membershipId }, bearer(personal))
    } catch (e) {
      if (e?.response?.status === 401) {
        const err = new Error('Votre connexion a expiré. Saisissez à nouveau votre numéro.')
        err.expired = true
        throw err
      }
      throw e
    }
    const token = res.data?.token
    if (!token) throw new Error('Impossible d\'ouvrir le compte de la boutique.')
    const me = (await publicPro.get('/users/me', bearer(token))).data
    assertPro(me)
    if (pending.payload.refreshToken) {
      publicPro.post('/auth/logout', {}, { ...bearer(personal), timeout: 4000 }).catch(() => {})
    }
    session.save({ accessToken: token, refreshToken: null, user: me })
    setUser(me)
    return me
  }

  const enterPersonal = (pending) => startSession(pending.payload)

  const member = user?.teamMember ?? null
  const memberRole = memberRoleOf(user)
  const can = useCallback((area) => canAccess(user, area), [user])
  const team = useMemo(() => ({
    member, memberRole,
    isOwner: !memberRole,
    isManager: !memberRole || memberRole === 'MANAGER',
  }), [member, memberRole])

  const api = {
    user, loading, refreshMe,
    ...team, can,
    identify: async (phone) => (await publicPro.post('/auth/identify', { phone })).data.next,
    loginWithPin: async (phone, pin) =>
      afterLogin((await publicPro.post('/auth/login', { phone, pin, deviceName: deviceName() })).data),
    sendOtp: async (phone) => (await publicPro.post('/auth/send-otp', { phone })).data,
    verifyOtp: async (phone, code) => afterLogin((await publicPro.post('/auth/verify-otp', { phone, code })).data),
    sendSetupOtp: async (phone) => (await publicPro.post('/auth/pin/otp/send', { phone })).data,
    verifySetupOtp: async (phone, code) => (await publicPro.post('/auth/pin/otp/verify', { phone, code })).data.otpTicket,
    setupPin: async (otpTicket, pin) =>
      afterLogin((await publicPro.post('/auth/pin/setup', { otpTicket, pin, deviceName: deviceName() })).data),
    enterTeam, enterPersonal,
    // Nouveau jeton d'accès renvoyé par le serveur (code secret ou numéro
    // changé) : le jeton de renouvellement reste le même
    saveAccessToken: (accessToken, nextUser) => {
      if (accessToken) session.save({ accessToken })
      if (nextUser) { session.save({ user: { ...session.user, ...nextUser } }); setUser(u => ({ ...u, ...nextUser })) }
    },
    // Connexion par code secret (jeton renouvelable) : changement de code,
    // de numéro et « déconnecter partout » possibles
    hasPinSession: () => !!session.refreshToken,
    logout: async () => {
      try { await proApi.post('/auth/logout', {}, { timeout: 4000 }) } catch { /* déconnexion locale quand même */ }
      closeProSocket()
      session.clear()
      setUser(null)
    },
  }

  return <ProAuthContext.Provider value={api}>{children}</ProAuthContext.Provider>
}
