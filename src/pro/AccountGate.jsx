import { Clock, ShieldOff, XCircle, Smartphone } from 'lucide-react'
import { useProAuth } from './proAuthContext'
import { Button } from './ui/ui'

// Statut du compte DEM Pro, même ordre que l'app (app_startup_notifier.dart) :
// suspendu, inscription inachevée, en attente de validation, refusé.
// Tant que le compte n'est pas actif, l'espace web ne s'ouvre pas.
export const SUPPORT_WHATSAPP = 'https://wa.me/221784448524'

export function accountState(user) {
  if (!user) return null
  if (user.isActive === false) return 'SUSPENDED'
  if (!user.proBusinessName) return 'ONBOARDING'
  if (user.proStatus === 'PENDING') return 'PENDING'
  if (user.proStatus === 'REJECTED') return 'REJECTED'
  if (user.proStatus === 'ACTIVE') return 'ACTIVE'
  return 'ONBOARDING'
}

const SCREENS = {
  SUSPENDED: {
    icon: ShieldOff, tone: 'danger',
    title: 'Votre compte DEM Pro est suspendu',
    text: 'Vous ne pouvez plus créer de livraisons ni retirer d\'argent pour le moment. Écrivez au support DEM pour en connaître la raison et le réactiver.',
  },
  ONBOARDING: {
    icon: Smartphone, tone: 'info',
    title: 'Terminez votre inscription dans l\'application',
    text: 'Votre compte DEM Pro n\'est pas encore complet. Ouvrez l\'application DEM sur votre téléphone pour renseigner votre boutique, puis revenez ici.',
  },
  PENDING: {
    icon: Clock, tone: 'info',
    title: 'Votre compte est en cours de validation',
    text: 'L\'équipe DEM vérifie vos informations, en général sous 24 heures. Vous serez prévenu par SMS dès que votre espace sera ouvert.',
  },
  REJECTED: {
    icon: XCircle, tone: 'danger',
    title: 'Votre demande n\'a pas été acceptée',
    text: 'Vous pouvez corriger vos informations dans l\'application DEM et refaire une demande, ou écrire au support pour en parler.',
  },
}

export default function AccountGate({ children }) {
  const { user, logout, refreshMe } = useProAuth()
  const state = accountState(user)
  if (state === 'ACTIVE') return children
  const s = SCREENS[state] ?? SCREENS.ONBOARDING
  const Icon = s.icon
  return (
    <div className="pro gate">
      <div className="gate-card" role="main">
        <span className={`gate-icon gate-${s.tone}`}><Icon size={22} aria-hidden /></span>
        <p className="label-caps" style={{ margin: 0 }}>DEM <span style={{ color: 'var(--p-link)' }}>Pro</span></p>
        <h1 className="gate-title">{s.title}</h1>
        <p className="gate-text">{s.text}</p>
        {state === 'REJECTED' && user?.rejectionReason && (
          <p className="gate-reason"><b>Motif :</b> {user.rejectionReason}</p>
        )}
        <div className="gate-actions">
          {state === 'PENDING' || state === 'ONBOARDING'
            ? <Button onClick={() => refreshMe().catch(() => {})}>Vérifier à nouveau</Button>
            : <Button href={SUPPORT_WHATSAPP} target="_blank" rel="noreferrer">Écrire au support</Button>}
          <Button variant="ghost" onClick={logout}>Se déconnecter</Button>
        </div>
      </div>
    </div>
  )
}
