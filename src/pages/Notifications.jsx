import { pageWrap, pageScroll } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { useUrlTab } from '../lib/useUrlTab'
import { useAuth } from '../contexts/AuthContext'
import { canSee, TAB_ROLES, ACTION_ROLES } from '../lib/droits'
import Broadcast from './Broadcast'
import { BroadcastHistory, AlertForm } from './marketing/CampaignBlocks'

// Notifications (Croissance) — l'écran unique des messages aux utilisateurs
// (plan de refonte, étape 3.10) : envoi et notifications programmées
// (ancienne page Notification), historique des envois et alerte dans l'app
// (ancien onglet Marketing › Campagnes et alertes). Super et Marketing ;
// le Responsable de flottes envoie et programme aux coursiers seulement.
const TABS = [
  { key: 'envoyer',    label: 'Envoyer et programmer' },
  { key: 'historique', label: 'Historique' },
  { key: 'alerte',     label: "Alerte dans l'app" },
]

export default function Notifications() {
  const { user } = useAuth()
  const role = user?.adminRole
  const tabs = TABS.filter(t => canSee(role, TAB_ROLES.notifications[t.key]))
  const driversOnly = !canSee(role, ACTION_ROLES.broadcastAll)
  const [tab, setTab] = useUrlTab(tabs)
  return (
    <div style={pageWrap}>
      <PageHeader title="Notifications" subtitle="Notifications push, envois programmés et alerte affichée dans l'application" />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {tab === 'envoyer'    && <Broadcast embedded driversOnly={driversOnly} />}
        {tab === 'historique' && <BroadcastHistory />}
        {tab === 'alerte'     && <AlertForm />}
      </div>
    </div>
  )
}
