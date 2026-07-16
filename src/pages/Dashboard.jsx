import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { connectSocket, disconnectSocket } from '../lib/socket'
import api from '../lib/api'
import Badge from '../components/Badge'
import { Package, Bike, AlertTriangle, TrendingUp, Users, CreditCard, Activity, Wifi, ArrowUpRight, ArrowDownRight, Minus, Briefcase, Eye, EyeOff, Ticket } from 'lucide-react'
import { glass } from '../lib/glassStyles'
import { useResponsive } from '../lib/useResponsive'
import { useAuth } from '../contexts/AuthContext'
import MarketingKpiRow from './marketing/components/MarketingKpiRow'
import ServiceClientKpiRow from './service-client/components/KpiRow'
import ValidationNotifications from '../components/ValidationNotifications'

function TrendBadge({ current, previous }) {
  if (previous == null || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#94a3b818', padding: '1px 6px', borderRadius: 8 }}>
      <Minus size={10} /> 0%
    </span>
  )
  const up = pct > 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10, fontWeight: 700,
      color: up ? '#22c55e' : '#ef4444',
      background: up ? '#22c55e14' : '#ef444414',
      padding: '1px 6px', borderRadius: 8,
    }}>
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

function MiniSparkline({ data, dataKey, color, height = 32 }) {
  if (!data || data.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
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

function StatCard({ icon: Icon, label, value, sub, color = 'var(--primary)', trend, sparkData, sparkKey, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...glass,
        padding: '14px 14px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .2s',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 110,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,119,182,0.18)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} color={color} />
        </div>
        {trend}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500, lineHeight: 1.2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {sparkData && sparkKey && (
        <div style={{ marginLeft: -14, marginRight: -14, marginBottom: -10 }}>
          <MiniSparkline data={sparkData} dataKey={sparkKey} color={color} height={28} />
        </div>
      )}
    </div>
  )
}

const TOOLTIP_STYLE = {
  background: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
}

const STATUS_PIE = [
  { key: 'pending',       label: 'En attente',  color: '#f59e0b' },
  { key: 'active',        label: 'En cours',    color: '#6366f1' },
  { key: 'deliveredToday',label: 'Livrées/j',   color: '#22c55e' },
  { key: 'cancelled',     label: 'Annulées',    color: '#ef4444' },
]

const PERIODS = [
  { key: 'today', label: "Aujourd'hui",     days: 1 },
  { key: '3d',    label: '3 derniers jours', days: 3 },
  { key: '7d',    label: '7 jours',         days: 7 },
  { key: '30d',   label: '30 jours',        days: 30 },
  { key: '3m',    label: '3 derniers mois', days: 90 },
  { key: '6m',    label: '6 mois',          days: 180 },
  { key: '1y',    label: '1 an',            days: 365 },
]

const MAX_XTICKS = 8 // nb max de labels visibles sur l'axe X avant de sauter des ticks

