import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { connectSocket, disconnectSocket } from '../lib/socket'
import api from '../lib/api'
import Badge from '../components/Badge'
import { Package, Truck, AlertTriangle, TrendingUp, Users, CreditCard, Activity, Wifi } from 'lucide-react'
import { glass } from '../lib/glassStyles'
import { useResponsive } from '../lib/useResponsive'

function StatCard({ icon: Icon, label, value, sub, color = 'var(--primary)' }) {
  return (
    <div style={{
      ...glass,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{
        width: 42, height: 42,
        borderRadius: 'var(--radius-sm)',
        background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
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

export default function Dashboard() {
  const [stats, setStats]       = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [timeseries, setTimeseries] = useState([])
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [health, setHealth]     = useState(null)

  // Santé système — poll toutes les 30s indépendamment du reste
  useEffect(() => {
    const fetchHealth = () => api.get('/health').then(r => setHealth(r.data)).catch(() => {})
    fetchHealth()
    const t = setInterval(fetchHealth, 30_000)
    return () => clearInterval(t)
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, lRes, tRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/live'),
        api.get('/admin/stats/timeseries?days=7'),
      ])
      setStats(sRes.data)
      setSnapshot(lRes.data)
      setTimeseries(tRes.data.map(d => ({
        ...d,
        dateLabel:      new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        driverRevenueK: Math.round((d.driverRevenue ?? 0) / 1000),
        demRevenueK:    Math.round((d.demRevenue    ?? 0) / 1000),
      })))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

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
  const statCols = isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(7,1fr)'
  const chartCols = isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 300px'
  const livecols  = isMobile ? '1fr' : '1fr 320px'

  return (
    <div>
      <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, marginBottom: isMobile ? 16 : 24 }}>Dashboard</h1>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: statCols, gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 24 }}>
        <StatCard icon={Package}      label="Total courses"     value={loading ? '…' : stats?.orders.total ?? 0}        color="var(--primary)" />
        <StatCard icon={TrendingUp}   label="En cours"          value={loading ? '…' : stats?.orders.active ?? 0}       color="var(--info)" />
        <StatCard icon={AlertTriangle}label="En attente"        value={loading ? '…' : stats?.orders.pending ?? 0}      color="var(--warning)" />
        <StatCard icon={Truck}        label="Livreurs dispo"     value={loading ? '…' : stats?.drivers.available ?? 0}   color="var(--success)"
                  sub={`/ ${stats?.drivers.total ?? 0} total`} />
        <StatCard icon={Users}        label="Clients"           value={loading ? '…' : stats?.clients.total ?? 0}       color="#a78bfa" />
        <StatCard icon={CreditCard}   label="Livreurs du jour"  value={loading ? '…' : `${(stats?.revenue?.driver?.today ?? 0).toLocaleString()} F`} color="var(--success)"
                  sub={`Total : ${((stats?.revenue?.driver?.total ?? 0) / 1000).toFixed(0)}k F`} />
        <StatCard icon={CreditCard}   label="Frais DEM du jour" value={loading ? '…' : `${(stats?.revenue?.dem?.today ?? 0).toLocaleString()} F`} color="var(--warning)"
                  sub={`Total : ${((stats?.revenue?.dem?.total ?? 0) / 1000).toFixed(0)}k F`} />
      </div>

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

      {/* Drivers disponibles */}
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
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle    = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
