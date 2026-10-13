import { useState } from 'react'
import { RefreshCw, LayoutGrid, AlertTriangle, Gift, ClipboardList } from 'lucide-react'
import { pageWrap, pageScroll } from '../../lib/glassStyles'
import PageHeader from '../../components/PageHeader'
import TabBar from '../../components/TabBar'
import { useUrlTab } from '../../lib/useUrlTab'
import KpiRow from './components/KpiRow'
import OverviewTab from './OverviewTab'
import IncidentsTab from './IncidentsTab'
import GestesTab from './GestesTab'
import RequestsTab from './RequestsTab'

// Poste Service Client — espace de travail du Service Client (plan de
// refonte). Onglet ouvert dans l'adresse (?tab=). Le déblocage des codes SMS
// et la sécurité d'un compte sont dans Comptes › Codes et accès.
const TABS = [
  { key: 'overview',  label: "Vue d'ensemble",     icon: LayoutGrid,    Component: OverviewTab },
  { key: 'incidents', label: 'Incidents',          icon: AlertTriangle, Component: IncidentsTab },
  { key: 'gestes',    label: 'Gestes commerciaux', icon: Gift,          Component: GestesTab },
  { key: 'requests',  label: 'Mes demandes',       icon: ClipboardList, Component: RequestsTab },
]

export default function ServiceClient() {
  const [tab, setTab] = useUrlTab(TABS)
  const [reloadKey, setReloadKey] = useState(0)

  const Active = TABS.find(t => t.key === tab).Component

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Poste Service Client"
        subtitle="Support clients et coursiers, gestes commerciaux et demandes"
        actions={<button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      <div style={pageScroll}>
        <KpiRow reloadKey={reloadKey} />
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        <Active key={`${tab}-${reloadKey}`} />
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