function KpiModal({ kpi, onClose }) {
  const [period, setPeriod] = useState('30d')
  const [data, setData]     = useState([])
  const [mLoading, setMLoading] = useState(true)

  const days = PERIODS.find(p => p.key === period)?.days ?? 30

  useEffect(() => {
    setMLoading(true)
    api.get(`/admin/stats/timeseries?days=${days}`)
      .then(r => {
        setData(r.data.map(d => ({
          ...d,
          dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', days <= 30 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' }),
        })))
      })
      .catch(() => {})
      .finally(() => setMLoading(false))
  }, [days])

  const total  = data.reduce((s, d) => s + (d[kpi.dataKey] ?? 0), 0)
  const avg    = data.length > 0 ? Math.round(total / data.length) : 0
  const max    = data.reduce((m, d) => Math.max(m, d[kpi.dataKey] ?? 0), 0)
  const isMoney = kpi.unit === 'F'

  const fmt = (v) => isMoney ? `${v.toLocaleString()} F` : v.toLocaleString()

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 680, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{kpi.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Filtres période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: period === p.key ? 'none' : '1px solid var(--border)',
                background: period === p.key ? kpi.color : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* KPIs résumé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[['Total', total], ['Moyenne / jour', avg], ['Max journalier', max]].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{fmt(val)}</div>
              </div>
            ))}
          </div>

          {/* Graphique */}
          {mLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 24 }}>
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                  interval={data.length > MAX_XTICKS ? Math.ceil(data.length / MAX_XTICKS) - 1 : 0}
                  angle={-35}
                  textAnchor="end"
                  height={40}
                />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmt(v), kpi.title]} />
                <Bar dataKey={kpi.dataKey} fill={kpi.color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

const ATTEMPT_PERIODS = [
  { key: 24, label: '24h' },
  { key: 48, label: '48h' },
  { key: 72, label: '72h' },
]

function ClientAttemptsModal({ kpi, onClose }) {
  const [hours, setHours] = useState(24)
  const [data, setData]   = useState(null)
  const [mLoading, setMLoading] = useState(true)

  useEffect(() => {
    setMLoading(true)
    api.get(`/admin/stats/client-attempts?hours=${hours}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setMLoading(false))
  }, [hours])

  const totalClients  = data?.totalClients  ?? 0
  const totalAttempts = data?.totalAttempts ?? 0
  const successRate   = totalAttempts > 0
    ? Math.round((data.clients.reduce((s, c) => s + c.delivered, 0) / totalAttempts) * 100)
    : 0

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Clients ayant tenté de commander</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Filtres période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {ATTEMPT_PERIODS.map(p => (
              <button key={p.key} onClick={() => setHours(p.key)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: hours === p.key ? 'none' : '1px solid var(--border)',
                background: hours === p.key ? kpi.color : 'transparent',
                color: hours === p.key ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}>
                Dernières {p.label}
              </button>
            ))}
          </div>

          {/* Résumé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[['Clients uniques', totalClients], ['Tentatives totales', totalAttempts], ['Taux de succès', `${successRate}%`]].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Liste des clients */}
          {mLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
          ) : !data || data.clients.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucun client n'a tenté de commander sur cette période.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>{['Client','Téléphone','Tentatives','Livrées','Annulées','Dernier statut','Dernière tentative'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.clients.map(c => (
                  <tr key={c.clientId ?? c.phone} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={tdStyle}>{c.phone ?? '—'}</td>
                    <td style={tdStyle}>{c.attempts}</td>
                    <td style={tdStyle}>{c.delivered}</td>
                    <td style={tdStyle}>{c.cancelled}</td>
                    <td style={tdStyle}><Badge status={c.lastStatus} /></td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{new Date(c.lastAttemptAt).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

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

function DriverActivityModal({ kpi, onClose }) {
  const [period, setPeriod] = useState('live')
  const [data, setData]     = useState(null)
  const [mLoading, setMLoading] = useState(true)

  useEffect(() => {
    setMLoading(true)
    api.get(`/admin/stats/active-drivers?period=${period}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setMLoading(false))
  }, [period])

  const totalActive     = data?.totalActive     ?? 0
  const totalRegistered = data?.totalRegistered ?? 0
  const onlineNowCount   = data?.onlineNowCount  ?? 0

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Livreurs actifs</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Filtres période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {DRIVER_PRESENCE_PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: period === p.key ? 'none' : '1px solid var(--border)',
                background: period === p.key ? kpi.color : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}>
                {p.key === 'live' ? '🔴 En live' : p.label}
              </button>
            ))}
          </div>

          {/* Résumé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[['Livreurs actifs', totalActive], ['En ligne maintenant', onlineNowCount], ['Flotte totale', totalRegistered]].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Liste des livreurs */}
          {mLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
          ) : !data || data.drivers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucun livreur actif sur cette période.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>{['Livreur','Téléphone','Véhicule','Statut','Dernière connexion'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
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
        </div>
      </div>
    </div>
  )
}

