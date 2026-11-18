import { useEffect } from 'react'

// Relit la page à chaque événement temps réel (course, wallet, commande
// reçue) et quand l'onglet revient au premier plan — toujours à jour avec
// l'application. Les rafales d'événements sont regroupées en une seule
// relecture (après la dernière, donc jamais d'état final manqué) : le quota
// de requêtes du serveur est partagé avec l'app mobile du même compte.
export function useLiveRefresh(load, { delayMs = 700, awayMs = 20_000 } = {}) {
  useEffect(() => {
    let timer = null
    let hiddenAt = 0
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(load, delayMs)
    }
    const onVisibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); return }
      if (hiddenAt && Date.now() - hiddenAt > awayMs) schedule()
    }
    window.addEventListener('dem-pro:refresh', schedule)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('dem-pro:refresh', schedule)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, delayMs, awayMs])
}
