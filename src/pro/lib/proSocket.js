import { io } from 'socket.io-client'
import { validAccessToken, refreshSession } from './proApi'

// Temps réel : les mêmes événements que l'app DEM Pro (course acceptée,
// colis récupéré, livrée, annulée, wallet, nouvelle commande reçue).
//
// Le jeton d'accès dure 15 min : à chaque (re)connexion, le jeton envoyé est
// renouvelé s'il expire bientôt. Si le serveur refuse quand même la poignée
// de main (jeton expiré pendant que l'onglet dormait), socket.io n'essaie
// plus de lui-même : on renouvelle la session puis on relance, avec un délai
// croissant. Au retour de l'onglet, reconnexion immédiate.
let socket = null
let retryTimer = null
let retryDelay = 2000

function scheduleRetry() {
  clearTimeout(retryTimer)
  retryTimer = setTimeout(async () => {
    if (!socket || socket.connected) return
    try { await refreshSession() } catch { /* réseau : on réessaiera */ }
    socket?.connect()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 60_000)
}

function onVisible() {
  if (!document.hidden && socket && !socket.connected) { retryDelay = 2000; socket.connect() }
}

export function proSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    socket = io(url, {
      auth: (cb) => { validAccessToken().then(token => cb({ token })).catch(() => cb({})) },
      transports: ['websocket'],
      autoConnect: false,
      reconnectionDelayMax: 8000,
    })
    socket.on('connect', () => { retryDelay = 2000; clearTimeout(retryTimer) })
    // Refus du serveur (jeton) : pas de reconnexion automatique → on relance
    socket.on('connect_error', () => { if (!socket.active) scheduleRetry() })
    document.addEventListener('visibilitychange', onVisible)
  }
  if (!socket.connected) socket.connect()
  return socket
}

export function closeProSocket() {
  clearTimeout(retryTimer)
  document.removeEventListener('visibilitychange', onVisible)
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}
