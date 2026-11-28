import { Check } from 'lucide-react'
import { STEP_LABEL, PREP } from './requestSteps'

// Badges et barre d'étapes des commandes reçues (liste, tableau, panneau)
// Paiement : vert payé en ligne, gris à l'arrivée (normal), orange en attente
export function PayBadge({ r }) {
  const paid = !!r.paidAt
  const later = r.paymentTiming !== 'NOW'
  const tone = paid ? { background: 'var(--p-success-bg)', color: 'var(--p-success)' }
    : later ? { background: 'var(--p-slate-bg)', color: 'var(--p-slate)' }
    : { background: 'var(--p-warning-bg)', color: 'var(--p-warning)' }
  return <span className="badge" style={tone}><span className="badge-dot" aria-hidden />{paid ? 'Payée en ligne' : later ? 'Paiement à l’arrivée' : 'Paiement en attente'}</span>
}

export function StepBadge({ step }) {
  const tone = step === 'DELIVERED' ? { background: 'var(--p-success-bg)', color: 'var(--p-success)' }
    : step === 'CANCELLED' ? { background: 'var(--p-danger-bg)', color: 'var(--p-danger)' }
    : step === 'NEW' ? { background: 'var(--p-info-bg)', color: 'var(--p-info)' }
    : { background: 'var(--p-slate-bg)', color: 'var(--p-slate)' }
  return <span className="badge" style={tone}><span className="badge-dot" aria-hidden />{STEP_LABEL[step] ?? step}</span>
}

// Barre Acceptée → En préparation → Prête
export function PrepProgress({ step }) {
  const at = PREP.indexOf(step)
  return (
    <ol className="rq-prog" aria-label={`Étape : ${STEP_LABEL[step]}`}>
      {PREP.map((s, i) => (
        <li key={s} className={i <= at ? 'on' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="rq-prog-dot" aria-hidden>{i < at ? <Check size={10} /> : null}</span>{STEP_LABEL[s]}
        </li>
      ))}
    </ol>
  )
}
