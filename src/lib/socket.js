import { io } from 'socket.io-client'

// Une seule connexion temps réel pour toute la session admin, partagée par les
// pages et les bandeaux d'alerte (SOS, dispatch, demandes). Les pages n'y
// retirent que LEURS écouteurs (s.off(ev, handler)) et ne la ferment jamais :
// seule la déconnexion du compte la ferme (AuthContext.logout).
let socket = null

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    socket = io(url, {
      // Relu à chaque (re)connexion : toujours le jeton de la session en cours
      auth: cb => cb({ token: localStorage.getItem('dem_admin_token') }),
      transports: ['websocket'],
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

// Déconnexion du compte uniquement.
export function disconnectSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}
