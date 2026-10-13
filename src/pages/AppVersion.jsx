import { pageWrap, pageScroll } from '../lib/glassStyles'
import { useAuth } from '../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../lib/droits'
import PageHeader from '../components/PageHeader'
import AppVersionTab from './AppVersionTab'

// Version de l'app (Administration) — ancien onglet de Tarifs (plan de
// refonte, étape 3.5). Lecture Super + Dev, modification Super (serveur).
export default function AppVersion() {
  const { user } = useAuth()
  return (
    <div style={pageWrap}>
      <PageHeader title="Version de l'app" subtitle="Version minimale et invitation à mettre à jour l'application" />
      <div style={pageScroll}>
        <AppVersionTab canEdit={canSee(user?.adminRole, ACTION_ROLES.appVersionEdit)} />
      </div>
    </div>
  )
}
