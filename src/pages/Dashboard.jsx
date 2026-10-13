import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Package, Bike, AlertTriangle, TrendingUp, Users, CreditCard, Activity, Wifi,
  ArrowUpRight, ArrowDownRight, Minus, Briefcase, Ticket, CheckCircle, XCircle,
  UserPlus, Repeat, Star, ShieldAlert, ClipboardCheck, Wallet, Clock, ChevronDown,
  ChevronRight, Map as MapIcon, ShoppingBag, RefreshCw,
} from 'lucide-react'
import { connectSocket, disconnectSocket } from '../lib/socket'
import api from '../lib/api'
import Badge from '../components/Badge'
import { glass } from '../lib/glassStyles'
import { useResponsive } from '../lib/useResponsive'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useAuth } from '../contexts/AuthContext'
import ValidationNotifications from '../components/ValidationNotifications'
import { formatF, formatAxisF } from '../lib/format'
import {
  NewClientsModal, RetentionModal, CancellationModal,
} from './marketing/components/MarketingKpiModals'
import {
  ActiveOrdersModal, StuckPendingOrdersModal, DriverActivityModal,
  IncidentsModal, LowRatingModal, CancellationRateModal, DemProAccountsModal,
} from './service-client/components/ServiceClientKpiModals'
import InfoTip from '../components/InfoTip'
import { PAGES } from '../lib/aide'

// ============================================================
//  Dashboard — une page, quatre questions, dans cet ordre :
//    1. À traiter      : ce qui attend une action (liste fixe, 0 = ✓)
//    2. En direct      : état des opérations maintenant
//    3. Aujourd'hui    : jour calendaire (UTC = Dakar), vs hier même heure
//    4. Comptes        : base clients / DEM Pro et satisfaction
//  Chaque chiffre n'apparaît qu'UNE fois, et sa fenêtre de détail liste
//  exactement la population comptée. Les définitions sont côté serveur
//  (dem-backend admin.kpi-definitions.js) ; cette page ne recalcule rien,
//  sauf « en course » = en ligne − libres (deux compteurs du même instant).
//  Les rangées complètes Community / Service Client restent sur leurs pages.
// ============================================================

const TREND_TITLE = 'Comparé à hier à la même heure'
const STUCK_PENDING_MIN = 5

function TrendBadge({ current, previous }) {
  if (current == null || previous == null || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const base = { display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }
  if (pct === 0) return <span title={TREND_TITLE} style={{ ...base, color: '#94a3b8', background: '#94a3b818' }}><Minus size={10} /> 0%</span>
  const up = pct > 0
  return (
    <span title={TREND_TITLE} style={{ ...base, color: up ? '#22c55e' : '#ef4444', background: up ? '#22c55e14' : '#ef444414' }}>
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

function MiniSparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height={26}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#grad-${dataKey})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function Section({ title, hint, children, right }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}<InfoTip k={title} size={12} /></h2>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </section>
  )
}

const TOOLTIP_STYLE = {
  background: '#ffffff', border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
}

// Parts de stats.todayBreakdown — commandes CRÉÉES aujourd'hui, selon leur
// statut actuel : une seule population, la somme des parts = total du jour.
const STATUS_PIE = [
  { key: 'scheduled', label: 'Programmées', color: '#0ea5e9' },
  { key: 'pending',   label: 'En attente',  color: '#f59e0b' },
  { key: 'active',    label: 'En cours',    color: '#6366f1' },
  { key: 'delivered', label: 'Livrées',     color: '#22c55e' },
  { key: 'cancelled', label: 'Annulées',    color: '#ef4444' },
]

const PERIODS = [
  { key: 'today', label: "Aujourd'hui",     days: 1 },
  { key: '7d',    label: '7 jours',         days: 7 },
  { key: '30d',   label: '30 jours',        days: 30 },
  { key: '3m',    label: '3 mois',          days: 90 },
  { key: '6m',    label: '6 mois',          days: 180 },
  { key: '1y',    label: '1 an',            days: 365 },
]

const MAX_XTICKS = 8

function Shell({ icon: Icon, color, title, onClose, children }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={17} color={color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function SummaryBoxes({ items, color }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length},1fr)`, gap: 12, marginBottom: 20 }}>
      {items.map(([label, val]) => (
        <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${color}` }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
        </div>
      ))}
    </div>
  )
}

function PeriodPills({ periods, active, onChange, color, format = p => p.label }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
      {periods.map(p => (
        <button key={p.key} onClick={() => onChange(p.key)} style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: active === p.key ? 'none' : '1px solid var(--border)',
          background: active === p.key ? color : 'transparent',
          color: active === p.key ? '#fff' : 'var(--text-muted)',
        }}>{format(p)}</button>
      ))}
    </div>
  )
}

