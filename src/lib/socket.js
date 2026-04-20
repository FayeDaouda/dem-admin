import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('dem_admin_token')
    const url = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    socket = io(url, {
      auth: { token },
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

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
