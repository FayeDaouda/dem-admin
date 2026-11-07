import { useState } from 'react'
import { RefreshCw, LayoutGrid, Gift, ClipboardList } from 'lucide-react'
import { pageWrap, pageScroll } from '../../lib/glassStyles'
import PageHeader from '../../components/PageHeader'
import TabBar from '../../components/TabBar'
import { useUrlTab } from '../../lib/useUrlTab'
import KpiRow from './components/KpiRow'
import ProKpiRow from './components/ProKpiRow'
import { useAuth } from '../../contexts/AuthContext'
import { roleHas } from '../../lib/droits'
import OverviewTab from './OverviewTab'
import GestesTab from './GestesTab'
import RequestsTab from './RequestsTab'

// Poste Service Client — espace de travail du Service Client (plan de
// refonte). Onglet ouvert dans l'adresse (?tab=). Le déblocage des codes SMS
// et la sécurité d'un compte sont dans Comptes › Codes et accès, les
// incidents (et « Signaler un utilisateur ») dans Opérations › Incidents.
const TABS = [
  { key: 'overview',  label: "Vue d'ensemble",     icon: LayoutGrid,    Component: OverviewTab },
  { key: 'gestes',    label: 'Gestes commerciaux', icon: Gift,          Component: GestesTab },
  { key: 'requests',  label: 'Mes demandes',       icon: ClipboardList, Component: RequestsTab },
]

// Commercial / CRM Pro (sans Service Client) : « Poste Commercial » — gestes
// commerciaux sur les Pro et Mes demandes, compteurs Pro (dossier du 07/11/2026).
const COMMERCIAL_TABS = TABS.filter(t => t.key !== 'overview')

export default function ServiceClient() {
  const { user } = useAuth()
  const commercial = roleHas(user?.adminRole, 'COMMERCIAL') && !roleHas(user?.adminRole, 'SERVICE_CLIENT')
  const tabs = commercial ? COMMERCIAL_TABS : TABS
  const [tab, setTab] = useUrlTab(tabs)
  const [reloadKey, setReloadKey] = useState(0)

  const Active = tabs.find(t => t.key === tab).Component

  return (
    <div style={pageWrap}>
      <PageHeader
        title={commercial ? 'Poste Commercial' : 'Poste Service Client'}
        subtitle={commercial ? 'Comptes DEM Pro, gestes commerciaux et demandes' : 'Support clients et coursiers, gestes commerciaux et demandes'}
        actions={<button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      <div style={pageScroll}>
        {commercial ? <ProKpiRow reloadKey={reloadKey} /> : <KpiRow reloadKey={reloadKey} />}
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <Active key={`${tab}-${reloadKey}`} proMode={commercial} />
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
