import { useState } from 'react'
import { RefreshCw, Wallet, Receipt, Ticket, Package, SlidersHorizontal, TrendingUp, ShieldAlert } from 'lucide-react'
import { pageWrap, pageScroll } from '../../lib/glassStyles'
import FinanceKpiRow from './components/FinanceKpiRow'
import RevenueTab from './RevenueTab'
import TransactionsTab from './TransactionsTab'
import PassTab from './PassTab'
import CoursesTab from './CoursesTab'
import TariffsTab from './TariffsTab'
import CaCoursesTab from './CaCoursesTab'
import SamirpayTab from './SamirpayTab'

const TABS = [
  ['revenue',      'Revenus',      Wallet,             RevenueTab],
  ['transactions', 'Transactions', Receipt,            TransactionsTab],
  ['pass',         'Pass livreurs', Ticket,             PassTab],
  ['courses',      'Courses',      Package,            CoursesTab],
  ['tariffs',      'Tarifs',       SlidersHorizontal,  TariffsTab],
  ['ca-courses',   'CA courses',   TrendingUp,          CaCoursesTab],
  ['samirpay',     'Paiement en ligne', ShieldAlert,    SamirpayTab],
]

export default function Finance() {
  const [tab, setTab] = useState('revenue')
  const [reloadKey, setReloadKey] = useState(0)

  const Active = TABS.find(([key]) => key === tab)[3]

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Finance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            Suivi financier, transactions et propositions tarifaires
          </p>
        </div>
        <button onClick={() => setReloadKey(k => k + 1)} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div style={pageScroll}>
        <FinanceKpiRow reloadKey={reloadKey} />

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
