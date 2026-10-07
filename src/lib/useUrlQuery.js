import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// Recherche reprise de l'URL (?q=…) — c'est ainsi que la recherche globale
// de l'en-tête ouvre une page de liste déjà filtrée. Ajusté pendant le rendu
// (pas dans un effet) : une nouvelle recherche globale sur la page déjà
// ouverte remplace aussi la saisie.
export function useUrlQuery(setSearch) {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [applied, setApplied] = useState('')
  if (q && q !== applied) {
    setApplied(q)
    setSearch(q)
  }
}