// Série journalière d'une mesure de /admin/stats/timeseries (même source que
// la carte et sa courbe).
// Début du jour calendaire en UTC = jour de Dakar, comme le serveur
// (admin.kpi-definitions.js:startOfUtcDay), quel que soit le fuseau du poste.
function startOfUtcDay(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// Courses comptées par une carte « Aujourd'hui » : créées depuis minuit
// (createdAt) ou livrées depuis minuit (deliveredAt). /admin/orders trie par
// date de création décroissante et n'a pas de filtre de date : on charge les
// plus récentes et on garde celles du jour. Les totaux du pied de tableau
// sont ceux des cartes (part coursier = gains coursiers, frais DEM =
// commission facturée).
function TodayOrdersList({ kind, expectedCount, color }) {
  const [orders, setOrders] = useState(null)
  const [error, setError]   = useState(false)
  const scanLimit = kind === 'created' ? Math.max(expectedCount ?? 0, 0) + 20 : 200

  useEffect(() => {
    const params = kind === 'created' ? { limit: scanLimit } : { group: 'delivered', limit: scanLimit }
    api.get('/admin/orders', { params })
      .then(r => {
        const since = startOfUtcDay()
        const field = kind === 'created' ? 'createdAt' : 'deliveredAt'
        setOrders((r.data.orders ?? []).filter(o => o[field] && new Date(o[field]).getTime() >= since))
      })
      .catch(() => { setOrders([]); setError(true) })
  }, [kind, scanLimit])

  if (orders === null) return <div style={emptyStyle}>Chargement…</div>
  if (error) return <div style={{ ...emptyStyle, color: '#dc2626' }}>Impossible de charger la liste des courses.</div>
  if (orders.length === 0) return <div style={emptyStyle}>Aucune course {kind === 'created' ? 'créée' : 'livrée'} aujourd'hui.</div>

  const timeField = kind === 'created' ? 'createdAt' : 'deliveredAt'
  // Montants seulement pour les courses livrées : une course créée puis
  // annulée n'a rapporté ni part coursier ni frais DEM.
  const withAmounts = kind === 'delivered'
  const totalPrice = orders.reduce((s, o) => s + (o.price ?? 0), 0)
  const totalFee   = orders.reduce((s, o) => s + (o.demFee ?? 0), 0)

  return (
    <>
      {expectedCount != null && orders.length !== expectedCount && (
        <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>
          {orders.length} course(s) listée(s) pour {expectedCount} comptée(s) par la carte
          {kind === 'delivered' ? ` (la liste couvre les ${scanLimit} dernières courses livrées)` : ' (une course a pu arriver entre-temps : actualisez)'}.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead><tr>{[kind === 'created' ? 'Créée à' : 'Livrée à', 'Statut', 'Client', 'Coursier', 'Trajet', ...(withAmounts ? ['Part coursier', 'Frais DEM'] : [])].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(o[timeField]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</td>
                <td style={tdStyle}><Badge status={o.status} /></td>
                <td style={tdStyle}>{o.client?.proBusinessName ?? o.client?.name ?? o.clientName ?? '—'}</td>
                <td style={tdStyle}>{o.driver?.name ?? '—'}</td>
                <td style={{ ...tdStyle, fontSize: 12, maxWidth: 220 }} title={`${o.pickupAddress} → ${o.deliveryAddress}`}>
                  <div style={ellipsis}>{o.pickupAddress}</div>
                  <div style={{ ...ellipsis, color: 'var(--text-muted)' }}>→ {o.deliveryAddress}</div>
                </td>
                {withAmounts && <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatF(o.price)}</td>}
                {withAmounts && <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatF(o.demFee)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ ...tdStyle, fontWeight: 700, color }}>{orders.length} course{orders.length > 1 ? 's' : ''}</td>
              {withAmounts && <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatF(totalPrice)}</td>}
              {withAmounts && <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatF(totalFee)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

function KpiModal({ kpi, onClose }) {
  const [period, setPeriod] = useState(kpi.defaultPeriod ?? '30d')
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  const days = PERIODS.find(p => p.key === period)?.days ?? 30

  useEffect(() => {
    setLoading(true)
    api.get(`/admin/stats/timeseries?days=${days}`)
      .then(r => setData(r.data.map(d => ({
        ...d,
        dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', days <= 30 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' }),
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [days])

  const total = data.reduce((s, d) => s + (d[kpi.dataKey] ?? 0), 0)
  const avg   = data.length > 0 ? Math.round(total / data.length) : 0
  const max   = data.reduce((m, d) => Math.max(m, d[kpi.dataKey] ?? 0), 0)
  const isMoney = kpi.unit === 'F'
  const fmt = (v) => isMoney ? formatF(v) : v.toLocaleString('fr-FR')

  return (
    <Shell icon={kpi.icon} color={kpi.color} title={kpi.title} onClose={onClose}>
      <PeriodPills periods={PERIODS} active={period} onChange={setPeriod} color={kpi.color} />
      {kpi.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8, marginBottom: 14 }}>{kpi.note}</div>}
      {period === 'today' && kpi.list ? (
        <>
          <SummaryBoxes color={kpi.color} items={[["Aujourd'hui", loading ? '…' : fmt(total)]]} />
          <TodayOrdersList kind={kpi.list} expectedCount={kpi.expectedCount} color={kpi.color} />
        </>
      ) : (<>
      <SummaryBoxes color={kpi.color} items={[['Total', fmt(total)], ['Moyenne / jour', fmt(avg)], ['Max journalier', fmt(max)]]} />
      {loading ? <div style={emptyStyle}>Chargement…</div> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 24 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
              interval={data.length > MAX_XTICKS ? Math.ceil(data.length / MAX_XTICKS) - 1 : 0} angle={-35} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={isMoney ? formatAxisF : undefined} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmt(v), kpi.title]} />
            <Bar dataKey={kpi.dataKey} fill={kpi.color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      </>)}
    </Shell>
  )
}

const ATTEMPT_PERIODS = [
  { key: 24, label: '24 h' },
  { key: 48, label: '48 h' },
  { key: 72, label: '72 h' },
]

// Comptes ayant passé au moins une commande sur une fenêtre glissante —
// particuliers (/admin/stats/client-attempts) ou DEM Pro (/admin/stats/dem-pro-activity).
function OrderingAccountsModal({ kind, icon, color, onClose }) {
  const isPro = kind === 'demPro'
  const [hours, setHours] = useState(24)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(isPro ? `/admin/stats/dem-pro-activity?hours=${hours}` : `/admin/stats/client-attempts?hours=${hours}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [hours, isPro])

  const rows = (isPro ? data?.accounts : data?.clients) ?? []
  const count = isPro ? data?.totalAccounts : data?.totalClients

  return (
    <Shell icon={icon} color={color} title={isPro ? 'DEM Pro — comptes ayant commandé' : 'Clients ayant commandé'} onClose={onClose}>
      <PeriodPills periods={ATTEMPT_PERIODS} active={hours} onChange={setHours} color={color} format={p => `Dernières ${p.label}`} />
      <SummaryBoxes color={color} items={[
        [isPro ? 'Comptes' : 'Clients', count ?? 0],
        ['Commandes passées', data?.totalAttempts ?? 0],
        ['Succès (terminées)', data?.successRate != null ? `${data.successRate}%` : '—'],
      ]} />
      {loading ? <div style={emptyStyle}>Chargement…</div> : rows.length === 0 ? (
        <div style={emptyStyle}>Aucune commande sur cette période.</div>
      ) : (
        <table style={tableStyle}>
          <thead><tr>{[isPro ? 'Entreprise' : 'Client', 'Téléphone', 'Courses', 'Livrées', 'Annulées', 'Dernier statut', 'Dernière commande'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.clientId ?? a.phone} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{isPro ? (a.businessName ?? a.name) : a.name}</td>
                <td style={tdStyle}>{a.phone ?? '—'}</td>
                <td style={tdStyle}>{a.attempts}</td>
                <td style={tdStyle}>{a.delivered}</td>
                <td style={tdStyle}>{a.cancelled}</td>
                <td style={tdStyle}><Badge status={a.lastStatus} /></td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{new Date(a.lastAttemptAt).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

function minutesSince(date) {
  return date ? Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000)) : null
}

function formatDuration(min) {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${String(min % 60).padStart(2, '0')}`
}

// ── À traiter : liste fixe, chaque ligne mène à l'endroit où l'on agit ──────
function TodoRow({ icon: Icon, label, count, badge, detail, color, onClick, unknown }) {
  const done = !unknown && !badge && count === 0
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
      background: done ? 'transparent' : color + '0d', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#22c55e18' : color + '1f' }}>
        {done ? <CheckCircle size={15} color="#22c55e" /> : <Icon size={15} color={color} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--text-muted)' : 'var(--text)' }}>{label}</div>
        {detail && !done && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{detail}</div>}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: done ? '#22c55e' : color }}>{unknown ? '—' : (badge ?? count)}</div>
      {onClick && <ChevronRight size={14} color="var(--text-muted)" />}
    </button>
  )
}

// ── Carte groupée : un chiffre principal (clic → sa fenêtre de détail) et des
// lignes secondaires, chacune ouvrant SA fenêtre. Mise en page seulement :
// chaque chiffre et chaque fenêtre restent ceux des anciennes cartes séparées.
function GroupKpi({ icon: Icon, color, label, value, sub, trend, sparkData, sparkKey, onClick, rows = [], footer }) {
  return (
    <div style={{ ...glass, padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={color} />
          </div>
          {trend}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: 'var(--text)', marginTop: 6 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>{label}<InfoTip k={label} size={12} /></div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{sub}</div>}
      </div>
      {footer}
      {rows.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map(r => (
            <button key={r.label} onClick={r.onClick} disabled={!r.onClick} style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none',
              padding: '4px 2px', cursor: r.onClick ? 'pointer' : 'default', fontSize: 12, color: 'var(--text)', textAlign: 'left',
            }}>
              <span style={{ flex: 1, color: 'var(--text-muted)' }}>{r.label}</span>
              <span style={{ fontWeight: 700 }}>{r.value}</span>
              {r.onClick && <ChevronRight size={12} color="var(--text-muted)" />}
            </button>
          ))}
        </div>
      )}
      {sparkData && sparkKey && (
        <div style={{ marginLeft: -14, marginRight: -14, marginBottom: -10 }}>
          <MiniSparkline data={sparkData} dataKey={sparkKey} color={color} />
        </div>
      )}
    </div>
  )
}

// Répartition des courses créées aujourd'hui selon leur statut actuel
// (stats.todayBreakdown) — remplace l'ancien camembert.
function StatusBar({ breakdown }) {
  const parts = STATUS_PIE.map(s => ({ ...s, value: breakdown[s.key] ?? 0 })).filter(p => p.value > 0)
  if (!breakdown.total) return null
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--surface2)' }}>
        {parts.map(p => <div key={p.key} title={`${p.label} : ${p.value}`} style={{ width: `${(p.value / breakdown.total) * 100}%`, background: p.color }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 5 }}>
        {parts.map(p => (
          <span key={p.key} style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />{p.label} {p.value}
          </span>
        ))}
      </div>
    </div>
  )
}

// Compteur compact du bloc « En direct »
function CounterTile({ icon: Icon, color, label, value, sub, onClick, emphasis }) {
  return (
    <button onClick={onClick} style={{
      ...glass, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', minWidth: 0,
      ...(emphasis ? { borderColor: color, boxShadow: `0 0 0 1px ${color}55` } : {}),
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', minWidth: 28 }}>{value}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}<InfoTip k={label} size={12} /></div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </button>
  )
}

// Où agir pour chaque alerte financière (Finance, plan de refonte 3.1/3.2)
const ALERT_TARGETS = {
  UNPAID_DELIVERY:        '/finance?tab=paiements&vue=impayes',
  PAYMENT_DISPUTED:       '/finance?tab=paiements&vue=impayes',
  SAMIRPAY_ORPHAN:        '/finance?tab=paiements&vue=en-ligne',
  CASHOUT_REVIEW_OVERDUE: '/finance?tab=paiements&vue=en-ligne',
  DUPLICATE_PAYMENT_DUE:  '/finance?tab=paiements&vue=en-ligne',
  ONLINE_REFUND_DUE:      '/finance?tab=paiements&vue=en-ligne',
}

const SEVERITY_COLOR = { high: '#ef4444', medium: '#f59e0b' }

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isMobile, isTablet } = useResponsive()

  const role = user?.adminRole
  const isSuper   = !role || role === 'SUPER'
  const isDev     = role === 'DEV'
  const isFinance = role === 'FINANCE'
  const isSC      = role === 'SERVICE_CLIENT'
  const isAE      = role === 'ASSISTANCE_EXECUTIVE'

  // Ce que chaque rôle peut lire (mêmes droits que les routes du serveur,
  // admin.routes.js) — une section dont la source est interdite n'est ni
  // chargée ni affichée.
  const can = {
    revenue:        isSuper || isDev || isFinance,
    marketing:      isSuper,                           // /admin/marketing/kpis
    serviceClient:  isSuper || isDev || isSC || isAE,  // /admin/service-client/kpis, incidents, notes
    financeAlerts:  isSuper || isFinance,              // /admin/finance/alerts
    financeKpis:    isFinance,                         // pass achetés (page Finance pour les autres)
    validations:    isSuper,                           // /admin/validations/summary
    accounts:       !isFinance,
    retentionList:  isSuper || isSC || isAE,           // /admin/marketing/retention
    demProList:     isSuper || isSC || isAE,           // /admin/dem-pro
    cancellationDetail: isSuper || isDev || isSC,
    tech:           isSuper || isDev,
  }

  const [data, setData] = useState({})
  const [failed, setFailed] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [events, setEvents] = useState([])
  const [openModal, setOpenModal] = useState(null)
  const [liveTab, setLiveTab] = useState('orders')
  const [showLive, setShowLive] = useState(null) // null = déplié s'il y a des courses en cours
  const [trendDays, setTrendDays] = useState(7)
  const [series30, setSeries30] = useState(null)
  const [showTech, setShowTech] = useState(() => {
    try { return localStorage.getItem('dashboard.showTech') === 'true' } catch { return false }
  })

  // Charge un lot de sources en parallèle. Une source en échec garde sa
  // dernière valeur reçue et est signalée — jamais remplacée par 0.
  const loadSources = useCallback(async (sources) => {
    const entries = Object.entries(sources).filter(([, url]) => url)
    const results = await Promise.allSettled(entries.map(([, url]) => api.get(url).then(r => r.data)))
    const patch = {}
    const errors = []
    results.forEach((r, i) => {
      const key = entries[i][0]
      if (r.status === 'fulfilled') patch[key] = r.value
      else errors.push(key)
    })
    setData(prev => ({ ...prev, ...patch }))
    setFailed(prev => [...prev.filter(k => !entries.some(([key]) => key === k)), ...errors])
    setUpdatedAt(new Date())
  }, [])

  // Sources « temps réel » : rechargées à chaque événement de course.
  const loadLive = useCallback(() => loadSources({
    stats:      '/admin/stats',
    live:       '/admin/live',
    timeseries: '/admin/stats/timeseries?days=7',
    stuck:      `/admin/stats/stuck-pending-orders?period=${STUCK_PENDING_MIN}m`,
  }), [loadSources])

  // Sources plus lourdes (rétention, notes, alertes) : rechargées moins souvent.
  const loadSlow = useCallback(() => loadSources({
    marketing:     can.marketing     && '/admin/marketing/kpis',
    serviceClient: can.serviceClient && '/admin/service-client/kpis',
    financeAlerts: can.financeAlerts && !can.financeKpis && '/admin/finance/alerts',
    financeKpis:   can.financeKpis   && '/admin/finance/kpis',
    validations:   can.validations   && '/admin/validations/summary?limit=1',
    clientAttempts: can.accounts     && '/admin/stats/client-attempts?hours=24',
    demProActivity: can.accounts     && '/admin/stats/dem-pro-activity?hours=24',
    cancellationTrend: isAE          && '/admin/stats/timeseries?days=30',
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loadSources, role])

  const loadAll = useCallback(async () => {
    await Promise.all([loadLive(), loadSlow()])
    setLoaded(true)
  }, [loadLive, loadSlow])

  useAutoRefresh(loadLive, 30_000)
  useAutoRefresh(loadSlow, 120_000)

  // Santé technique (SUPER/DEV) — /health, indépendant du reste
  useEffect(() => {
    if (!can.tech) return
    const fetchHealth = () => api.get('/health').then(r => setData(prev => ({ ...prev, health: r.data }))).catch(() => {})
    fetchHealth()
    const t = setInterval(() => { if (document.visibilityState === 'visible') fetchHealth() }, 60_000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  // Temps réel : chaque événement est journalisé, et les sources « live »
  // sont rechargées UNE fois après une rafale (au lieu d'un rechargement
  // complet par événement).
  const debounceRef = useRef(null)
  useEffect(() => {
    loadAll()
    const s = connectSocket()
    const scheduleReload = () => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(loadLive, 1500)
    }
    const handlers = {
      'admin:order:new':         'Nouvelle commande',
      'admin:order:accepted':    'Commande acceptée',
      'admin:order:pickedup':    'Colis récupéré',
      'admin:order:delivered':   'Livraison confirmée',
      'admin:order:cancelled':   'Commande annulée',
      'admin:payment:confirmed': 'Paiement confirmé',
      'admin:payment:disputed':  '⚠ Litige signalé',
      'admin:driver:flagged':    '🚨 Coursier signalé',
    }
    Object.entries(handlers).forEach(([ev, label]) => {
      s.on(ev, d => {
        setEvents(prev => [{ label, data: d, time: new Date().toLocaleTimeString('fr-FR') }, ...prev.slice(0, 49)])
        scheduleReload()
      })
    })
    return () => {
      clearTimeout(debounceRef.current)
      Object.keys(handlers).forEach(ev => s.off(ev))
      disconnectSocket()
    }
  }, [loadAll, loadLive])

  // Tendances sur 30 jours : chargées à la demande (la série de 7 jours sert
  // aussi aux courbes des cartes)
  useEffect(() => {
    if (trendDays !== 30) return
    api.get('/admin/stats/timeseries?days=30').then(r => setSeries30(r.data)).catch(() => {})
  }, [trendDays, updatedAt])

  function toggleTech() {
    setShowTech(v => {
      try { localStorage.setItem('dashboard.showTech', String(!v)) } catch { /* stockage indisponible */ }
      return !v
    })
  }

  const { stats, live, stuck, marketing: mk, serviceClient: sc, financeKpis, validations, clientAttempts, demProActivity, health } = data
  const timeseries = (data.timeseries ?? []).map(d => ({
    ...d, dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
  }))
  const cancellationTrend = (data.cancellationTrend ?? []).map(d => ({
    ...d, dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  }))
  const financeAlerts = can.financeKpis
    ? (financeKpis?.lastAlert ? [financeKpis.lastAlert] : [])
    : (data.financeAlerts?.alerts ?? [])
  const financeAlertCount = can.financeKpis ? financeKpis?.alertCount : data.financeAlerts?.alerts?.length

  const v = (x) => (!loaded && x == null) ? '…' : (x ?? '—')
  const activeOrders = live?.activeOrders ?? []
  const onlineDrivers = live?.availableDrivers ?? []
  const busyDrivers = stats ? stats.drivers.available - stats.drivers.free : null
  const cancellationRate = mk?.cancellationRateToday ?? sc?.cancellationRateToday
  const open = (id) => () => setOpenModal(id)

  const today = stats?.todayBreakdown

  // ── 1. À traiter : seulement ce qui demande une action ──
  // Chaque alerte financière a sa propre ligne et mène là où l'on agit.
  const financeRows = can.financeAlerts ? financeAlerts.map(a => ({
    id: `fin-${a.type}`, icon: Wallet, color: SEVERITY_COLOR[a.severity] ?? '#ef4444', label: a.message,
    count: a.count ?? null, badge: a.count == null ? '!' : null,
    onClick: () => navigate(ALERT_TARGETS[a.type] ?? '/finance?tab=revenue'),
  })) : []
  if (can.financeKpis && financeAlertCount > financeAlerts.length) {
    const more = financeAlertCount - financeAlerts.length
    financeRows.push({ id: 'fin-more', icon: Wallet, color: '#ef4444', label: `${more} autre${more > 1 ? 's' : ''} alerte${more > 1 ? 's' : ''} financière${more > 1 ? 's' : ''}`, count: more, onClick: () => navigate('/finance') })
  }
  const todos = [
    { id: 'stuck', icon: Clock, color: '#f59e0b', label: `Courses sans coursier depuis plus de ${STUCK_PENDING_MIN} min`,
      count: stuck?.total, onClick: open('pending'),
      detail: stuck?.orders?.[0] ? `La plus ancienne attend depuis ${formatDuration(minutesSince(stuck.orders[0].createdAt))}` : null },
    can.serviceClient && { id: 'incidents', icon: ShieldAlert, color: '#ef4444', label: 'Incidents ouverts (nouveaux + en cours)',
      count: sc?.openIncidents, onClick: open('incidents') },
    can.validations && { id: 'validations', icon: ClipboardCheck, color: '#6366f1', label: 'Validations en attente',
      count: validations?.total, onClick: () => navigate('/validation'),
      detail: validations ? [
        validations.counts.drivers && `${validations.counts.drivers} coursier(s)`,
        validations.counts.chefs && `${validations.counts.chefs} chef(s) de flotte`,
        validations.counts.demPro && `${validations.counts.demPro} DEM Pro`,
        validations.counts.fleetExtensions && `${validations.counts.fleetExtensions} extension(s) de flotte`,
        validations.counts.adminRequests && `${validations.counts.adminRequests} demande(s) d'équipe`,
      ].filter(Boolean).join(' · ') : null },
    ...financeRows,
  ].filter(Boolean)
  const pendingTodos = todos.filter(t => t.badge || t.count > 0)
  const clearChecks = [
    'aucune course sans coursier',
    can.serviceClient && 'aucun incident ouvert',
    can.validations && 'aucune validation en attente',
    can.financeAlerts && 'aucune alerte financière',
  ].filter(Boolean)

  // ── 2. En direct : compteurs + liste dépliable (ancien « Suivi en direct ») ──
  const liveOpen = showLive ?? activeOrders.length > 0
  const liveCards = [
    !isFinance && { id: 'pending', icon: AlertTriangle, color: '#f59e0b', label: "En attente d'un coursier", value: v(stats?.orders.pending),
      sub: stats ? `+ ${stats.orders.scheduled} programmée(s) à venir` : null, emphasis: (stuck?.total ?? 0) > 0 },
    { id: 'active', icon: TrendingUp, color: '#6366f1', label: 'Courses en cours', value: v(stats?.orders.active),
      sub: 'Coursier engagé, course non terminée' },
    !isFinance && { id: 'drivers', icon: Bike, color: '#22c55e', label: 'Coursiers en ligne', value: v(stats?.drivers.available),
      sub: stats ? `${stats.drivers.free} libre(s) · ${busyDrivers} en course · ${stats.drivers.total} inscrits` : null },
  ].filter(Boolean)

  // ── Définitions des chiffres et de leurs fenêtres de détail ──
  // (inchangées ; les cartes ci-dessous ne font que les regrouper)
  const todayCards = [
    { id: 'created', icon: Package, color: '#0077b6', title: 'Courses créées',
      modal: { title: 'Courses créées', note: 'Commandes comptées à leur date de création.', dataKey: 'orders', unit: '', defaultPeriod: 'today', list: 'created', expectedCount: stats?.orders.createdToday } },
    { id: 'delivered', icon: CheckCircle, color: '#22c55e', title: 'Courses livrées',
      modal: { title: 'Courses livrées', note: 'Courses comptées à leur date de livraison.', dataKey: 'delivered', unit: '', defaultPeriod: 'today', list: 'delivered', expectedCount: stats?.orders.deliveredToday } },
    { id: 'cancellation', icon: XCircle, color: '#ef4444' },
    { id: 'demFee', icon: CreditCard, color: '#f59e0b',
      modal: { title: 'Commission DEM facturée', note: 'Frais DEM réellement facturés sur les courses livrées, à la date de livraison. Encaissé / à recouvrer : page Finance.', dataKey: 'demRevenue', unit: 'F', defaultPeriod: 'today', list: 'delivered', expectedCount: stats?.orders.deliveredToday } },
    { id: 'driverRevenue', icon: Wallet, color: '#10b981',
      modal: { title: 'Gains coursiers', note: 'Part coursier (prix de la course hors frais DEM) des courses livrées, à la date de livraison.', dataKey: 'driverRevenue', unit: 'F', defaultPeriod: 'today', list: 'delivered', expectedCount: stats?.orders.deliveredToday } },
    { id: 'newClients', icon: UserPlus, color: '#06b6d4' },
  ]
  const accountCards = [
    { id: 'clients', icon: Users, color: '#a78bfa' },
    { id: 'retention', icon: Repeat, color: '#8b5cf6' },
    { id: 'clientAttempts', icon: ShoppingBag, color: '#0ea5e9' },
    { id: 'demPro', icon: Briefcase, color: '#0284c7' },
    { id: 'demProActivity', icon: Briefcase, color: '#0369a1' },
    { id: 'lowDrivers', icon: Star, color: '#f59e0b' },
    { id: 'lowClients', icon: Star, color: '#f97316' },
  ]

  // ── 3. Aujourd'hui : 4 cartes ──
  const smallSample = (today?.total ?? 0) < 5
  const dayGroups = [
    { key: 'day-orders', icon: Package, color: '#0077b6', label: 'Courses créées aujourd’hui', value: v(stats?.orders.createdToday),
      sub: stats ? `Historique : ${stats.orders.total.toLocaleString('fr-FR')}` : null,
      trend: <TrendBadge current={stats?.trend?.ordersCreated?.today} previous={stats?.trend?.ordersCreated?.yesterdaySameTime} />,
      sparkKey: 'orders', onClick: open('created'),
      rows: [
        { label: 'Livrées (à l’heure de livraison)', value: v(stats?.orders.deliveredToday), onClick: open('delivered') },
        !isFinance && { label: 'Annulées', value: v(today?.cancelled), onClick: can.cancellationDetail ? open('cancellation') : null },
      ].filter(Boolean),
      footer: today ? <StatusBar breakdown={today} /> : null },
    can.revenue && { key: 'day-revenue', icon: CreditCard, color: '#f59e0b', label: 'Commission DEM facturée',
      value: stats ? formatF(stats.revenue.dem.today) : v(null),
      sub: stats ? `Courses livrées · total ${formatF(stats.revenue.dem.total)}` : null,
      trend: <TrendBadge current={stats?.revenue?.dem?.today} previous={stats?.revenue?.dem?.yesterdaySameTime} />,
      sparkKey: 'demRevenue', onClick: open('demFee'),
      rows: [{ label: 'Gains coursiers', value: stats ? formatF(stats.revenue.driver.today) : '…', onClick: open('driverRevenue') }] },
    !isFinance && { key: 'day-cancel', icon: XCircle, color: smallSample ? '#94a3b8' : '#ef4444', label: "Taux d'annulation",
      value: !today ? v(null) : smallSample ? `${today.cancelled} sur ${today.total}` : (cancellationRate == null ? v(null) : `${cancellationRate}%`),
      sub: !today ? null : smallSample
        ? 'Annulées sur créées aujourd’hui · pourcentage affiché à partir de 5 courses'
        : `${today.cancelled} annulée(s) sur ${today.total} créée(s) aujourd'hui`,
      onClick: can.cancellationDetail ? open('cancellation') : undefined },
    can.marketing && { key: 'day-new', icon: UserPlus, color: '#06b6d4', label: 'Nouveaux clients', value: v(mk?.newClientsToday),
      sub: 'Inscriptions du jour', onClick: open('newClients') },
    can.financeKpis && { key: 'day-pass', icon: Ticket, color: '#8b5cf6', label: 'Pass achetés', value: v(financeKpis?.passActivatedToday),
      sub: financeKpis ? `+ ${financeKpis.passGiftedToday} offert(s)` : null },
  ].filter(Boolean)

  // ── 4. Comptes : 4 cartes ──
  const accountGroups = can.accounts ? [
    { key: 'acc-clients', icon: Users, color: '#a78bfa', label: 'Clients inscrits', value: v(stats?.clients.total),
      sub: mk ? `${mk.activeClients} actifs · ${mk.inactiveClients} inactifs · ${mk.neverServedClients} jamais servis (30 j)` : null,
      onClick: can.retentionList ? open('clients') : undefined,
      rows: can.marketing ? [{ label: 'Rétention 30 jours', value: mk ? `${mk.retentionRate30d}%` : '…', onClick: open('retention') }] : [] },
    { key: 'acc-dempro', icon: Briefcase, color: '#0284c7', label: 'DEM Pro actifs / comptes', value: stats ? `${stats.demPro.active} / ${stats.demPro.total}` : v(null),
      sub: stats ? `${stats.demPro.pending} en attente de validation` : null, onClick: can.demProList ? open('demPro') : undefined },
    { key: 'acc-24h', icon: ShoppingBag, color: '#0ea5e9', label: 'Comptes ayant commandé (24 h)',
      value: clientAttempts && demProActivity ? clientAttempts.totalClients + demProActivity.totalAccounts : v(null),
      rows: [
        { label: 'Clients', value: clientAttempts ? `${clientAttempts.totalClients} · ${clientAttempts.totalAttempts} commande(s)` : '…', onClick: open('clientAttempts') },
        { label: 'DEM Pro', value: demProActivity ? `${demProActivity.totalAccounts} · ${demProActivity.totalAttempts} commande(s)` : '…', onClick: open('demProActivity') },
      ] },
    can.serviceClient && { key: 'acc-quality', icon: Star, color: '#f59e0b', label: 'Notes inférieures à 3/5',
      value: sc ? sc.lowRatingDrivers + sc.lowRatingClients : v(null),
      rows: [
        { label: 'Coursiers notés < 3/5', value: v(sc?.lowRatingDrivers), onClick: open('lowDrivers') },
        { label: 'Clients insatisfaits (note donnée)', value: v(sc?.lowRatingClients), onClick: open('lowClients') },
      ] },
  ].filter(Boolean) : []

  const renderGroup = (g) => (
    <GroupKpi key={g.key} icon={g.icon} color={g.color} label={g.label} value={g.value} sub={g.sub} trend={g.trend}
      sparkData={g.sparkKey ? timeseries : null} sparkKey={g.sparkKey} onClick={g.onClick} rows={g.rows} footer={g.footer} />
  )

  const allCards = [...liveCards, ...todayCards, ...accountCards]
  const modalCard = allCards.find(k => k.id === openModal)
  const close = () => setOpenModal(null)
  const modalProps = modalCard ? { icon: modalCard.icon, color: modalCard.color, onClose: close } : null

  // ── 5. Tendances : 7 ou 30 jours ──
  const chartSource = trendDays === 30 ? (series30 ?? []) : (data.timeseries ?? [])
  const chartData = chartSource.map(d => ({
    ...d, dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', trendDays === 30 ? { day: '2-digit', month: '2-digit' } : { weekday: 'short', day: 'numeric' }),
  }))
  const xInterval = chartData.length > MAX_XTICKS ? Math.ceil(chartData.length / MAX_XTICKS) - 1 : 0
  const chartCols = isMobile ? '1fr' : !can.revenue ? '1fr' : isTablet ? '1fr 1fr' : '1.3fr 1fr 1fr'

  return (
    <div>
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: isMobile ? 14 : 20 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center' }}>Dashboard<InfoTip title="Dashboard" text={PAGES['/']} size={16} /></h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {updatedAt ? `Mis à jour à ${updatedAt.toLocaleTimeString('fr-FR')}` : 'Chargement…'} · jour calendaire de Dakar
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {can.tech && health && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
              color: health.status === 'ok' ? '#22c55e' : '#ef4444', background: health.status === 'ok' ? '#22c55e18' : '#ef444418' }}>
              ● {health.status === 'ok' ? 'Serveur opérationnel' : 'Serveur dégradé'}
            </span>
          )}
          <button onClick={loadAll} title="Actualiser" style={iconButton}><RefreshCw size={14} /></button>
          {isSuper && <ValidationNotifications />}
        </div>
      </div>

      {failed.length > 0 && (
        <div style={{ ...glass, padding: '10px 14px', marginBottom: 16, borderColor: '#f59e0b', fontSize: 12, color: '#b45309' }}>
          Certaines données n'ont pas pu être actualisées ({failed.length} source{failed.length > 1 ? 's' : ''}) — les chiffres concernés sont les derniers reçus.
        </div>
      )}

      {/* ── 1. À traiter ── */}
      <Section title="À traiter" hint={loaded ? (pendingTodos.length === 0 ? null : `${pendingTodos.length} point${pendingTodos.length > 1 ? 's' : ''} à regarder`) : null}>
        {!loaded ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chargement…</div>
        ) : pendingTodos.length === 0 ? (
          <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <CheckCircle size={18} color="#22c55e" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Tout est à jour</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{clearChecks.join(' · ')}</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 8 }}>
            {pendingTodos.map(t => (
              <TodoRow key={t.id} icon={t.icon} color={t.color} label={t.label} count={t.count ?? 0} badge={t.badge}
                detail={t.detail} onClick={t.onClick} />
            ))}
          </div>
        )}
      </Section>

      {/* ── 2. En direct (compteurs + courses et coursiers) ── */}
      <Section title="En direct" hint="État des opérations à cet instant" right={!isFinance && (
        <button onClick={() => navigate('/map')} style={linkButton}><MapIcon size={13} /> Carte live</button>
      )}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {liveCards.map(k => (
            <CounterTile key={k.id} icon={k.icon} color={k.color} label={k.label} value={k.value} sub={k.sub}
              emphasis={k.emphasis} onClick={open(k.id)} />
          ))}
        </div>
        {!isFinance && (
          <>
            <button onClick={() => setShowLive(!liveOpen)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600 }}>
              {liveOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {liveOpen ? 'Masquer' : 'Afficher'} les courses ({activeOrders.length}) et les coursiers en ligne ({onlineDrivers.length})
            </button>
            {liveOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: isMobile ? 10 : 14, marginTop: 8 }}>
                <div style={card}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      ['orders', `Courses en attente et en cours (${activeOrders.length})`],
                      ['drivers', `Coursiers en ligne (${onlineDrivers.length})`],
                    ].map(([key, label]) => (
                      <button key={key} onClick={() => setLiveTab(key)} style={tabButton(liveTab === key)}>{label}</button>
                    ))}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    {liveTab === 'orders' ? (
                      activeOrders.length === 0 ? <div style={emptyStyle}>Aucune course en attente ni en cours.</div> : (
                        <table style={tableStyle}>
                          <thead><tr>{['Statut', 'Type', 'Client', 'Coursier', 'Trajet', 'Prix', 'Depuis'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                          <tbody>
                            {activeOrders.map(o => {
                              const since = minutesSince(o.status === 'PENDING' ? o.createdAt : (o.acceptedAt ?? o.createdAt))
                              const late = o.status === 'PENDING' && since >= STUCK_PENDING_MIN
                              return (
                                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={tdStyle}><Badge status={o.status} /></td>
                                  <td style={tdStyle}><Badge status={o.orderType} /></td>
                                  <td style={tdStyle}>{o.client?.name ?? '—'}</td>
                                  <td style={tdStyle}>{o.driver?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                  <td style={{ ...tdStyle, fontSize: 12, maxWidth: 260 }} title={`${o.pickupAddress} → ${o.deliveryAddress}`}>
                                    <div style={ellipsis}>{o.pickupAddress}</div>
                                    <div style={{ ...ellipsis, color: 'var(--text-muted)' }}>→ {o.deliveryAddress}</div>
                                  </td>
                                  <td style={tdStyle}>{formatF(o.price)}</td>
                                  <td style={{ ...tdStyle, fontWeight: late ? 700 : 400, color: late ? '#f59e0b' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDuration(since)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    ) : (
                      onlineDrivers.length === 0 ? <div style={emptyStyle}>Aucun coursier en ligne.</div> : (
                        <table style={tableStyle}>
                          <thead><tr>{['Coursier', 'Téléphone', 'Véhicule', 'Statut', 'Dernier signal'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                          <tbody>
                            {onlineDrivers.map(d => (
                              <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={tdStyle}>{d.name}</td>
                                <td style={tdStyle}>{d.phone}</td>
                                <td style={tdStyle}>{d.vehicleType ?? '—'}</td>
                                <td style={tdStyle}><Badge status={d.busy ? 'ACCEPTED' : 'ONLINE'} label={d.busy ? 'En course' : 'Libre'} /></td>
                                <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                                  {d.lastSeenAt ? `il y a ${formatDuration(minutesSince(d.lastSeenAt))}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    )}
                  </div>
                </div>

                <div style={card}>
                  <h3 style={cardTitle}>Fil d'activité<InfoTip k="Fil d'activité" size={13} /></h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {events.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Les événements apparaissent ici en direct tant que la page est ouverte.</div>
                    ) : events.map((ev, i) => (
                      <div key={i} style={{ padding: '7px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{ev.label}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>
                          {ev.time}{ev.data?.orderId ? ` — ${ev.data.orderId.slice(0, 8)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── 3. Aujourd'hui ── */}
      <Section title="Aujourd'hui" hint="Depuis minuit · tendance comparée à hier à la même heure">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {dayGroups.map(renderGroup)}
        </div>
      </Section>

      {/* ── 4. Comptes ── */}
      {accountGroups.length > 0 && (
        <Section title="Comptes" hint="Clients, DEM Pro, activité des 24 dernières heures et notes">
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {accountGroups.map(renderGroup)}
          </div>
        </Section>
      )}

      {/* ── Assistant exécutif : taux d'annulation, 30 jours ── */}
      {isAE && (
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={cardTitle}>Taux d'annulation — 30 derniers jours<InfoTip k="Taux d'annulation — 30 derniers jours" size={13} /></h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cancellationTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => [`${val}%`, "Taux d'annulation"]} />
              <Line type="monotone" dataKey="cancellationRate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 5. Tendances ── */}
      <Section title="Tendances" hint={`${trendDays} derniers jours`} right={
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 30].map(d => (
            <button key={d} onClick={() => setTrendDays(d)} style={tabButton(trendDays === d)}>{d} jours</button>
          ))}
        </div>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: chartCols, gap: isMobile ? 10 : 14 }}>
          <div style={{ ...card, gridColumn: isTablet && can.revenue ? 'span 2' : 'auto' }}>
            <h3 style={cardTitle}>Courses créées et livrées<InfoTip k="Courses créées et livrées" size={13} /></h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={xInterval} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#0077b608' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="orders"    name="Créées"  fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" name="Livrées" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {can.revenue && [
            ['demRevenue', 'Commission DEM facturée', '#f59e0b'],
            ['driverRevenue', 'Gains coursiers', '#10b981'],
          ].map(([key, title, color]) => (
            <div key={key} style={card}>
              <h3 style={cardTitle}>{title} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>· date de livraison</span><InfoTip k={title} size={13} /></h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={xInterval} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={formatAxisF} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#0077b608' }} formatter={(val) => [formatF(val), title]} />
                  <Bar dataKey={key} name={title} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Santé technique (repliée par défaut) ── */}
      {can.tech && health && (
        <div style={{ ...card, marginBottom: 20 }}>
          <button onClick={toggleTech} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)' }}>
            {showTech ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <Activity size={15} color="var(--primary)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Santé technique</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span><Wifi size={11} style={{ marginRight: 3, verticalAlign: -1 }} />{health.sockets?.connected ?? '?'} connexion{(health.sockets?.connected ?? 0) > 1 ? 's' : ''}</span>
              <span>en service depuis {Math.floor((health.uptime ?? 0) / 3600)} h {Math.floor(((health.uptime ?? 0) % 3600) / 60)} min</span>
            </span>
          </button>
          {showTech && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2,1fr)', gap: 10, marginTop: 14 }}>
              {[
                { label: 'Dispatch (depuis le démarrage)', items: [
                  { k: 'Cycles',           v: health.dispatch?.cycles ?? 0 },
                  { k: 'Aucun coursier',   v: health.dispatch?.noDriverEvents ?? 0, warn: health.dispatch?.noDriverEvents > 5 },
                  { k: 'Offres expirées',  v: health.dispatch?.offersExpired ?? 0 },
                  { k: 'Auto-annulées',    v: health.dispatch?.autoCancelled ?? 0, warn: health.dispatch?.autoCancelled > 0 },
                ] },
                { label: 'Surveillance des courses', items: [
                  { k: 'Cycles',             v: health.incident?.cycles ?? 0 },
                  { k: 'Relancées',          v: health.incident?.redispatched ?? 0, warn: health.incident?.redispatched > 3 },
                  { k: 'Coursiers injoignables', v: health.incident?.unreachableAlerts ?? 0, warn: health.incident?.unreachableAlerts > 0 },
                ] },
              ].map(({ label, items }) => (
                <div key={label} style={{ background: 'rgba(0,119,182,0.04)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(0,119,182,0.10)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  {items.map(({ k, v: val, warn }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: warn ? '#f97316' : 'var(--text)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Fenêtres de détail : chacune liste la population de sa carte ── */}
      {modalCard?.modal && <KpiModal kpi={{ ...modalCard.modal, icon: modalCard.icon, color: modalCard.color }} onClose={close} />}
      {openModal === 'pending'        && <StuckPendingOrdersModal icon={AlertTriangle} color="#f59e0b" onClose={close} />}
      {openModal === 'active'         && <ActiveOrdersModal {...modalProps} />}
      {openModal === 'drivers'        && <DriverActivityModal {...modalProps} />}
      {openModal === 'cancellation'   && (isSuper ? <CancellationModal {...modalProps} /> : <CancellationRateModal {...modalProps} />)}
      {openModal === 'newClients'     && <NewClientsModal {...modalProps} />}
      {openModal === 'clients'        && <RetentionModal {...modalProps} focus="active" title="Clients inscrits" />}
      {openModal === 'retention'      && <RetentionModal {...modalProps} focus="retention" />}
      {openModal === 'clientAttempts' && <OrderingAccountsModal kind="clients" {...modalProps} />}
      {openModal === 'demPro'         && <DemProAccountsModal {...modalProps} />}
      {openModal === 'demProActivity' && <OrderingAccountsModal kind="demPro" {...modalProps} />}
      {openModal === 'lowDrivers'     && <LowRatingModal {...modalProps} role="DRIVER" title="Coursiers notés < 3/5" />}
      {openModal === 'lowClients'     && <LowRatingModal {...modalProps} role="CLIENT" title="Clients insatisfaits (note moyenne donnée < 3/5)" />}
      {openModal === 'incidents'      && <IncidentsModal icon={ShieldAlert} color="#ef4444" onClose={close} />}
    </div>
  )
}

const card       = { ...glass, padding: '16px 18px', minWidth: 0 }
const cardTitle  = { fontSize: 13, fontWeight: 600, marginBottom: 12, marginTop: 0 }
const emptyStyle = { color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }
const ellipsis   = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle    = { padding: '8px', verticalAlign: 'middle', fontSize: 13 }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
const iconButton = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 16, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', color: 'var(--text-muted)', cursor: 'pointer' }
const linkButton = { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const tabButton = (active) => ({
  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: active ? 'none' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
})
