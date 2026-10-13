import { useSearchParams } from 'react-router-dom'

// Onglet ouvert lu dans l'adresse (?tab=…) : un lien, une redirection ou un
// rechargement rouvre le bon onglet. `tabs` = onglets déjà filtrés par rôle ;
// une valeur inconnue ou interdite retombe sur le premier onglet visible.
export function useUrlTab(tabs) {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('tab')
  const active = tabs.some(t => t.key === wanted) ? wanted : tabs[0]?.key

  function setTab(key) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', key)
      return next
    }, { replace: true })
  }

  return [active, setTab]
}
