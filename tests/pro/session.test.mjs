import './setup.mjs'
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import proApi, { publicPro, tokenExpiry } from '../../src/pro/lib/proApi.js'
import { session } from '../../src/pro/lib/session.js'

// Jeton JWT factice (seul `exp` est lu côté navigateur)
const jwt = (secondsLeft, tag = '') => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64({ userId: 'u1', exp: Math.floor(Date.now() / 1000) + secondsLeft, tag })}.sig`
}
const reply = (config, status, data) => {
  if (status >= 400) {
    const e = new Error(`HTTP ${status}`)
    e.config = config; e.response = { status, data, config, headers: {} }; e.isAxiosError = true
    return Promise.reject(e)
  }
  return Promise.resolve({ status, data, config, headers: {}, statusText: 'OK' })
}
const networkDown = (config) => { const e = new Error('Network Error'); e.config = config; e.code = 'ERR_NETWORK'; return Promise.reject(e) }

let api, refresh, logouts
window.addEventListener('dem-pro:logged-out', (e) => logouts.push(e.detail?.message ?? null))
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  api = []; refresh = []; logouts = []
})
const serve = (apiHandler, refreshHandler) => {
  proApi.defaults.adapter = (c) => { api.push({ url: c.url, auth: c.headers.Authorization, body: c.data }); return apiHandler(c) }
  publicPro.defaults.adapter = (c) => { refresh.push(c.url); return refreshHandler(c) }
}
const fresh = jwt(900, 'neuf')
const okRefresh = (c) => reply(c, 200, { accessToken: fresh, refreshToken: 'rt-2' })

test('tokenExpiry lit exp ; jeton illisible → null', () => {
  const exp = tokenExpiry(jwt(60))
  assert.ok(exp > Date.now() && exp <= Date.now() + 61_000)
  assert.equal(tokenExpiry('pas-un-jwt'), null)
})

test('code secret faux (401 PIN_INCORRECT) : PAS rejoué, pas de renouvellement, session gardée', async () => {
  session.save({ accessToken: jwt(600), refreshToken: 'rt-1' })
  serve((c) => reply(c, 401, { code: 'PIN_INCORRECT', message: 'Code secret incorrect.' }), okRefresh)
  await assert.rejects(proApi.post('/users/dem-pro/wallet/cashout', { amount: 5000, pin: '111111' }), (e) => e.response?.data?.code === 'PIN_INCORRECT')
  assert.equal(api.length, 1, 'le retrait ne part qu’une fois')
  assert.equal(refresh.length, 0)
  assert.equal(session.refreshToken, 'rt-1')
})

test('jeton expiré (401 TOKEN_EXPIRED) : un renouvellement puis l’appel est rejoué', async () => {
  session.save({ accessToken: jwt(600, 'vieux'), refreshToken: 'rt-1' })
  serve((c) => c.headers.Authorization === `Bearer ${fresh}` ? reply(c, 200, { ok: true }) : reply(c, 401, { code: 'TOKEN_EXPIRED' }), okRefresh)
  const res = await proApi.get('/users/me')
  assert.deepEqual(res.data, { ok: true })
  assert.equal(api.length, 2)
  assert.deepEqual(refresh, ['/auth/refresh'])
  assert.equal(session.refreshToken, 'rt-2')
})

test('jeton proche de l’expiration : renouvelé AVANT l’appel', async () => {
  session.save({ accessToken: jwt(20), refreshToken: 'rt-1' })
  serve((c) => reply(c, 200, { ok: true }), okRefresh)
  await proApi.get('/users/me')
  assert.deepEqual(refresh, ['/auth/refresh'])
  assert.equal(api[0].auth, `Bearer ${fresh}`)
})

test('401 simultanés : UN SEUL renouvellement', async () => {
  session.save({ accessToken: jwt(600, 'vieux'), refreshToken: 'rt-1' })
  serve(
    (c) => c.headers.Authorization === `Bearer ${fresh}` ? reply(c, 200, { ok: true }) : reply(c, 401, { code: 'TOKEN_EXPIRED' }),
    (c) => new Promise(r => setTimeout(() => r(okRefresh(c)), 20)),
  )
  await Promise.all([1, 2, 3, 4].map(i => proApi.get(`/orders/${i}`)))
  assert.equal(refresh.length, 1)
})

test('coupure réseau pendant le renouvellement : session GARDÉE, erreur réseau', async () => {
  session.save({ accessToken: jwt(600), refreshToken: 'rt-1' })
  serve((c) => reply(c, 401, { code: 'TOKEN_EXPIRED' }), networkDown)
  await assert.rejects(proApi.get('/users/me'), (e) => !e.response && e.code === 'ERR_NETWORK')
  assert.equal(session.refreshToken, 'rt-1')
  assert.equal(logouts.length, 0)
})

test('serveur indisponible (503) pendant le renouvellement : session gardée', async () => {
  session.save({ accessToken: jwt(600), refreshToken: 'rt-1' })
  serve((c) => reply(c, 401, { code: 'TOKEN_EXPIRED' }), (c) => reply(c, 503, {}))
  await assert.rejects(proApi.get('/users/me'))
  assert.equal(session.refreshToken, 'rt-1')
})

test('session refusée au renouvellement (401) : déconnexion, motif gardé pour la connexion', async () => {
  session.save({ accessToken: jwt(600), refreshToken: 'rt-1' })
  serve((c) => reply(c, 401, { code: 'TOKEN_EXPIRED' }), (c) => reply(c, 401, { code: 'SESSION_INVALID', message: 'Session expirée. Reconnectez-vous avec votre code secret.' }))
  await assert.rejects(proApi.get('/users/me'))
  assert.equal(session.accessToken, null)
  assert.equal(logouts.length, 1)
  assert.equal(session.takeNotice(), 'Session expirée. Reconnectez-vous avec votre code secret.')
})

test('appareil déconnecté depuis Compte (SESSION_REVOKED) : déconnexion avec le motif, sans renouveler', async () => {
  session.save({ accessToken: jwt(600), refreshToken: 'rt-1' })
  serve((c) => reply(c, 401, { code: 'SESSION_REVOKED', message: 'Ce téléphone a été déconnecté de votre compte DEM Pro.' }), okRefresh)
  await assert.rejects(proApi.get('/users/me'))
  assert.equal(refresh.length, 0)
  assert.equal(session.accessToken, null)
  assert.equal(session.takeNotice(), 'Ce téléphone a été déconnecté de votre compte DEM Pro.')
})

test('ancienne connexion par SMS (sans renouvellement) refusée : déconnexion', async () => {
  session.save({ accessToken: 'ancien-jeton' })
  serve((c) => reply(c, 401, { message: 'Token invalide ou expiré.' }), okRefresh)
  await assert.rejects(proApi.get('/users/me'))
  assert.equal(refresh.length, 0)
  assert.equal(session.accessToken, null)
})

test('en-têtes d’appareil : web, identifiant stable, nom en ASCII', async () => {
  session.save({ accessToken: jwt(600), refreshToken: 'rt-1' })
  let headers
  proApi.defaults.adapter = (c) => { headers = c.headers; return reply(c, 200, {}) }
  await proApi.get('/users/me')
  assert.equal(headers['X-Platform'], 'web')
  assert.match(headers['X-Device-Id'], /^web_[0-9a-f]{36}$/)
  assert.match(headers['X-Device'], /^[\x20-\x7E]+$/)
})
