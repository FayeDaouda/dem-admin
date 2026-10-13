import { useAuth } from '../../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../../lib/droits'
import RevenueTab from './RevenueTab'
import CaCoursesTab from './CaCoursesTab'
import CoursesTab from './CoursesTab'
import FeesSection from './FeesSection'

// Finance › Revenus — l'écran unique des revenus (plan de refonte, étape
// 3.2) : revenus DEM par source, commission sur les courses par période,
// montants des courses livrées (anciens onglets Revenus, Commission courses
// et Courses) et frais de mise en relation depuis le lancement (ancien
// onglet Frais du Plan d'acquisition, Super Admin seul).
function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>{title}</h2>
      {children}
    </section>
  )
}

export default function RevenusTab() {
  const { user } = useAuth()
  return (
    <div>
      <Section title="Revenus DEM par source"><RevenueTab /></Section>
      <Section title="Commission sur les courses"><CaCoursesTab /></Section>
      <Section title="Courses livrées et montants"><CoursesTab /></Section>
      {canSee(user?.adminRole, ACTION_ROLES.feesSinceLaunch) && (
        <Section title="Frais de mise en relation depuis le lancement"><FeesSection /></Section>
      )}
    </div>
  )
}
