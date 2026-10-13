import { useState } from 'react'
import { RefreshCw, TrendingUp, Repeat, Package, Megaphone, Percent } from 'lucide-react'
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
import CampaignsTab from './CampaignsTab'
import PromotionsTab from './PromotionsTab'
import FreeCourseSection from './FreeCourseSection'

// Acquisition + offre de lancement « 100 clients » (Super Admin seul)
function AcquisitionWithOffer() {
  const { user } = useAuth()
  return (
    <>
      <AcquisitionTab />
      {canSee(user?.adminRole, ACTION_ROLES.freeCourseOffer) && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Offre de lancement : 100 premiers clients</h2>
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
  { key: 'campaigns',   label: 'Campagnes & alertes',  icon: Megaphone,  Component: CampaignsTab },
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
        subtitle={showKpis ? 'Acquisition, rétention, comportement des courses, promotions et campagnes' : 'Évolution des inscriptions'}
        actions={<button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      <div style={pageScroll}>
        {showKpis && <MarketingKpiRow reloadKey={reloadKey} />}
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        {Active && <Active key={`${tab}-${reloadKey}`} />}
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
