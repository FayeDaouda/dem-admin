import { useState } from 'react'
import { RefreshCw, TrendingUp, Repeat, Package, Percent } from 'lucide-react'
import { pageWrap, pageScroll } from '../../lib/glassStyles'
import { useAuth } from '../../contexts/AuthContext'
import { canSee, TAB_ROLES, ACTION_ROLES } from '../../lib/droits'
import PageHeader from '../../components/PageHeader'
import TabBar from '../../components/TabBar'
import { useUrlTab } from '../../lib/useUrlTab'
import MarketingKpiRow from './components/MarketingKpiRow'
import AcquisitionTab from './AcquisitionTab'
import RetentionTab from './RetentionTab'
import CoursesTab from './CoursesTab'
import { Milestones } from './CampaignBlocks'
import PromotionsTab from './PromotionsTab'
import FreeCourseSection from './FreeCourseSection'
import InfoTip from '../../components/InfoTip'

// Acquisition + offre de lancement « 100 clients » (Super Admin seul)
function AcquisitionWithOffer() {
  const { user } = useAuth()
  return (
    <>
      <AcquisitionTab />
      {canSee(user?.adminRole, ACTION_ROLES.freeCourseOffer) && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Offre de lancement : 100 premiers clients<InfoTip k="Offre de lancement : 100 premiers clients" size={13} /></h2>
          <FreeCourseSection />
        </section>
      )}
    </>
  )
}

const ALL_TABS = [
  { key: 'acquisition', label: 'Acquisition',          icon: TrendingUp, Component: AcquisitionWithOffer },
  { key: 'retention',   label: 'Rétention',            icon: Repeat,     Component: RetentionTab },
  { key: 'courses',     label: 'Comportement courses', icon: Package,    Component: CoursesTab },
  { key: 'promotions',  label: 'Promotions',           icon: Percent,    Component: PromotionsTab },
]

// Espace Marketing — onglet ouvert dans l'adresse (?tab=), onglets et
// indicateurs filtrés par rôle (lib/droits.js) : l'Assistance exécutive n'y
// voit que l'onglet Acquisition.
export default function Marketing() {
  const { user } = useAuth()
  const role = user?.adminRole
  const tabs = ALL_TABS.filter(t => canSee(role, TAB_ROLES.marketing[t.key]))
  const [tab, setTab] = useUrlTab(tabs)
  const [reloadKey, setReloadKey] = useState(0)

  const Active = tabs.find(t => t.key === tab)?.Component
  const showKpis = canSee(role, TAB_ROLES.marketing.overview)

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Marketing"
        subtitle={showKpis ? 'Acquisition, rétention, comportement des courses et promotions' : 'Évolution des inscriptions'}
        actions={<button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      <div style={pageScroll}>
        {showKpis && <MarketingKpiRow reloadKey={reloadKey} />}
        {showKpis && (
          <details style={{ marginBottom: 20 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Jalons de croissance</summary>
            <Milestones key={reloadKey} />
          </details>
        )}
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        {Active && <Active key={`${tab}-${reloadKey}`} />}
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
