import { Lock } from 'lucide-react'
import { useProAuth, ACCESS, ROLE_LABEL } from '../proAuthContext'
import { Button } from './ui'

// Page réservée au responsable (ou aux gérants) : un membre de l'équipe qui
// l'ouvre (lien partagé, favori) voit pourquoi, au lieu d'erreurs 403.
// Usage : <RequireAccess area="team"><Team /></RequireAccess>
export default function RequireAccess({ area, children }) {
  const { can, memberRole, member } = useProAuth()
  if (can(area)) return children
  const ownerOnly = ACCESS[area] === 'OWNER'
  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto', padding: '36px 32px', display: 'grid', gap: 12, justifyItems: 'start' }} role="alert">
      <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', background: 'var(--p-slate-bg)', color: 'var(--p-slate)' }}>
        <Lock size={20} aria-hidden />
      </span>
      <h1 style={{ margin: 0, font: '700 22px/1.25 var(--p-head)' }}>
        {ownerOnly ? 'Réservé au responsable de la boutique' : 'Réservé au responsable et aux gérants'}
      </h1>
      <p className="muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
        Vous êtes connecté comme {ROLE_LABEL[memberRole]?.toLowerCase() ?? 'membre'}{member?.name ? ` (${member.name})` : ''}.
        {ownerOnly
          ? ' L\'argent, les offres, l\'équipe et le profil de la boutique restent gérés par son responsable.'
          : ' Demandez au responsable de vous passer gérant si vous avez besoin de ces chiffres.'}
      </p>
      <Button variant="ghost" to="/livraisons" style={{ marginTop: 6 }}>Aller aux livraisons</Button>
    </div>
  )
}
