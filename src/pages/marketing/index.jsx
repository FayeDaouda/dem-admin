import { useState } from 'react'
import { RefreshCw, TrendingUp, Repeat, Package, Bike, Megaphone } from 'lucide-react'
import { pageWrap, pageScroll } from '../../lib/glassStyles'
import MarketingKpiRow from './components/MarketingKpiRow'
import AcquisitionTab from './AcquisitionTab'
import RetentionTab from './RetentionTab'
import CoursesTab from './CoursesTab'
import DriversTab from './DriversTab'
import CampaignsTab from './CampaignsTab'

const TABS = [
  ['acquisition', 'Acquisition',        TrendingUp, AcquisitionTab],
  ['retention',   'Rétention',          Repeat,     RetentionTab],
  ['courses',     'Comportement courses', Package,  CoursesTab],
  ['drivers',     'Livreurs',           Bike,       DriversTab],
  ['campaigns',   'Campagnes & alertes', Megaphone, CampaignsTab],
]

export default function Marketing() {
  const [tab, setTab] = useState('acquisition')
  const [reloadKey, setReloadKey] = useState(0)

  const Active = TABS.find(([key]) => key === tab)[3]

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            Acquisition, rétention, comportement utilisateur et campagnes
          </p>
        </div>
        <button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div style={pageScroll}>
        <MarketingKpiRow reloadKey={reloadKey} />

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: tab === key ? 'var(--primary)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--text-muted)',
              fontWeight: tab === key ? 700 : 500, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <Active key={`${tab}-${reloadKey}`} />
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
