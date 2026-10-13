import { pageWrap, pageScroll } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { useUrlTab } from '../lib/useUrlTab'
import Broadcast from './Broadcast'
import { BroadcastHistory, AlertForm } from './marketing/CampaignBlocks'

// Notifications (Croissance) — l'écran unique des messages aux utilisateurs
// (plan de refonte, étape 3.10) : envoi et notifications programmées
// (ancienne page Notification), historique des envois et alerte dans l'app
// (ancien onglet Marketing › Campagnes et alertes). Super et Marketing.
const TABS = [
  { key: 'envoyer',    label: 'Envoyer et programmer' },
  { key: 'historique', label: 'Historique' },
  { key: 'alerte',     label: "Alerte dans l'app" },
]

export default function Notifications() {
  const [tab, setTab] = useUrlTab(TABS)
  return (
    <div style={pageWrap}>
      <PageHeader title="Notifications" subtitle="Notifications push, envois programmés et alerte affichée dans l'application" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {tab === 'envoyer'    && <Broadcast embedded />}
        {tab === 'historique' && <BroadcastHistory />}
        {tab === 'alerte'     && <AlertForm />}
      </div>
    </div>
  )
}
