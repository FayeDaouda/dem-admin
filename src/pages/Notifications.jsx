import { pageWrap, pageScroll } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { useUrlTab } from '../lib/useUrlTab'
import { useAuth } from '../contexts/AuthContext'
import { canSee, roleHas, TAB_ROLES, ACTION_ROLES } from '../lib/droits'
import Broadcast from './Broadcast'
import { BroadcastHistory, AlertForm } from './marketing/CampaignBlocks'
import { SegmentsTab, ResultsTab, CodesTab } from './notifications/CmCampaignTabs'

// Notifications (Croissance) — l'écran unique des messages aux utilisateurs
// (plan de refonte, étape 3.10) : envoi et notifications programmées
// (ancienne page Notification), historique des envois et alerte dans l'app
// (ancien onglet Marketing › Campagnes et alertes). Super et Marketing ;
// le Responsable de flottes envoie et programme aux coursiers seulement, le
// CM / CRM Client aux clients (l'envoi à tous et l'alerte : demandes) et à
// ses segments, avec les résultats et les codes de campagne (C3, C4, C6).
const TABS = [
  { key: 'envoyer',    label: 'Envoyer et programmer' },
  { key: 'segments',   label: 'Segments' },
  { key: 'resultats',  label: 'Résultats' },
  { key: 'codes',      label: 'Codes de campagne' },
  { key: 'historique', label: 'Historique' },
  { key: 'alerte',     label: "Alerte dans l'app" },
]

export default function Notifications() {
  const { user } = useAuth()
  const role = user?.adminRole
  const tabs = TABS.filter(t => canSee(role, TAB_ROLES.notifications[t.key]))
  const audience = canSee(role, ACTION_ROLES.broadcastAll) ? null : roleHas(role, 'FLOTTE') ? 'drivers' : 'clients'
  const [tab, setTab] = useUrlTab(tabs)
  return (
    <div style={pageWrap}>
      <PageHeader title="Notifications" subtitle="Notifications push, envois programmés et alerte affichée dans l'application" />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {tab === 'envoyer'    && <Broadcast embedded audience={audience} canSegment={canSee(role, TAB_ROLES.notifications.segments)} />}
        {tab === 'segments'   && <SegmentsTab />}
        {tab === 'resultats'  && <ResultsTab />}
        {tab === 'codes'      && <CodesTab asks={roleHas(role, 'CM')} />}
        {tab === 'historique' && <BroadcastHistory />}
        {tab === 'alerte'     && <AlertForm asks={!canSee(role, ACTION_ROLES.appAlertEdit)} />}
      </div>
    </div>
  )
}
