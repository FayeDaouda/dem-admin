import { useSyncExternalStore } from 'react'

// Application installable (PWA) de l'espace DEM Pro.
// index.html est partagé avec l'admin : le manifeste, la couleur du thème,
// l'icône d'écran d'accueil et le service worker sont ajoutés ici, par le
// code de l'espace DEM Pro seulement (pro.dem.sn, ou /pro en local).
// Tout est servi depuis la même origine (CSP de pro.dem.sn : default-src 'self').

let deferred = null          // événement beforeinstallprompt gardé pour le menu
let installed = false
const listeners = new Set()
let snapshot = { canInstall: false, installed: false }
const emit = () => { snapshot = { canInstall: !!deferred, installed }; listeners.forEach(l => l()) }

function upsert(selector, create, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) { el = create(); document.head.appendChild(el) }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}
const link = () => document.createElement('link')
const meta = () => document.createElement('meta')

let done = false
export function setupPwa(basename = '') {
  if (done || typeof window === 'undefined') return
  done = true
  const onPath = basename === '/pro'
  const scope = onPath ? '/pro/' : '/'

  upsert('link[rel="manifest"]', link, { rel: 'manifest', href: onPath ? '/pro/manifest-pro-path.webmanifest' : '/pro/manifest.webmanifest' })
  upsert('meta[name="theme-color"]', meta, { name: 'theme-color', content: '#021520' })
  upsert('link[rel="apple-touch-icon"]', link, { rel: 'apple-touch-icon', href: '/pro/apple-touch-icon.png' })
  upsert('link[rel="icon"]', link, { rel: 'icon', type: 'image/png', href: '/pro/favicon-32.png' })
  upsert('meta[name="apple-mobile-web-app-capable"]', meta, { name: 'apple-mobile-web-app-capable', content: 'yes' })
  upsert('meta[name="mobile-web-app-capable"]', meta, { name: 'mobile-web-app-capable', content: 'yes' })
  upsert('meta[name="apple-mobile-web-app-title"]', meta, { name: 'apple-mobile-web-app-title', content: 'DEM Pro' })
  upsert('meta[name="apple-mobile-web-app-status-bar-style"]', meta, { name: 'apple-mobile-web-app-status-bar-style', content: 'black' })

  installed = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // proposé depuis le menu du compte, pas en bannière
    deferred = e
    emit()
  })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit() })
  emit()

  // Service worker : production seulement (en développement, Vite recharge
  // les pages lui-même). Il ne met rien en cache (voir public/pro-sw.js).
  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    const register = () => navigator.serviceWorker.register('/pro-sw.js', { scope }).catch(() => { /* non bloquant */ })
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }
}

export async function promptInstall() {
  if (!deferred) return false
  const e = deferred
  deferred = null
  emit()
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome === 'accepted'
  } catch { return false }
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const getSnapshot = () => snapshot
export function useInstallPrompt() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// iPhone / iPad : pas d'invite d'installation, ajout manuel depuis Safari
export const isIOS = () => typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
