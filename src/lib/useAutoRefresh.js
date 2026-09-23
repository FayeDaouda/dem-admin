import { useEffect, useRef } from 'react'

// Relance périodiquement `callback` (ex: le `load`/`fetchX` déjà utilisé au
// montage) — tant que l'onglet du navigateur est visible, pour ne pas taper
// l'API en boucle pendant que l'admin a switché sur un autre onglet/appli.
// `callback` est lu via une ref (jamais dans les deps du setInterval) pour
// rester stable même si le composant appelant ne le mémoïse pas avec
// useCallback — évite de relancer l'intervalle à chaque render.
export function useAutoRefresh(callback, intervalMs = 30_000) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') cbRef.current()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
