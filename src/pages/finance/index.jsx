import { useState } from 'react'
import { RefreshCw, Wallet, Receipt, Ticket, Package, TrendingUp } from 'lucide-react'
import { pageWrap, pageScroll } from '../../lib/glassStyles'
import PageHeader from '../../components/PageHeader'
import TabBar from '../../components/TabBar'
import { useUrlTab } from '../../lib/useUrlTab'
import FinanceKpiRow from './components/FinanceKpiRow'
import RevenueTab from './RevenueTab'
import PaymentsTab from './PaymentsTab'
import PassTab from './PassTab'
import CoursesTab from './CoursesTab'
import CaCoursesTab from './CaCoursesTab'

// Onglet ouvert dans l'adresse (?tab=…). Les prix (pass coursiers, zones,
// frais) se règlent dans Tarifs et zones, jamais ici.
const TABS = [
  { key: 'revenue',    label: 'Revenus',            icon: Wallet,     Component: RevenueTab },
  { key: 'paiements',  label: 'Paiements',          icon: Receipt,    Component: PaymentsTab },
  { key: 'pass',       label: 'Pass coursiers',     icon: Ticket,     Component: PassTab },
  { key: 'courses',    label: 'Courses',            icon: Package,    Component: CoursesTab },
  { key: 'ca-courses', label: 'Commission courses', icon: TrendingUp, Component: CaCoursesTab },
]

export default function Finance() {
  const [tab, setTab] = useUrlTab(TABS)
  const [reloadKey, setReloadKey] = useState(0)

  const Active = TABS.find(t => t.key === tab).Component

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Finance"
        subtitle="Revenus, paiements et pass coursiers"
        actions={<button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      <div style={pageScroll}>
        <FinanceKpiRow reloadKey={reloadKey} />
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        <Active key={`${tab}-${reloadKey}`} />
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
