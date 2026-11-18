import { createContext, useContext, useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, Bike, PackageCheck, ShoppingBag, Wallet } from 'lucide-react'

// Notifications de l'espace web DEM Pro (fournisseur : notify.jsx)
export const NotifyContext = createContext(null)
export const useNotify = () => useContext(NotifyContext)

export const KIND = {
  success: { icon: CheckCircle2, color: '#16a34a' },
  error:   { icon: AlertTriangle, color: '#dc2626' },
  info:    { icon: Info, color: '#0671ba' },
  driver:  { icon: Bike, color: '#0671ba' },
  delivered: { icon: PackageCheck, color: '#16a34a' },
  order:   { icon: ShoppingBag, color: '#6d5dfc' },
  wallet:  { icon: Wallet, color: '#0cb8de' },
}

// Autorisation des notifications du navigateur (demandée après un clic)
export function useBrowserNotifications() {
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  useEffect(() => {
    if (!('Notification' in window)) return
    const t = setInterval(() => setPerm(Notification.permission), 3000)
    return () => clearInterval(t)
  }, [])
  const ask = async () => {
    if (!('Notification' in window)) return
    setPerm(await Notification.requestPermission())
  }
  return { perm, ask }
}
