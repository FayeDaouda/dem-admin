import { useAuth } from '../../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../../lib/droits'
import PassTab from './PassTab'
import PassDueSection from './PassDueSection'
import InfoTip from '../../components/InfoTip'

// Finance › Pass coursiers (plan de refonte, étape 3.3) : pass achetés et
// offerts, coursiers avec un pass valide, et — Super Admin seul — le dû par
// les coursiers avec le prélèvement manuel (ancien onglet Pass du Plan
// d'acquisition). Les montants se règlent dans Tarifs et zones.
export default function PassCoursiersTab() {
  const { user } = useAuth()
  return (
    <div>
      <PassTab />
      {canSee(user?.adminRole, ACTION_ROLES.passDue) && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Dû par les coursiers<InfoTip k="Dû par les coursiers" size={13} /></h2>
          <PassDueSection />
        </section>
      )}
    </div>
  )
}