function DemProActivityModal({ kpi, onClose }) {
  const [hours, setHours] = useState(24)
  const [data, setData]   = useState(null)
  const [mLoading, setMLoading] = useState(true)

  useEffect(() => {
    setMLoading(true)
    api.get(`/admin/stats/dem-pro-activity?hours=${hours}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setMLoading(false))
  }, [hours])

  const totalAccounts = data?.totalAccounts ?? 0
  const totalAttempts = data?.totalAttempts ?? 0
  const successRate   = totalAttempts > 0
    ? Math.round((data.accounts.reduce((s, a) => s + a.delivered, 0) / totalAttempts) * 100)
    : 0

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Comptes DEM Pro actifs</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Filtres période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {ATTEMPT_PERIODS.map(p => (
              <button key={p.key} onClick={() => setHours(p.key)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: hours === p.key ? 'none' : '1px solid var(--border)',
                background: hours === p.key ? kpi.color : 'transparent',
                color: hours === p.key ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}>
                Dernières {p.label}
              </button>
            ))}
          </div>

          {/* Résumé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[['Comptes Pro actifs', totalAccounts], ['Courses passées', totalAttempts], ['Taux de succès', `${successRate}%`]].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${kpi.color}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Liste des comptes Pro */}
          {mLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
          ) : !data || data.accounts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucun compte DEM Pro n'a passé de course sur cette période.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>{['Entreprise','Contact','Téléphone','Courses','Livrées','Annulées','Dernier statut','Dernière activité'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.accounts.map(a => (
                  <tr key={a.clientId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{a.businessName ?? '—'}</td>
                    <td style={tdStyle}>{a.name}</td>
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
        </div>
      </div>
    </div>
  )
}

const RECENT_ACTIVE_PERIODS = [
  { key: '5m',  label: '5 min' },
  { key: '10m', label: '10 min' },
  { key: '30m', label: '30 min' },
  { key: '1h',  label: '1h' },
  { key: '2h',  label: '2h' },
  { key: '6h',  label: '6h' },
]

function ActiveOrdersModal({ kpi, onClose }) {
  const [period, setPeriod] = useState('30m')
  const [data, setData]     = useState(null)
  const [mLoading, setMLoading] = useState(true)

  useEffect(() => {
    setMLoading(true)
    api.get(`/admin/stats/recent-active-orders?period=${period}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setMLoading(false))
  }, [period])

  const total = data?.total ?? 0

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Courses en cours — activité récente</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Filtres période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {RECENT_ACTIVE_PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: period === p.key ? 'none' : '1px solid var(--border)',
                background: period === p.key ? kpi.color : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}>
                Derniers {p.label}
              </button>
            ))}
          </div>

          {/* Résumé */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${kpi.color}`, display: 'inline-block' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Prises en charge récentes</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{total}</div>
            </div>
          </div>

          {/* Liste des courses */}
          {mLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
          ) : !data || data.orders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucune course passée en cours sur cette période.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>{['Statut','Client','Livreur','Départ','Arrivée','Prix','Prise en charge'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
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
        </div>
      </div>
    </div>
  )
}

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

function StuckPendingOrdersModal({ kpi, onClose }) {
  const [period, setPeriod] = useState('5m')
  const [data, setData]     = useState(null)
  const [mLoading, setMLoading] = useState(true)

  useEffect(() => {
    setMLoading(true)
    api.get(`/admin/stats/stuck-pending-orders?period=${period}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setMLoading(false))
  }, [period])

  const total = data?.total ?? 0

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.icon size={18} color={kpi.color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Courses en attente — sans livreur depuis...</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Filtres période */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {STUCK_PENDING_PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: period === p.key ? 'none' : '1px solid var(--border)',
                background: period === p.key ? kpi.color : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-muted)',
                transition: 'all .15s',
              }}>
                Plus de {p.label}
              </button>
            ))}
          </div>

          {/* Résumé */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${kpi.color}`, display: 'inline-block' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Commandes en attente</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{total}</div>
            </div>
          </div>

          {/* Liste des courses */}
          {mLoading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
          ) : !data || data.orders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucune course en attente depuis plus de ce délai.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>{['Client','Départ','Arrivée','Prix','En attente depuis','Dispatch'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
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
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const isServiceClient = user?.adminRole === 'SERVICE_CLIENT'
  const isFinance = user?.adminRole === 'FINANCE'
  const isSuper = !user?.adminRole || user.adminRole === 'SUPER'
  const [financeKpis, setFinanceKpis] = useState(null)
  const [showCommunity, setShowCommunity] = useState(() => localStorage.getItem('dashboard.showCommunity') !== 'false')
  const [showServiceClient, setShowServiceClient] = useState(() => localStorage.getItem('dashboard.showServiceClient') !== 'false')

  function toggleSection(key, setter) {
    setter(v => {
      const next = !v
      localStorage.setItem(key, String(next))
      return next
    })
  }
  const [stats, setStats]       = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [timeseries, setTimeseries] = useState([])
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [health, setHealth]     = useState(null)
  const [openKpi, setOpenKpi]   = useState(null)

  // Santé système — poll toutes les 30s indépendamment du reste
  useEffect(() => {
    const fetchHealth = () => api.get('/health').then(r => setHealth(r.data)).catch(() => {})
    fetchHealth()
    const t = setInterval(fetchHealth, 30_000)
    return () => clearInterval(t)
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, lRes, tRes, fRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/live'),
        api.get('/admin/stats/timeseries?days=7'),
        isFinance ? api.get('/admin/finance/kpis') : Promise.resolve(null),
      ])
      setStats(sRes.data)
      setSnapshot(lRes.data)
      setTimeseries(tRes.data.map(d => ({
        ...d,
        dateLabel:      new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        driverRevenueK: Math.round((d.driverRevenue ?? 0) / 1000),
        demRevenueK:    Math.round((d.demRevenue    ?? 0) / 1000),
      })))
      if (fRes) setFinanceKpis(fRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [isFinance])

  useEffect(() => {
    fetchAll()
    const s = connectSocket()

    const addEvent = (label, data) =>
      setEvents(prev => [{ label, data, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 49)])

    s.on('admin:order:new',        d => { addEvent('Nouvelle commande', d);   fetchAll() })
    s.on('admin:order:accepted',   d => { addEvent('Commande acceptée', d);   fetchAll() })
    s.on('admin:order:pickedup',   d => { addEvent('Colis récupéré', d);      fetchAll() })
    s.on('admin:order:delivered',  d => { addEvent('Livraison confirmée', d); fetchAll() })
    s.on('admin:order:cancelled',  d => { addEvent('Commande annulée', d);    fetchAll() })
    s.on('admin:payment:confirmed',d => { addEvent('Paiement confirmé', d);   fetchAll() })
    s.on('admin:payment:disputed', d => { addEvent('⚠ Litige signalé', d);    fetchAll() })
    s.on('admin:driver:flagged',   d => { addEvent('🚨 Livreur signalé', d);  fetchAll() })

    return () => {
      ['admin:order:new','admin:order:accepted','admin:order:pickedup',
       'admin:order:delivered','admin:order:cancelled',
       'admin:payment:confirmed','admin:payment:disputed','admin:driver:flagged',
      ].forEach(ev => s.off(ev))
      disconnectSocket()
    }
  }, [fetchAll])

  const activeOrders = snapshot?.activeOrders   ?? []
  const availDrivers = snapshot?.availableDrivers ?? []

  const pieData = stats ? STATUS_PIE.map(s => ({
    name: s.label,
    value: stats.orders[s.key] ?? 0,
    color: s.color,
  })).filter(d => d.value > 0) : []

  const { isMobile, isTablet } = useResponsive()
  const chartCols = isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 300px'
  const livecols  = isMobile ? '1fr' : '1fr 320px'

  const todayTs    = timeseries[timeseries.length - 1]
  const yesterdayTs = timeseries[timeseries.length - 2]

  const ALL_KPI_CARDS = [
    { id: 'courses',    icon: Package,      color: '#0077b6', label: 'Total courses',    value: stats?.orders.total ?? 0,      title: 'Courses',          dataKey: 'orders',        unit: '', sparkKey: 'orders' },
    { id: 'active',     icon: TrendingUp,   color: '#6366f1', label: 'En cours',         value: stats?.orders.active ?? 0,     title: 'Courses en cours', dataKey: 'orders',        unit: '' },
    { id: 'pending',    icon: AlertTriangle, color: '#f59e0b', label: 'En attente',       value: stats?.orders.pending ?? 0,    title: 'Courses en attente', dataKey: 'orders',     unit: '' },
    { id: 'drivers',    icon: Bike,         color: '#22c55e', label: 'Livreurs dispo',    value: stats?.drivers.available ?? 0, title: 'Livreurs',         dataKey: 'delivered',     unit: '', sub: `/ ${stats?.drivers.total ?? 0}` },
    { id: 'clients',    icon: Users,        color: '#a78bfa', label: 'Clients',           value: stats?.clients.total ?? 0,     title: 'Clients',          dataKey: 'orders',        unit: '' },
    { id: 'demPro',     icon: Briefcase,    color: '#0ea5e9', label: 'DEM Pro',           value: stats?.demPro?.active ?? 0,    title: 'DEM Pro',          dataKey: 'orders',        unit: '', sub: `${stats?.demPro?.pending ?? 0} en attente` },
    { id: 'revDriver',  icon: CreditCard,   color: '#22c55e', label: 'Rev. livreurs',     value: `${(stats?.revenue?.driver?.today ?? 0).toLocaleString()} F`, title: 'Revenus livreurs', dataKey: 'driverRevenue', unit: 'F', sub: `Total ${((stats?.revenue?.driver?.total ?? 0) / 1000).toFixed(0)}k`, sparkKey: 'driverRevenue' },
    { id: 'revDem',     icon: CreditCard,   color: '#f59e0b', label: 'Frais DEM',         value: `${(stats?.revenue?.dem?.today ?? 0).toLocaleString()} F`,    title: 'Frais DEM',        dataKey: 'demRevenue',    unit: 'F', sub: `Estimé · Total ${((stats?.revenue?.dem?.total ?? 0) / 1000).toFixed(0)}k`, sparkKey: 'demRevenue' },
    { id: 'passActivated', icon: Ticket,    color: '#8b5cf6', label: 'Pass activés (jour)', value: financeKpis?.passActivatedToday ?? 0, clickable: false },
  ]

  // Service Client ne voit pas les KPI de chiffre d'affaires.
  // Finance ne voit que les KPI opérationnels utiles à son rôle (pas les
  // courses en attente/livreurs/clients/DEM Pro), + le nombre de pass activés.
  const KPI_CARDS = isServiceClient
    ? ALL_KPI_CARDS.filter(k => k.id !== 'revDriver' && k.id !== 'revDem' && k.id !== 'passActivated')
    : isFinance
    ? ALL_KPI_CARDS.filter(k => ['courses', 'active', 'revDriver', 'revDem', 'passActivated'].includes(k.id))
    : ALL_KPI_CARDS.filter(k => k.id !== 'passActivated')
  const kpiCols = isMobile ? 2 : isTablet ? 4 : KPI_CARDS.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: isMobile ? 16 : 24 }}>
        <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>Dashboard</h1>
        {isSuper && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => toggleSection('dashboard.showCommunity', setShowCommunity)} style={visibilityToggle(showCommunity)}>
              {showCommunity ? <Eye size={13} /> : <EyeOff size={13} />} Community
            </button>
            <button onClick={() => toggleSection('dashboard.showServiceClient', setShowServiceClient)} style={visibilityToggle(showServiceClient)}>
              {showServiceClient ? <Eye size={13} /> : <EyeOff size={13} />} Service Client
            </button>
            <ValidationNotifications />
          </div>
        )}
      </div>

      {/* ── KPI cards — une seule ligne ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCols},1fr)`, gap: isMobile ? 8 : 10, marginBottom: isMobile ? 16 : 24 }}>
        {KPI_CARDS.map(k => (
          <StatCard
            key={k.id}
            icon={k.icon} color={k.color}
            label={k.label} value={loading ? '…' : k.value}
            sub={k.sub}
            sparkData={k.sparkKey ? timeseries : null} sparkKey={k.sparkKey}
            trend={k.sparkKey ? <TrendBadge current={todayTs?.[k.sparkKey]} previous={yesterdayTs?.[k.sparkKey]} /> : null}
            onClick={k.clickable === false ? undefined : () => setOpenKpi(k)}
          />
        ))}
      </div>

      {/* Modal détail KPI */}
      {openKpi && (openKpi.id === 'clients'
        ? <ClientAttemptsModal kpi={openKpi} onClose={() => setOpenKpi(null)} />
        : openKpi.id === 'drivers'
        ? <DriverActivityModal kpi={openKpi} onClose={() => setOpenKpi(null)} />
        : openKpi.id === 'demPro'
        ? <DemProActivityModal kpi={openKpi} onClose={() => setOpenKpi(null)} />
        : openKpi.id === 'active'
        ? <ActiveOrdersModal kpi={openKpi} onClose={() => setOpenKpi(null)} />
        : openKpi.id === 'pending'
        ? <StuckPendingOrdersModal kpi={openKpi} onClose={() => setOpenKpi(null)} />
        : <KpiModal kpi={openKpi} onClose={() => setOpenKpi(null)} />
      )}

      {/* ── KPI Community & Service Client — consolidés ici pour SUPER, qui n'a plus
           besoin de naviguer vers des dashboards séparés pour les consulter ── */}
      {isSuper && showCommunity && (
        <>
          <div style={{ marginTop: 4, marginBottom: 10 }}>
            <h2 style={sectionTitle}>Community</h2>
          </div>
          <div style={{ marginBottom: isMobile ? 16 : 24 }}>
            <MarketingKpiRow />
          </div>
        </>
      )}

      {isSuper && showServiceClient && (
        <>
          <div style={{ marginBottom: 10 }}>
            <h2 style={sectionTitle}>Service Client</h2>
          </div>
          <div style={{ marginBottom: isMobile ? 16 : 24 }}>
            <ServiceClientKpiRow />
          </div>
        </>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: chartCols, gap: isMobile ? 10 : 16, marginBottom: isMobile ? 12 : 20 }}>

        {/* Bar chart — commandes par jour */}
        <div style={card}>
          <h2 style={cardTitle}>Commandes — 7 derniers jours</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeseries} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="orders"    name="Créées"  fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="delivered" name="Livrées" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line chart — revenus livreurs + frais DEM */}
        <div style={card}>
          <h2 style={cardTitle}>Revenus — 7 derniers jours (k F)</h2>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>● Livreurs</span>
            <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>● Frais DEM</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeseries} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [`${v}k F`, name === 'driverRevenueK' ? 'Livreurs' : 'Frais DEM']} />
              <Line type="monotone" dataKey="driverRevenueK" stroke="#f59e0b"        strokeWidth={2} dot={{ fill: '#f59e0b',        r: 3 }} />
              <Line type="monotone" dataKey="demRevenueK"    stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart — répartition statuts */}
        <div style={{ ...card, gridColumn: isTablet ? 'span 2' : 'auto' }}>
          <h2 style={cardTitle}>Répartition aujourd'hui</h2>
          {pieData.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 60, textAlign: 'center' }}>Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Live row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: livecols, gap: isMobile ? 10 : 16, marginBottom: isMobile ? 12 : 20 }}>

        {/* Courses actives */}
        <div style={card}>
          <h2 style={cardTitle}>Courses actives ({activeOrders.length})</h2>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 12 }}>Chargement…</div>
          ) : activeOrders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 12 }}>Aucune course active.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>{['ID','Type','Statut','Client','Livreur','Prix'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {activeOrders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.id.slice(0,8)}</code></td>
                    <td style={tdStyle}><Badge status={o.orderType} /></td>
                    <td style={tdStyle}><Badge status={o.status} /></td>
                    <td style={tdStyle}>{o.client?.name ?? '—'}</td>
                    <td style={tdStyle}>{o.driver?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={tdStyle}>{o.price?.toLocaleString()} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Events live */}
        <div style={card}>
          <h2 style={cardTitle}>Activité en direct</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>En attente d'événements…</div>
            ) : events.map((ev, i) => (
              <div key={i} style={{
                padding: '7px 10px',
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--primary)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{ev.label}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>
                  {ev.time}{ev.data?.orderId ? ` — ${ev.data.orderId.slice(0,8)}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Santé système ── */}
      {health && (
        <div style={{ ...card, marginBottom: isMobile ? 12 : 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Activity size={15} color="var(--primary)" />
            <h2 style={{ ...cardTitle, marginBottom: 0 }}>Santé système</h2>
            <span style={{
              marginLeft: 'auto', fontSize: 11, color: health.status === 'ok' ? '#22c55e' : '#ef4444',
              fontWeight: 700, background: health.status === 'ok' ? '#22c55e18' : '#ef444418',
              padding: '2px 10px', borderRadius: 20,
            }}>
              {health.status === 'ok' ? '● Opérationnel' : '● Dégradé'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <Wifi size={11} style={{ marginRight: 3 }} />
              {health.sockets?.connected ?? '?'} sockets
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              ↑ {Math.floor((health.uptime ?? 0) / 3600)}h{Math.floor(((health.uptime ?? 0) % 3600) / 60)}m
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10 }}>
            {[
              {
                label: 'Dispatch',
                items: [
                  { k: 'Cycles',           v: health.dispatch?.cycles        ?? 0 },
                  { k: 'Sans driver',      v: health.dispatch?.noDriverEvents ?? 0, warn: health.dispatch?.noDriverEvents > 5 },
                  { k: 'Offres expirées',  v: health.dispatch?.offersExpired  ?? 0 },
                  { k: 'Auto-annulées',    v: health.dispatch?.autoCancelled  ?? 0, warn: health.dispatch?.autoCancelled > 0 },
                ],
              },
              {
                label: 'Commandes live',
                items: [
                  { k: 'En attente',   v: health.orders?.pending   ?? 0, warn: health.orders?.pending > 10 },
                  { k: 'Acceptées',    v: health.orders?.accepted  ?? 0 },
                  { k: 'En transit',   v: health.orders?.picked_up ?? 0 },
                ],
              },
              {
                label: 'Livreurs',
                items: [
                  { k: 'Total',        v: health.drivers?.total     ?? 0 },
                  { k: 'En ligne',     v: health.drivers?.online    ?? 0 },
                  { k: 'Disponibles',  v: health.drivers?.available ?? 0 },
                ],
              },
              {
                label: 'Incidents',
                items: [
                  { k: 'Cycles job',   v: health.incident?.cycles            ?? 0 },
                  { k: 'Re-dispatch',  v: health.incident?.redispatched      ?? 0, warn: health.incident?.redispatched > 3 },
                  { k: 'Injoignables', v: health.incident?.unreachableAlerts ?? 0, warn: health.incident?.unreachableAlerts > 0 },
                ],
              },
            ].map(({ label, items }) => (
              <div key={label} style={{ background: 'rgba(0,119,182,0.04)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(0,119,182,0.10)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                {items.map(({ k, v, warn }) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: warn ? '#f97316' : 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Livreurs disponibles */}
      <div style={card}>
        <h2 style={cardTitle}>Livreurs disponibles ({availDrivers.length})</h2>
        {availDrivers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun livreur en ligne.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>{['Nom','Téléphone','Véhicule','Position GPS'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {availDrivers.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{d.name}</td>
                  <td style={tdStyle}>{d.phone}</td>
                  <td style={tdStyle}>{d.vehicleType ?? '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {d.latitude != null ? `${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
const card       = { ...glass, padding: '18px 20px' }
const cardTitle  = { fontSize: 14, fontWeight: 600, marginBottom: 14 }
const sectionTitle = { fontSize: 15, fontWeight: 700, color: 'var(--text)', paddingBottom: 8, borderBottom: '1px solid rgba(0,119,182,0.15)' }
const visibilityToggle = (active) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
  border: '1px solid rgba(0,119,182,.25)',
  background: active ? 'var(--primary)' : 'rgba(255,255,255,.5)',
  color: active ? '#fff' : 'var(--text-muted)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
})
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle    = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
