import { useState, useEffect } from 'react'
import api from '../../../lib/api'
import { glass } from '../../../lib/glassStyles'
import Badge from '../../../components/Badge'

function Shell({ icon: Icon, color, title, onClose, children }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 640, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function PeriodTabs({ periods, active, onChange, color }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {periods.map(p => (
        <button key={p.key} onClick={() => onChange(p.key)} style={{
          padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: active === p.key ? 'none' : '1px solid var(--border)',
          background: active === p.key ? color : 'transparent',
          color: active === p.key ? '#fff' : 'var(--text-muted)',
          transition: 'all .15s',
        }}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}

const REVENUE_PERIODS = [
  { key: 7,   label: 'Semaine' },
  { key: 30,  label: 'Mois' },
  { key: 90,  label: '3 mois' },
  { key: 180, label: '6 mois' },
  { key: 365, label: '1 an' },
]

// ── KPI : CA aujourd'hui — détail + filtres période ───────────────────────────
export function RevenueModal({ icon, color, onClose }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/finance/revenue-period', { params: { days } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [days])

  return (
    <Shell icon={icon} color={color} title="Chiffre d'affaires" onClose={onClose}>
      <PeriodTabs periods={REVENUE_PERIODS} active={days} onChange={setDays} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <StatBox label="CA COURSES" value={`${data.courses.toLocaleString()} F`} color={color} />
            <StatBox label="CA PASS"    value={`${data.pass.toLocaleString()} F`}    color={color} />
            <StatBox label="TOTAL"      value={`${data.total.toLocaleString()} F`}   color={color} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
            {data.ordersCount} course{data.ordersCount !== 1 ? 's' : ''} livrée{data.ordersCount !== 1 ? 's' : ''} sur la période.
            "CA courses" est une estimation basée sur la grille de commission configurée — la commission réelle reste à 0 F tant que la Phase 1 (lancement gratuit) est active.
          </div>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Transactions du jour ────────────────────────────────────────────────
export function TransactionsModal({ icon, color, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    api.get('/admin/finance/transactions', { params: { from: startOfToday.toISOString(), to: new Date().toISOString(), limit: 100 } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  return (
    <Shell icon={icon} color={color} title="Transactions du jour" onClose={onClose}>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="WAVE"          value={`${(data.today.wave.amount ?? 0).toLocaleString()} F · ${data.today.wave.count}`}     color="#22c55e" />
            <StatBox label="ORANGE MONEY"  value={`${(data.today.orange.amount ?? 0).toLocaleString()} F · ${data.today.orange.count}`} color="#f97316" />
          </div>
          {!data.transactions?.length ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Aucune transaction aujourd'hui.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Type', 'Prix', 'Méthode', 'Statut', 'Heure'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, borderBottom: '1px solid rgba(0,119,182,.12)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.transactions.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontSize: 13 }}><Badge status={t.orderType} /></td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{t.price?.toLocaleString()} F</td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{t.paymentMethod ?? '—'}</td>
                    <td style={{ padding: '8px', fontSize: 13 }}><Badge status={t.paymentStatus ?? 'PENDING'} /></td>
                    <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.createdAt).toLocaleTimeString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Shell>
  )
}

// ── KPI : Pass activés ───────────────────────────────────────────────────────
const PASS_PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week',  label: 'Semaine' },
  { key: 'month', label: 'Mois' },
]

export function PassModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/finance/pass').then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  const periodData = data?.[period]

  return (
    <Shell icon={icon} color={color} title="Pass livreurs activés" onClose={onClose}>
      <PeriodTabs periods={PASS_PERIODS} active={period} onChange={setPeriod} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 16 }}>
            <StatBox label="PASS ACTIVÉS"   value={periodData?.activated ?? 0} color={color} />
            <StatBox label="REVENUS PASS"   value={`${(periodData?.revenue ?? 0).toLocaleString()} F`} color={color} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
            Aujourd'hui : <strong style={{ color: 'var(--text)' }}>{data.driversWithActivePass}</strong> livreur{data.driversWithActivePass !== 1 ? 's' : ''} avec pass actif
            {' '}sur <strong style={{ color: 'var(--text)' }}>{data.totalActiveDrivers}</strong> au total
            {' '}({data.driversWithoutActivePass} sans pass).
          </div>
        </>
      )}
    </Shell>
  )
}

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
