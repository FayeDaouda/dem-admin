import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../../lib/api'
import Badge from '../../../components/Badge'
import { glass } from '../../../lib/glassStyles'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

function Shell({ icon: Icon, color, title, onClose, children, width = 720 }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
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

function PeriodTabs({ periods, active, onChange, color, prefix = '' }) {
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
          {prefix}{p.label}
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

// ── KPI : Courses ──────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: "Aujourd'hui",     days: 1 },
  { key: '7d',    label: '7 jours',         days: 7 },
  { key: '30d',   label: '30 jours',        days: 30 },
  { key: '3m',    label: '3 derniers mois', days: 90 },
]
const MAX_XTICKS = 8

export function CoursesModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('7d')
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)

  const days = PERIODS.find(p => p.key === period)?.days ?? 7

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/stats/timeseries?days=${days}`)
      .then(r => setData(r.data.map(d => ({ ...d, dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [days])

  const total = data.reduce((s, d) => s + (d.orders ?? 0), 0)
  const avg   = data.length > 0 ? Math.round(total / data.length) : 0
  const max   = data.reduce((m, d) => Math.max(m, d.orders ?? 0), 0)

  return (
    <Shell icon={icon} color={color} title="Courses" onClose={onClose}>
      <PeriodTabs periods={PERIODS} active={period} onChange={setPeriod} color={color} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox label="Total" value={total} color={color} />
        <StatBox label="Moyenne / jour" value={avg} color={color} />
        <StatBox label="Max journalier" value={max} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={data.length > MAX_XTICKS ? Math.ceil(data.length / MAX_XTICKS) - 1 : 0} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Courses']} />
            <Bar dataKey="orders" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Shell>
  )
}

// ── KPI : Courses en cours — activité récente ─────────────────────────────────
const RECENT_ACTIVE_PERIODS = [
  { key: '5m',  label: '5 min' },
  { key: '10m', label: '10 min' },
  { key: '30m', label: '30 min' },
  { key: '1h',  label: '1h' },
  { key: '2h',  label: '2h' },
  { key: '6h',  label: '6h' },
]

export function ActiveOrdersModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('30m')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/stats/recent-active-orders?period=${period}`)
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [period])

  return (
    <Shell icon={icon} color={color} title="Courses en cours — activité récente" onClose={onClose}>
      <PeriodTabs periods={RECENT_ACTIVE_PERIODS} active={period} onChange={setPeriod} color={color} prefix="Derniers " />
      <div style={{ marginBottom: 20 }}>
        <StatBox label="Prises en charge récentes" value={data?.total ?? 0} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data || data.orders.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucune course passée en cours sur cette période.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>{['Statut', 'Client', 'Livreur', 'Départ', 'Arrivée', 'Prix', 'Prise en charge'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.orders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}><Badge status={o.status} /></td>
                <td style={tdStyle}>{o.client?.name ?? '—'}</td>
                <td style={tdStyle}>{o.driver?.name ?? '—'}</td>
                <td style={{ ...tdStyle, fontSize: 12 }}>{o.pickupAddress}</td>
                <td style={{ ...tdStyle, fontSize: 12 }}>{o.deliveryAddress}</td>
                <td style={tdStyle}>{o.price?.toLocaleString()} F</td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{o.acceptedAt ? new Date(o.acceptedAt).toLocaleString('fr-FR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

// ── KPI : Courses en attente — sans livreur depuis... ─────────────────────────
const STUCK_PENDING_PERIODS = [
  { key: '2m',  label: '2 min' },
  { key: '5m',  label: '5 min' },
  { key: '10m', label: '10 min' },
  { key: '15m', label: '15 min' },
  { key: '30m', label: '30 min' },
]

function waitingMinutes(createdAt) {
  return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
}

export function StuckPendingOrdersModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('5m')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/stats/stuck-pending-orders?period=${period}`)
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [period])

  return (
    <Shell icon={icon} color={color} title="Courses en attente — sans livreur depuis..." onClose={onClose}>
      <PeriodTabs periods={STUCK_PENDING_PERIODS} active={period} onChange={setPeriod} color={color} prefix="Plus de " />
      <div style={{ marginBottom: 20 }}>
        <StatBox label="Commandes en attente" value={data?.total ?? 0} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data || data.orders.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucune course en attente depuis plus de ce délai.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>{['Client', 'Départ', 'Arrivée', 'Prix', 'En attente depuis', 'Dispatch'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.orders.map(o => {
              const hasOffer = o.dispatchedToDriverId && o.dispatchExpiresAt && new Date(o.dispatchExpiresAt) > new Date()
              return (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{o.client?.name ?? '—'}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{o.pickupAddress}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{o.deliveryAddress}</td>
                  <td style={tdStyle}>{o.price?.toLocaleString()} F</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#f59e0b' }}>{waitingMinutes(o.createdAt)} min</td>
                  <td style={tdStyle}><Badge status={hasOffer ? 'PENDING' : 'CANCELLED'} label={hasOffer ? 'Offre en cours' : 'Aucune offre'} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

// ── KPI : Livreurs actifs ─────────────────────────────────────────────────────
const DRIVER_PRESENCE_PERIODS = [
  { key: 'live', label: 'En live' },
  { key: '1h',   label: '1h' },
  { key: '6h',   label: '6h' },
  { key: '24h',  label: '24h' },
  { key: '3d',   label: '3 jours' },
  { key: '7d',   label: '7 jours' },
  { key: '30d',  label: '30 jours' },
  { key: '3m',   label: '3 mois' },
]

export function DriverActivityModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('live')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/stats/active-drivers?period=${period}`)
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [period])

  return (
    <Shell icon={icon} color={color} title="Livreurs actifs" onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {DRIVER_PRESENCE_PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: period === p.key ? 'none' : '1px solid var(--border)',
            background: period === p.key ? color : 'transparent',
            color: period === p.key ? '#fff' : 'var(--text-muted)',
            transition: 'all .15s',
          }}>
            {p.key === 'live' ? '🔴 En live' : p.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox label="Livreurs actifs" value={data?.totalActive ?? 0} color={color} />
        <StatBox label="En ligne maintenant" value={data?.onlineNowCount ?? 0} color={color} />
        <StatBox label="Flotte totale" value={data?.totalRegistered ?? 0} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data || data.drivers.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucun livreur actif sur cette période.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>{['Livreur', 'Téléphone', 'Véhicule', 'Statut', 'Dernière connexion'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.drivers.map(d => (
              <tr key={d.driverId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{d.name}</td>
                <td style={tdStyle}>{d.phone ?? '—'}</td>
                <td style={tdStyle}>{d.vehicleType ?? '—'}</td>
                <td style={tdStyle}><Badge status={d.isOnlineNow ? 'ONLINE' : 'OFFLINE'} /></td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('fr-FR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

// ── KPI : Incidents ouverts ────────────────────────────────────────────────────
const INCIDENT_TABS = [
  { key: 'ALL',           label: 'Tous (non résolus)' },
  { key: 'OPEN',          label: 'Ouverts' },
  { key: 'INVESTIGATING', label: 'En investigation' },
]

const SEVERITY_COLORS = { low: '#94a3b8', medium: '#f59e0b', high: '#ef4444', critical: '#b91c1c' }

export function IncidentsModal({ icon, color, onClose }) {
  const [tab, setTab] = useState('ALL')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/incidents')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const incidents = (data?.incidents ?? []).filter(i => i.status !== 'RESOLVED')
  const filtered = tab === 'ALL' ? incidents : incidents.filter(i => i.status === tab)

  return (
    <Shell icon={icon} color={color} title="Incidents ouverts" onClose={onClose}>
      <PeriodTabs periods={INCIDENT_TABS} active={tab} onChange={setTab} color={color} />
      <div style={{ marginBottom: 20 }}>
        <StatBox label="Incidents affichés" value={filtered.length} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucun incident sur ce filtre.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>{['Type', 'Sévérité', 'Livreur', 'Statut', 'Ouvert depuis'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{i.label ?? i.type}</td>
                <td style={tdStyle}>
                  <span style={{ color: SEVERITY_COLORS[i.severity] ?? 'var(--text-muted)', fontWeight: 700, fontSize: 12 }}>{i.severity}</span>
                </td>
                <td style={tdStyle}>{i.driverName ?? '—'}</td>
                <td style={tdStyle}><Badge status={i.status} label={i.status === 'OPEN' ? 'Ouvert' : i.status === 'INVESTIGATING' ? 'En investigation' : i.status} /></td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{new Date(i.openedAt).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

// ── KPI : Livreurs / Clients notés < 3/5 ──────────────────────────────────────
export function LowRatingModal({ icon, color, onClose, role, title }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/analytics/low-ratings', { params: { role } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [role])

  const list = role === 'DRIVER' ? (data?.drivers ?? []) : (data?.clients ?? [])

  return (
    <Shell icon={icon} color={color} title={title} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <StatBox label="Notés en dessous de 3/5" value={list.length} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : list.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Personne en dessous de 3/5 pour le moment.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>{['Nom', 'Téléphone', 'Note moyenne', "Nb d'évaluations"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{u.name ?? '—'}</td>
                <td style={tdStyle}>{u.phone ?? '—'}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#ef4444' }}>★ {u.avgRating}</td>
                <td style={tdStyle}>{u.ratingsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

// ── KPI : Taux annulation (jour) ──────────────────────────────────────────────
const CANCEL_PERIODS = [
  { key: 1,  label: "Aujourd'hui" },
  { key: 7,  label: '7 jours' },
  { key: 30, label: '30 jours' },
]

const REASON_LABELS = {
  NO_DRIVER_FOUND: 'Aucun livreur trouvé', CHANGED_MIND: "Changement d'avis", TOO_LONG: 'Trop long',
  WRONG_ADDRESS: 'Adresse erronée', PRICE: 'Prix', DRIVER_ISSUE: 'Problème livreur',
  OTHER: 'Autre', NON_RENSEIGNE: 'Non renseigné',
}

export function CancellationRateModal({ icon, color, onClose }) {
  const [days, setDays] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    api.get('/admin/analytics/cancellations', { params: { from } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [days])

  const reasons = (data?.reasons ?? []).map(r => ({ ...r, label: REASON_LABELS[r.reason] ?? r.reason }))

  return (
    <Shell icon={icon} color={color} title="Taux d'annulation" onClose={onClose}>
      <PeriodTabs periods={CANCEL_PERIODS} active={days} onChange={setDays} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="Taux d'annulation" value={`${data.cancellationRate}%`} color={color} />
            <StatBox label="Commandes" value={data.totalOrders} color={color} />
            <StatBox label="Annulées" value={data.cancelledOrders} color={color} />
          </div>
          {reasons.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune annulation sur cette période.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, reasons.length * 32)}>
              <BarChart data={reasons} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Occurrences" fill={color} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </Shell>
  )
}

// ── KPI : DEM Pro actifs / total ──────────────────────────────────────────────
const DEM_PRO_TABS = [
  { key: 'active',  label: 'Actifs' },
  { key: 'pending', label: 'En attente' },
  { key: 'all',     label: 'Tous' },
]

export function DemProAccountsModal({ icon, color, onClose }) {
  const [tab, setTab] = useState('active')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/dem-pro', { params: { status: tab } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [tab])

  const accounts = data?.accounts ?? []

  return (
    <Shell icon={icon} color={color} title="Comptes DEM Pro" onClose={onClose}>
      <PeriodTabs periods={DEM_PRO_TABS} active={tab} onChange={setTab} color={color} />
      <div style={{ marginBottom: 20 }}>
        <StatBox label="Comptes affichés" value={accounts.length} color={color} />
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : accounts.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucun compte sur ce filtre.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>{['Entreprise', 'Contact', 'Téléphone', 'Statut', 'Inscrit le'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{a.proBusinessName ?? '—'}</td>
                <td style={tdStyle}>{a.name ?? '—'}</td>
                <td style={tdStyle}>{a.phone ?? '—'}</td>
                <td style={tdStyle}><Badge status={a.proStatus} label={a.proStatus === 'ACTIVE' ? 'Actif' : a.proStatus === 'PENDING' ? 'En attente' : a.proStatus} /></td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle    = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
