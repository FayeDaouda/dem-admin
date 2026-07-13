import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../../lib/api'
import { glass } from '../../../lib/glassStyles'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

const REASON_LABELS = {
  NO_DRIVER_FOUND: 'Aucun livreur trouvé', CHANGED_MIND: "Changement d'avis", TOO_LONG: 'Trop long',
  WRONG_ADDRESS: 'Adresse erronée', PRICE: 'Prix', DRIVER_ISSUE: 'Problème livreur',
  OTHER: 'Autre', NON_RENSEIGNE: 'Non renseigné',
}

function Shell({ icon: Icon, color, title, onClose, children }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 680, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
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

const ACQ_PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week',  label: '7 jours' },
  { key: 'month', label: '30 jours' },
  { key: 'sixMonths', label: '6 mois' },
]

// ── KPI : Nouveaux clients (jour) ─────────────────────────────────────────────
export function NewClientsModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/marketing/acquisition').then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  const growth = (data?.growth ?? []).map(g => ({ ...g, dateLabel: new Date(g.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const days = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : null
  const chartData = days ? growth.slice(-days) : growth

  return (
    <Shell icon={icon} color={color} title="Nouveaux clients" onClose={onClose}>
      <PeriodTabs periods={ACQ_PERIODS} active={period} onChange={setPeriod} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="AUJOURD'HUI" value={data.newClients.today} color={color} />
            <StatBox label="7 JOURS" value={data.newClients.week} color={color} />
            <StatBox label="30 JOURS" value={data.newClients.month} color={color} />
            <StatBox label="6 MOIS" value={data.newClients.sixMonths} color={color} />
          </div>
          {days ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Nouveaux clients']} />
                <Bar dataKey="clients" fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Pas de courbe au-delà de 30 jours — seul le total 6 mois est disponible.
            </div>
          )}
        </>
      )}
    </Shell>
  )
}

// ── KPI : Taux rétention (mois) / Clients actifs / Clients inactifs ──────────
const RETENTION_PERIODS = [
  { key: 1,   label: 'Jour' },
  { key: 3,   label: '3 jours' },
  { key: 7,   label: 'Semaine' },
  { key: 15,  label: '15 jours' },
  { key: 30,  label: '1 mois' },
  { key: 90,  label: '3 mois' },
  { key: 180, label: '6 mois' },
]

// Utilisé par les KPI "Clients actifs" et "Clients inactifs" (mêmes données,
// seuil d'activité différent de celui de "Taux de rétention").
const ACTIVITY_PERIODS = [
  { key: 0.25, label: '6h' },
  { key: 1,    label: '24h' },
  { key: 3,    label: '3 jours' },
  { key: 7,    label: 'Semaine' },
  { key: 30,   label: 'Mois' },
  { key: 90,   label: '3 mois' },
  { key: 180,  label: '6 mois' },
  { key: 365,  label: '1 an' },
]

const RETENTION_TITLES = {
  retention: 'Taux de rétention',
  active:    'Clients actifs',
  inactive:  'Clients inactifs',
}

