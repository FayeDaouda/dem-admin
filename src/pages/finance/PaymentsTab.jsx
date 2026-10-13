import { useSearchParams } from 'react-router-dom'
import TabBar from '../../components/TabBar'
import TransactionsTab from './TransactionsTab'
import UnpaidTab from './UnpaidTab'
import SamirpayTab from './SamirpayTab'

// Finance › Paiements — l'écran unique des paiements (plan de refonte,
// étape 3.1). Vue ouverte dans l'adresse (?vue=…) :
//   encaissements : canaux d'encaissement des courses (ancien onglet
//                   « Paiements des courses »)
//   impayes       : impayés et litiges, résolution (ancienne page /payments)
//   en-ligne      : SamirPay, remboursements, retraits à vérifier (ancien
//                   onglet « Paiement en ligne »)
const VIEWS = [
  { key: 'encaissements', label: 'Encaissements',       Component: TransactionsTab },
  { key: 'impayes',       label: 'Impayés et litiges',  Component: UnpaidTab },
  { key: 'en-ligne',      label: 'Paiement en ligne',   Component: SamirpayTab },
]

export default function PaymentsTab() {
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find(v => v.key === params.get('vue')) ?? VIEWS[0]

  function setView(key) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('vue', key)
      return next
    }, { replace: true })
  }

  const Active = view.Component
  return (
    <div>
      <TabBar tabs={VIEWS} active={view.key} onChange={setView} />
      <Active />
    </div>
  )
}
