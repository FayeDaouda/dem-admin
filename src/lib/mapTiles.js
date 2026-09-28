// Fond de carte Leaflet partagé (LiveMap, FleetMap) — voir components/MapBaseLayer.
// Google Maps si VITE_GOOGLE_MAPS_API_KEY est défini (clé web : "Maps JavaScript API",
// restreinte par referrer HTTP), sinon OSM. CARTO exige désormais une clé API.

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

export const MAP_TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

let googlePromise = null
let googleAuthFailed = false
const authFailureListeners = new Set()

// Charge l'API JS Google Maps une seule fois pour toute l'app.
export function loadGoogleMaps() {
  if (googlePromise) return googlePromise
  googlePromise = new Promise((resolve, reject) => {
    // Appelé par Google quand la clé est refusée (API non activée, referrer non autorisé…)
    window.gm_authFailure = () => {
      googleAuthFailed = true
      authFailureListeners.forEach(fn => fn())
    }
    window.__demGoogleMapsReady = () => {
      window.google.maps.importLibrary('maps').then(resolve, reject)
    }
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      loading: 'async',
      callback: '__demGoogleMapsReady',
      language: 'fr',
      region: 'SN',
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      googlePromise = null
      reject(new Error('Google Maps injoignable'))
    }
    document.head.appendChild(script)
  })
  return googlePromise
}

export function onGoogleAuthFailure(fn) {
  if (googleAuthFailed) {
    fn()
    return () => {}
  }
  authFailureListeners.add(fn)
  return () => authFailureListeners.delete(fn)
}