export function RetentionModal({ icon, color, onClose, focus = 'retention' }) {
  const periods = focus === 'retention' ? RETENTION_PERIODS : ACTIVITY_PERIODS
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const thresholdLabel = periods.find(p => p.key === days)?.label ?? `${days}J`

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/marketing/retention?days=${days}`)
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [days])

  return (
    <Shell icon={icon} color={color} title={RETENTION_TITLES[focus] ?? 'Taux de rétention'} onClose={onClose}>
      <PeriodTabs periods={periods} active={days} onChange={setDays} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
            <StatBox label="TAUX DE RÉTENTION" value={`${data.retentionRate}%`} color={color} />
            <StatBox label={`ACTIFS (≤ ${thresholdLabel})`} value={data.activeClients} color="#22c55e" />
            <StatBox label={`INACTIFS (> ${thresholdLabel})`} value={data.inactiveClients} color="#ef4444" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 8 }}>
            <StatBox label="CLIENTS AVEC COMMANDES" value={data.clientsWithOrders} color={color} />
            <StatBox label="CLIENTS FIDÈLES (≥2 CMD)" value={data.repeatClients} color={color} />
            <StatBox label="FRÉQ. MOYENNE / CLIENT" value={data.avgOrderFrequency} color={color} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
            Clients perdus : <strong style={{ color: 'var(--text)' }}>{data.churn.thisWeek}</strong> cette semaine
            {' '}vs <strong style={{ color: 'var(--text)' }}>{data.churn.lastWeek}</strong> la semaine précédente
          </div>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Taux d'annulation / Courses complétées — filtres en heures ─────────
const COURSE_TREND_PERIODS = [
  { key: 2,    label: '2h' },
  { key: 24,   label: 'Jour' },
  { key: 72,   label: '3 jours' },
  { key: 360,  label: '15 jours' },
  { key: 720,  label: '1 mois' },
  { key: 2160, label: '3 mois' },
  { key: 4320, label: '6 mois' },
  { key: 8760, label: '1 an' },
]

export function CancellationModal({ icon, color, onClose }) {
  const [hours, setHours] = useState(720)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    api.get('/admin/marketing/courses', { params: { from } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [hours])

  const trend = (data?.cancellationRateTrend ?? []).map(t => ({ ...t, dateLabel: new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const reasons = (data?.reasons ?? []).map(r => ({ ...r, label: REASON_LABELS[r.reason] ?? r.reason }))

  return (
    <Shell icon={icon} color={color} title="Taux d'annulation" onClose={onClose}>
      <PeriodTabs periods={COURSE_TREND_PERIODS} active={hours} onChange={setHours} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="ANNULÉES AUJOURD'HUI" value={data.cancelled.today} color={color} />
            <StatBox label="ANNULÉES 7 JOURS" value={data.cancelled.week} color={color} />
            <StatBox label="ANNULÉES 30 JOURS" value={data.cancelled.month} color={color} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(trend.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Taux']} />
              <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          {reasons.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Motifs d'annulation</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={reasons} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Occurrences" fill={color} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Shell>
  )
}

// ── KPI : Courses complétées (jour) ───────────────────────────────────────────
export function CompletedOrdersModal({ icon, color, onClose }) {
  const [hours, setHours] = useState(720)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    api.get('/admin/marketing/courses', { params: { from } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [hours])

  const trend = (data?.completedTrend ?? []).map(t => ({ ...t, dateLabel: new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))

  return (
    <Shell icon={icon} color={color} title="Courses complétées" onClose={onClose}>
      <PeriodTabs periods={COURSE_TREND_PERIODS} active={hours} onChange={setHours} color={color} />
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="COMPLÉTÉES AUJOURD'HUI" value={data.completed.today} color={color} />
            <StatBox label="COMPLÉTÉES 7 JOURS" value={data.completed.week} color={color} />
            <StatBox label="COMPLÉTÉES 30 JOURS" value={data.completed.month} color={color} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(trend.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Complétées']} />
              <Bar dataKey="completed" fill={color} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Dernière notification push ──────────────────────────────────────────
const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Livreurs', dem_pro: 'DEM Pro' }

export function BroadcastHistoryModal({ icon, color, onClose }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/marketing/broadcasts', { params: { page, limit: 20 } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <Shell icon={icon} color={color} title="Historique des notifications push" onClose={onClose}>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
      ) : !data || data.broadcasts.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucune notification envoyée.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.broadcasts.map(b => (
              <div key={b.id} style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(b.createdAt).toLocaleString('fr-FR')}</div>
                </div>
                {b.body && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{b.body}</div>}
                <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 4 }}>
                  Cible : {TARGET_LABELS[b.data?.target] ?? b.data?.target ?? '—'}
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pagerBtn}>← Précédent</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pagerBtn}>Suivant →</button>
            </div>
          )}
        </>
      )}
    </Shell>
  )
}

const pagerBtn = { padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
