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

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

const Loading = () => <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
const LoadError = () => <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>
const dayLabel = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

const ACQ_PERIODS = [
  { key: 'today', label: "Aujourd'hui", days: 1 },
  { key: 'week',  label: '7 jours',     days: 7 },
  { key: 'month', label: '30 jours',    days: 30 },
  { key: 'sixMonths', label: '6 mois',  days: null },
]

// ── KPI : Nouveaux clients (jour) ─────────────────────────────────────────────
export function NewClientsModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/marketing/acquisition').then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  const days = ACQ_PERIODS.find(p => p.key === period)?.days
  const chartData = (data?.growth ?? []).slice(days ? -days : 0).map(g => ({ ...g, dateLabel: dayLabel(g.date) }))

  return (
    <Shell icon={icon} color={color} title="Nouvelles inscriptions clients" onClose={onClose}>
      <PeriodTabs periods={ACQ_PERIODS} active={period} onChange={setPeriod} color={color} />
      {loading ? <Loading /> : !data ? <LoadError /> : (
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
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Inscriptions clients']} />
                <Bar dataKey="clients" fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Courbe disponible sur 30 jours maximum — seul le total 6 mois est affiché.
            </div>
          )}
          <Note>Inscriptions de comptes clients, par jour calendaire (un compte supprimé depuis reste compté à sa date d'inscription).</Note>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Rétention 30 j / Clients actifs / Clients inactifs ─────────────────
// Fenêtre d'activité (glissante) des cartes "Clients actifs/inactifs" — la
// carte utilise 30 jours, le modal s'ouvre donc sur 30 jours.
const ACTIVITY_PERIODS = [
  { key: 0.25, label: '6 h' },
  { key: 1,    label: '24 h' },
  { key: 3,    label: '3 jours' },
  { key: 7,    label: '7 jours' },
  { key: 30,   label: '30 jours' },
  { key: 90,   label: '90 jours' },
  { key: 180,  label: '180 jours' },
  { key: 365,  label: '365 jours' },
]

function useRetention(days) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api.get('/admin/marketing/retention', { params: { days } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [days])
  return { data, loading }
}

export function RetentionModal({ icon, color, onClose, focus = 'retention' }) {
  const [days, setDays] = useState(30)
  const { data, loading } = useRetention(days)
  const windowLabel = ACTIVITY_PERIODS.find(p => p.key === days)?.label ?? `${days} jours`

  if (focus === 'retention') {
    const r = data?.retention30d
    const prev = data?.previousRetention30d
    return (
      <Shell icon={icon} color={color} title="Rétention des clients" onClose={onClose}>
        {loading ? <Loading /> : !data ? <LoadError /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
              <StatBox label="RÉTENTION 30 JOURS" value={`${r.rate}%`} color={color}
                sub={`${r.retained} revenus sur ${r.baseClients} clients`} />
              <StatBox label="CLIENTS PERDUS" value={r.lost} color="#ef4444"
                sub={`période précédente : ${prev.lost}`} />
              <StatBox label="RÉTENTION PÉRIODE PRÉCÉDENTE" value={`${prev.rate}%`} color="#94a3b8"
                sub={`${prev.retained} sur ${prev.baseClients}`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <StatBox label="TAUX DE RÉACHAT" value={`${data.repeatRate}%`} color="#06b6d4"
                sub={`${data.repeatClients} clients servis 2 fois ou plus`} />
              <StatBox label="CLIENTS SERVIS (DEPUIS LE LANCEMENT)" value={data.clientsServed} color="#06b6d4" />
              <StatBox label="COURSES PAR CLIENT (MOYENNE)" value={data.avgOrdersPerClient} color="#06b6d4" />
            </div>
            <Note>
              <strong>Rétention 30 jours</strong> = parmi les clients servis (au moins une course livrée) sur les 30 jours précédents, part
              servie à nouveau sur les 30 derniers jours. <strong>Clients perdus</strong> = ceux qui ne sont pas revenus.
              <strong> Taux de réachat</strong> = clients servis au moins 2 fois / clients servis au moins une fois, depuis le lancement.
              Comptes clients particuliers uniquement (DEM Pro exclus).
            </Note>
          </>
        )}
      </Shell>
    )
  }

  const a = data?.activity
  return (
    <Shell icon={icon} color={color} title={focus === 'active' ? 'Clients actifs' : 'Clients inactifs'} onClose={onClose}>
      <PeriodTabs periods={ACTIVITY_PERIODS} active={days} onChange={setDays} color={color} />
      {loading ? <Loading /> : !a ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatBox label={`ACTIFS (${windowLabel})`} value={a.active} color="#22c55e" sub="servis sur la période" />
            <StatBox label="INACTIFS" value={a.inactive} color="#f59e0b" sub="déjà servis, pas sur la période" />
            <StatBox label="JAMAIS SERVIS" value={a.neverServed} color="#94a3b8" sub="aucune course livrée" />
            <StatBox label="COMPTES CLIENTS" value={a.registered} color={color} sub="= actifs + inactifs + jamais servis" />
          </div>
          <Note>
            Comptes clients existants (hors comptes supprimés). « Servi » = au moins une course livrée. Les inactifs sont la cible
            naturelle des relances ; les jamais servis, celle de l'activation.
          </Note>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Taux d'annulation / Courses livrées ─────────────────────────────────
// Périodes en jours calendaires (UTC = heure de Dakar) : "Aujourd'hui" est le
// même jour que les cartes "(jour)" qui ouvrent ces modals.
const DAY_MS = 24 * 60 * 60 * 1000
const isoDay = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10)
const COURSE_PERIODS = [
  { key: 'today', label: "Aujourd'hui", from: () => isoDay(0) },
  { key: '2h',    label: '2 dernières h', from: () => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { key: '7d',    label: '7 jours',   from: () => isoDay(6) },
  { key: '15d',   label: '15 jours',  from: () => isoDay(14) },
  { key: '30d',   label: '30 jours',  from: () => isoDay(29) },
  { key: '90d',   label: '90 jours',  from: () => isoDay(89) },
  { key: '180d',  label: '180 jours', from: () => isoDay(179) },
  { key: '365d',  label: '365 jours', from: () => isoDay(364) },
]

function useCourseStats(periodKey) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const from = COURSE_PERIODS.find(p => p.key === periodKey).from()
    api.get('/admin/marketing/courses', { params: { from } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [periodKey])
  return { data, loading }
}

export function CancellationModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('today')
  const { data, loading } = useCourseStats(period)

  const trend = (data?.cancellationRateTrend ?? []).map(t => ({ ...t, dateLabel: dayLabel(t.date) }))
  const reasons = (data?.reasons ?? []).map(r => ({ ...r, label: REASON_LABELS[r.reason] ?? r.reason }))

  return (
    <Shell icon={icon} color={color} title="Taux d'annulation" onClose={onClose}>
      <PeriodTabs periods={COURSE_PERIODS} active={period} onChange={setPeriod} color={color} />
      {loading ? <Loading /> : !data ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="TAUX D'ANNULATION" value={`${data.cancellation.rate}%`} color={color}
              sub={`${data.cancellation.cancelled} annulée(s) sur ${data.cancellation.created} commande(s)`} />
            <StatBox label="COMMANDES CRÉÉES" value={data.cancellation.created} color="#6366f1" />
            <StatBox label="DONT ANNULÉES" value={data.cancellation.cancelled} color={color} />
          </div>
          {trend.length > 1 && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(trend.length / 10) - 1)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, item) => [`${v}% (${item.payload.cancelled}/${item.payload.created})`, 'Annulées']} />
                <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
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
          <Note>
            Taux = part des commandes créées sur la période qui sont aujourd'hui annulées (une seule population : il ne peut pas dépasser 100 %).
            Une commande récente encore en cours peut être annulée plus tard, le taux d'une période récente peut donc encore bouger.
          </Note>
        </>
      )}
    </Shell>
  )
}

export function CompletedOrdersModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('today')
  const { data, loading } = useCourseStats(period)

  const trend = (data?.completedTrend ?? []).map(t => ({ ...t, dateLabel: dayLabel(t.date) }))

  return (
    <Shell icon={icon} color={color} title="Courses livrées" onClose={onClose}>
      <PeriodTabs periods={COURSE_PERIODS} active={period} onChange={setPeriod} color={color} />
      {loading ? <Loading /> : !data ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <StatBox label="LIVRÉES AUJOURD'HUI" value={data.completed.today} color={color} />
            <StatBox label="LIVRÉES 7 JOURS" value={data.completed.week} color={color} />
            <StatBox label="LIVRÉES 30 JOURS" value={data.completed.month} color={color} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(trend.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Livrées']} />
              <Bar dataKey="completed" fill={color} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Note>Courses comptées à leur date de livraison (compteurs et courbe), toutes commandes confondues.</Note>
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
                  {b.data?.totalUsers != null && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      {' '}· {b.data.sent ?? 0} envoyée(s) sur {b.data.totalUsers}{b.data.failed > 0 ? ` · ${b.data.failed} échec(s)` : ''}
                    </span>
                  )}
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
