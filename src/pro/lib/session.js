// Session de l'espace web DEM Pro : jetons + identifiant d'appareil.
// Rangés à part des jetons de l'admin (dem_admin_*) et du chef de flotte.
const K = {
  access: 'dem_pro_access',
  refresh: 'dem_pro_refresh',
  user: 'dem_pro_user',
  device: 'dem_pro_device',
}

const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* navigation privée */ } }

export const session = {
  get accessToken() { return read(K.access) },
  get refreshToken() { return read(K.refresh) },
  get user() { try { return JSON.parse(read(K.user) ?? 'null') } catch { return null } },
  save({ accessToken, refreshToken, user }) {
    if (accessToken !== undefined) write(K.access, accessToken)
    if (refreshToken !== undefined) write(K.refresh, refreshToken)
    if (user !== undefined) write(K.user, user ? JSON.stringify(user) : null)
  },
  clear() { write(K.access, null); write(K.refresh, null); write(K.user, null) },
}

// Identifiant stable de ce navigateur (le serveur l'exige pour le code
// secret et l'affiche dans « Appareils connectés »)
export function deviceId() {
  let id = read(K.device)
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    id = 'web_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    write(K.device, id)
  }
  return id
}

export function deviceName() {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : ''
  return `${browser}${os ? ' · ' + os : ''} (espace web)`
}
