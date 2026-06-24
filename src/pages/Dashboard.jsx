import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { connectSocket, disconnectSocket } from '../lib/socket'
import api from '../lib/api'
import Badge from '../components/Badge'
import { Package, Truck, AlertTriangle, TrendingUp, Users, CreditCard, Activity, Wifi, UserPlus, Trash2, Power, XCircle } from 'lucide-react'
import { glass, glassInput } from '../lib/glassStyles'
import { useResponsive } from '../lib/useResponsive'
import { useAuth } from '../contexts/AuthContext'

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

const ROLE_COLORS = {
  SUPER: '#f59e0b', DEV: '#6366f1', FINANCE: '#22c55e', MARKETING: '#ec4899', SERVICE_CLIENT: '#06b6d4',
}
const ROLE_LABELS_MAP = {
  SUPER: 'Super Admin', DEV: 'Dev', FINANCE: 'Finance', MARKETING: 'Marketing', SERVICE_CLIENT: 'Service Client',
}

export default function Dashboard() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = !currentUser?.adminRole || currentUser.adminRole === 'SUPER'

  const [stats, setStats]       = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [timeseries, setTimeseries] = useState([])
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [health, setHealth]     = useState(null)

  // Gestion comptes admin (SUPER only)
  const [admins, setAdmins]           = useState([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm]   = useState({ name: '', email: '', phone: '', password: '', adminRole: 'SERVICE_CLIENT' })
  const [createError, setCreateError] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [editForm, setEditForm]       = useState({ name: '', email: '', phone: '', adminRole: '', resetPassword: '' })
  const [editError, setEditError]     = useState('')
  const [editSaving, setEditSaving]   = useState(false)

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

  // ── Gestion admins (SUPER) ──
  const fetchAdmins = useCallback(async () => {
    if (!isSuperAdmin) return
    setAdminsLoading(true)
    try {
      const res = await api.get('/admin/admins')
      setAdmins(res.data?.admins ?? [])
    } catch (e) { console.error(e) }
    finally { setAdminsLoading(false) }
  }, [isSuperAdmin])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  async function handleCreateAdmin(e) {
    e.preventDefault()
    setCreateError('')
    setCreateSaving(true)
    try {
      const payload = { ...createForm }
      if (!payload.email) delete payload.email
      if (!payload.phone) delete payload.phone
      await api.post('/admin/auth/create', payload)
      setShowCreateForm(false)
      setCreateForm({ name: '', email: '', phone: '', password: '', adminRole: 'SERVICE_CLIENT' })
      fetchAdmins()
    } catch (e) {
      setCreateError(e.response?.data?.message ?? 'Erreur.')
    } finally { setCreateSaving(false) }
  }

  function openEditAdmin(admin) {
    setEditTarget(admin)
    setEditForm({ name: admin.name ?? '', email: admin.email ?? '', phone: admin.phone ?? '', adminRole: admin.adminRole ?? 'SUPER', resetPassword: '' })
    setEditError('')
  }

  async function handleUpdateAdmin(e) {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      const payload = { ...editForm }
      if (!payload.resetPassword) delete payload.resetPassword
      await api.patch(`/admin/admins/${editTarget.id}`, payload)
      setEditTarget(null)
      fetchAdmins()
    } catch (e) {
      setEditError(e.response?.data?.message ?? 'Erreur.')
    } finally { setEditSaving(false) }
  }

  async function handleDeleteAdmin(admin) {
    if (!confirm(`Supprimer definitivement le compte de ${admin.name ?? admin.email ?? admin.phone} ?`)) return
    try {
      await api.delete(`/admin/admins/${admin.id}`)
      fetchAdmins()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  async function handleToggleAdmin(admin) {
    try {
      await api.patch(`/admin/admins/${admin.id}/toggle`)
      fetchAdmins()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

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

      {/* ── Gestion comptes admin (SUPER uniquement) ── */}
      {isSuperAdmin && (
        <div style={{ ...card, marginTop: isMobile ? 12 : 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ ...cardTitle, marginBottom: 0 }}>Comptes administrateurs</h2>
            <button
              onClick={() => setShowCreateForm(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: showCreateForm ? 'var(--surface2)' : 'var(--primary)',
                color: showCreateForm ? 'var(--text-muted)' : '#fff',
                fontSize: 12, fontWeight: 600,
              }}
            >
              {showCreateForm ? <XCircle size={13} /> : <UserPlus size={13} />}
              {showCreateForm ? 'Annuler' : 'Nouveau compte'}
            </button>
          </div>

          {/* Formulaire creation */}
          {showCreateForm && (
            <form onSubmit={handleCreateAdmin} style={{
              background: 'var(--surface2)', borderRadius: 12, padding: '18px 20px', marginBottom: 16,
              display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12,
            }}>
              <div>
                <label style={adminLabelStyle}>Nom *</label>
                <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Awa Diallo" required style={adminInputStyle} />
              </div>
              <div>
                <label style={adminLabelStyle}>Role *</label>
                <select value={createForm.adminRole} onChange={e => setCreateForm(f => ({ ...f, adminRole: e.target.value }))} style={adminInputStyle}>
                  {Object.entries(ROLE_LABELS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={adminLabelStyle}>Telephone</label>
                <input type="tel" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+221 7X XXX XX XX" style={adminInputStyle} />
              </div>
              <div>
                <label style={adminLabelStyle}>Email</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="nom@dem.sn" style={adminInputStyle} />
              </div>
              <div>
                <label style={adminLabelStyle}>Mot de passe par defaut *</label>
                <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="dem12345" required minLength={8} style={adminInputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button type="submit" disabled={createSaving} style={{
                  flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                  background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  {createSaving ? 'Creation...' : 'Creer le compte'}
                </button>
              </div>
              {createError && (
                <div style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: 12, background: '#ef444410', padding: '8px 12px', borderRadius: 6 }}>
                  {createError}
                </div>
              )}
            </form>
          )}

          {/* Liste des admins */}
          {adminsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Nom', 'Contact', 'Role', 'Statut', 'Cree le', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map(a => {
                  const isMe = a.id === currentUser?.id
                  const roleColor = ROLE_COLORS[a.adminRole] ?? '#888'
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', opacity: a.isActive ? 1 : 0.5 }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{a.name ?? '—'}</div>
                        {isMe && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>VOUS</span>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 12 }}>{a.email ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.phone ?? ''}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                          background: roleColor + '18', color: roleColor,
                        }}>
                          {ROLE_LABELS_MAP[a.adminRole] ?? a.adminRole}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: a.isActive ? '#22c55e' : '#ef4444',
                        }}>
                          {a.isActive ? 'Actif' : 'Desactive'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={tdStyle}>
                        {!isMe && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openEditAdmin(a)}
                              title="Modifier"
                              style={adminActionBtn('#0077b6')}
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleToggleAdmin(a)}
                              title={a.isActive ? 'Desactiver' : 'Activer'}
                              style={adminActionBtn(a.isActive ? '#f59e0b' : '#22c55e')}
                            >
                              <Power size={12} /> {a.isActive ? 'Desactiver' : 'Activer'}
                            </button>
                            <button
                              onClick={() => handleDeleteAdmin(a)}
                              title="Supprimer"
                              style={adminActionBtn('#ef4444')}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal modifier admin ── */}
      {editTarget && (
        <div style={adminOverlay} onClick={() => setEditTarget(null)}>
          <div style={{ ...glass, padding: '28px 32px', width: 440, maxWidth: '94vw', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Modifier le compte</h2>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={adminLabelStyle}>Nom</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={adminInputStyle} />
              </div>
              <div>
                <label style={adminLabelStyle}>Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={adminInputStyle} />
              </div>
              <div>
                <label style={adminLabelStyle}>Telephone</label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} style={adminInputStyle} />
              </div>
              <div>
                <label style={adminLabelStyle}>Role</label>
                <select value={editForm.adminRole} onChange={e => setEditForm(f => ({ ...f, adminRole: e.target.value }))} style={adminInputStyle}>
                  {Object.entries(ROLE_LABELS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <label style={adminLabelStyle}>Reinitialiser le mot de passe (optionnel)</label>
                <input type="text" value={editForm.resetPassword} onChange={e => setEditForm(f => ({ ...f, resetPassword: e.target.value }))} placeholder="Laisser vide pour ne pas changer" style={adminInputStyle} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  L'utilisateur devra changer ce mot de passe a sa prochaine connexion.
                </div>
              </div>
              {editError && <div style={{ color: '#ef4444', fontSize: 12, background: '#ef444410', padding: '8px 12px', borderRadius: 6 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setEditTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={editSaving} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {editSaving ? 'Mise a jour...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const card       = { ...glass, padding: '18px 20px' }
const cardTitle  = { fontSize: 14, fontWeight: 600, marginBottom: 14 }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle    = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
const adminLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const adminInputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13 }
const adminActionBtn = (color) => ({ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}`, background: 'transparent', color })
const adminOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
