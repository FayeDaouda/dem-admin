import { io } from 'socket.io-client'
import { session } from './session'

// Temps réel : les mêmes événements que l'app DEM Pro (course acceptée,
// colis récupéré, livrée, annulée, wallet, nouvelle commande reçue).
let socket = null

export function proSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    socket = io(url, {
      auth: cb => cb({ token: session.accessToken }),
      transports: ['websocket'],
      autoConnect: false,
      reconnectionDelayMax: 8000,
    })
  }
  if (!socket.connected) socket.connect()
  return socket
}

export function closeProSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}
