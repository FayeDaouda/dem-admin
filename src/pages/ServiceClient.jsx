import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import {
  Search, RefreshCw, Phone, User, Package, AlertTriangle, Clock,
  ChevronRight, XCircle, Eye, Ban, ShieldCheck, CreditCard,
} from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'var(--primary)', sub }) {
  return (
    <div style={{
      ...glass, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={17} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

const STATUS_COLORS = {
  PENDING: '#f59e0b', ACCEPTED: '#6366f1', PICKED_UP: '#8b5cf6',
  IN_TRANSIT: '#3b82f6', DELIVERED: '#22c55e', CANCELLED: '#ef4444', SCHEDULED: '#64748b',
}

function StatusDot({ status }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600, color: STATUS_COLORS[status] ?? 'var(--text-muted)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[status] ?? '#999' }} />
      {status}
    </span>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function ServiceClient() {
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)

  // Recherche client
  const [search, setSearch]       = useState('')
  const [clients, setClients]     = useState([])
  const [clientLoading, setClientLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientDetail, setClientDetail]     = useState(null)
  const [detailLoading, setDetailLoading]   = useState(false)

  // Commandes recentes
  const [recentOrders, setRecentOrders]     = useState([])
  const [ordersLoading, setOrdersLoading]   = useState(true)
  const [orderFilter, setOrderFilter]       = useState('all')
  const [orderDetail, setOrderDetail]       = useState(null)

  // Incidents
  const [incidents, setIncidents]   = useState([])
  const [incLoading, setIncLoading] = useState(true)

  // Paiements en attente
  const [unpaid, setUnpaid]         = useState([])
  const [unpaidLoading, setUnpaidLoading] = useState(true)

  // ── Chargement stats + donnees ──
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, oRes, iRes, pRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/orders', { params: { limit: 30 } }),
        api.get('/admin/incidents').catch(() => ({ data: [] })),
        api.get('/admin/payments/unpaid', { params: { limit: 20 } }).catch(() => ({ data: { orders: [] } })),
      ])
      setStats(sRes.data)
      setRecentOrders(oRes.data?.orders ?? [])
      setIncidents(Array.isArray(iRes.data) ? iRes.data.filter(i => i.status !== 'RESOLVED').slice(0, 15) : [])
      setUnpaid(pRes.data?.orders ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setOrdersLoading(false)
      setIncLoading(false)
      setUnpaidLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Recherche client ──
  async function searchClients(q) {
    if (!q.trim()) { setClients([]); return }
    setClientLoading(true)
    try {
      const res = await api.get('/admin/clients', { params: { search: q, limit: 10 } })
      setClients(res.data?.clients ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setClientLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => searchClients(search), 350)
    return () => clearTimeout(t)
  }, [search])

  async function openClientDetail(client) {
    setSelectedClient(client)
    setDetailLoading(true)
    try {
      const res = await api.get(`/admin/clients/${client.id}`)
      setClientDetail(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeClientDetail() {
    setSelectedClient(null)
    setClientDetail(null)
  }

  // ── Actions ──
  async function banClient(id, reason) {
    if (!confirm('Bannir ce client ?')) return
    try {
      await api.patch(`/admin/clients/${id}/ban`, { reason: reason || 'Banni par le service client' })
      openClientDetail({ id })
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  async function unbanClient(id) {
    if (!confirm('Debannir ce client ?')) return
    try {
      await api.patch(`/admin/clients/${id}/unban`)
      openClientDetail({ id })
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  // ── Filtrage commandes ──
  const filteredOrders = orderFilter === 'all'
    ? recentOrders
    : recentOrders.filter(o => o.status === orderFilter)

  return (
    <div style={pageWrap}>
      {/* ── En-tete ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Service Client</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            Assistance clients, suivi commandes et incidents
          </p>
        </div>
        <button onClick={fetchAll} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div style={pageScroll}>
        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
          <StatCard icon={Package}        label="Courses aujourd'hui"   value={loading ? '...' : stats?.orders?.deliveredToday ?? 0} color="#22c55e" />
          <StatCard icon={Clock}          label="En attente"            value={loading ? '...' : stats?.orders?.pending ?? 0} color="#f59e0b" />
          <StatCard icon={AlertTriangle}  label="Incidents ouverts"     value={loading ? '...' : incidents.length} color="#ef4444" />
          <StatCard icon={CreditCard}     label="Paiements en attente"  value={loading ? '...' : unpaid.length} color="#8b5cf6" />
          <StatCard icon={User}           label="Clients total"         value={loading ? '...' : stats?.clients?.total ?? 0} color="#06b6d4" />
        </div>

        {/* ── Recherche client ── */}
        <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Search size={16} color="var(--primary)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Rechercher un client</h2>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom ou numero de telephone..."
              style={{ ...glassInput, paddingLeft: 36, fontSize: 14 }}
            />
          </div>

          {/* Resultats recherche */}
          {search.trim() && (
            <div style={{ marginTop: 12 }}>
              {clientLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Recherche...</div>
              ) : clients.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Aucun client trouve.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {clients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => openClientDetail(c)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        background: 'var(--surface2)', transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,119,182,.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06b6d4, #0077b6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
                        }}>
                          {(c.name ?? c.phone ?? '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name ?? 'Sans nom'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.phone}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.isBanned && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#ef444418', color: '#ef4444' }}>BANNI</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {c._count?.ordersAsClient ?? ''} {c._count?.ordersAsClient === 1 ? 'course' : 'courses'}
                        </span>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Layout 2 colonnes : Commandes + Sidebar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 16 }}>

          {/* ── Commandes recentes ── */}
          <div style={{ ...glass, padding: '18px 20px', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={16} color="var(--primary)" />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Commandes recentes</h2>
              </div>
            </div>

            {/* Filtres statut */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                ['all', 'Toutes'],
                ['PENDING', 'En attente'],
                ['ACCEPTED', 'Acceptees'],
                ['PICKED_UP', 'Recuperees'],
                ['DELIVERED', 'Livrees'],
                ['CANCELLED', 'Annulees'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setOrderFilter(val)}
                  style={{
                    padding: '4px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: orderFilter === val ? 'var(--primary)' : 'transparent',
                    color: orderFilter === val ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {ordersLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: 12 }}>Chargement...</div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: 12 }}>Aucune commande.</div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['ID', 'Statut', 'Client', 'Livreur', 'Prix', 'Date'].map(h => (
                        <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => (
                      <tr
                        key={o.id}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => setOrderDetail(o)}
                      >
                        <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.id.slice(0, 8)}</code></td>
                        <td style={tdStyle}><StatusDot status={o.status} /></td>
                        <td style={tdStyle}>{o.client?.name ?? o.client?.phone ?? '—'}</td>
                        <td style={tdStyle}>{o.driver?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{o.price?.toLocaleString()} F</td>
                        <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>
                          {o.createdAt ? new Date(o.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Sidebar : Incidents + Paiements ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Incidents ouverts */}
            <div style={{ ...glass, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={15} color="#ef4444" />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Incidents ouverts</h3>
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 10,
                  background: incidents.length > 0 ? '#ef444418' : '#22c55e18',
                  color: incidents.length > 0 ? '#ef4444' : '#22c55e',
                }}>
                  {incidents.length}
                </span>
              </div>
              {incLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chargement...</div>
              ) : incidents.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Aucun incident ouvert.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {incidents.map(inc => (
                    <div key={inc.id} style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: 12,
                      background: 'var(--surface2)',
                      borderLeft: `3px solid ${inc.severity === 'HIGH' ? '#ef4444' : inc.severity === 'MEDIUM' ? '#f59e0b' : '#6366f1'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{inc.type?.replace(/_/g, ' ')}</span>
                        <Badge status={inc.severity} />
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {inc.driverName ?? 'Livreur inconnu'} {inc.orderId ? `· ${inc.orderId.slice(0, 8)}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Paiements en attente */}
            <div style={{ ...glass, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CreditCard size={15} color="#8b5cf6" />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Paiements en attente</h3>
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 10,
                  background: unpaid.length > 0 ? '#f59e0b18' : '#22c55e18',
                  color: unpaid.length > 0 ? '#f59e0b' : '#22c55e',
                }}>
                  {unpaid.length}
                </span>
              </div>
              {unpaidLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chargement...</div>
              ) : unpaid.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Tous les paiements sont a jour.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {unpaid.map(o => (
                    <div key={o.id} style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: 12,
                      background: 'var(--surface2)',
                      borderLeft: `3px solid ${o.paymentStatus === 'DISPUTED' ? '#ef4444' : '#f59e0b'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{o.price?.toLocaleString()} F</span>
                        <Badge status={o.paymentStatus} />
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {o.client?.name ?? o.client?.phone ?? '—'} → {o.driver?.name ?? '—'}
                      </div>
                      {o.disputeNotes && (
                        <div style={{ color: '#ef4444', fontSize: 11, marginTop: 3 }}>{o.disputeNotes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal detail client ── */}
      {selectedClient && (
        <div style={overlay} onClick={closeClientDetail}>
          <div style={{ ...glass, padding: '24px 28px', width: 580, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Chargement du profil...</div>
            ) : clientDetail ? (
              <>
                {/* Header client */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #06b6d4, #0077b6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 20, flexShrink: 0,
                  }}>
                    {clientDetail.avatar
                      ? <img src={clientDetail.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                      : (clientDetail.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{clientDetail.name ?? 'Sans nom'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{clientDetail.phone}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {clientDetail.isBanned ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: '#ef444418', color: '#ef4444' }}>BANNI</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: '#22c55e18', color: '#22c55e' }}>ACTIF</span>
                    )}
                  </div>
                </div>

                {/* Infos */}
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Informations</div>
                  <Row label="Email" value={clientDetail.email ?? '—'} />
                  <Row label="Inscrit le" value={clientDetail.createdAt ? new Date(clientDetail.createdAt).toLocaleDateString('fr-FR') : '—'} />
                  <Row label="Code parrainage" value={clientDetail.referralCode ?? '—'} />
                  <Row label="Total depense" value={`${(clientDetail.totalSpent ?? 0).toLocaleString()} F`} />
                  <Row label="Commandes" value={clientDetail.ordersAsClient?.length ?? 0} />
                </div>

                {/* Historique commandes */}
                {clientDetail.ordersAsClient?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                      Historique commandes ({clientDetail.ordersAsClient.length})
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            {['Statut', 'Prix', 'Paiement', 'Date'].map(h => (
                              <th key={h} style={{ ...thStyle, fontSize: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {clientDetail.ordersAsClient.map(o => (
                            <tr key={o.id} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                              <td style={{ ...tdStyle, padding: '6px 8px' }}><StatusDot status={o.status} /></td>
                              <td style={{ ...tdStyle, padding: '6px 8px', fontWeight: 600 }}>{o.price?.toLocaleString()} F</td>
                              <td style={{ ...tdStyle, padding: '6px 8px' }}><Badge status={o.paymentStatus ?? 'PENDING'} /></td>
                              <td style={{ ...tdStyle, padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
                                {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  {clientDetail.phone && (
                    <a href={`tel:${clientDetail.phone}`} style={{ ...btnAction, color: '#0077b6', borderColor: '#0077b6' }}>
                      <Phone size={13} /> Appeler
                    </a>
                  )}
                  {clientDetail.isBanned ? (
                    <button onClick={() => unbanClient(clientDetail.id)} style={{ ...btnAction, color: '#22c55e', borderColor: '#22c55e' }}>
                      <ShieldCheck size={13} /> Debannir
                    </button>
                  ) : (
                    <button onClick={() => banClient(clientDetail.id)} style={{ ...btnAction, color: '#ef4444', borderColor: '#ef4444' }}>
                      <Ban size={13} /> Bannir
                    </button>
                  )}
                  <button onClick={closeClientDetail} style={{ ...btnAction, marginLeft: 'auto', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Erreur de chargement.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal detail commande ── */}
      {orderDetail && (
        <div style={overlay} onClick={() => setOrderDetail(null)}>
          <div style={{ ...glass, padding: '24px 28px', width: 480, maxWidth: '94vw', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Detail commande</h2>
              <button onClick={() => setOrderDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <XCircle size={18} />
              </button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
              <Row label="ID" value={<code style={{ fontSize: 11 }}>{orderDetail.id}</code>} />
              <Row label="Statut" value={<StatusDot status={orderDetail.status} />} />
              <Row label="Type" value={<Badge status={orderDetail.orderType} />} />
              <Row label="Client" value={orderDetail.client?.name ?? orderDetail.client?.phone ?? '—'} />
              <Row label="Livreur" value={orderDetail.driver?.name ?? '—'} />
              <Row label="Prix" value={`${orderDetail.price?.toLocaleString()} F`} />
              <Row label="Paiement" value={<Badge status={orderDetail.paymentStatus ?? 'PENDING'} />} />
              <Row label="Depart" value={orderDetail.pickupAddress ?? '—'} />
              <Row label="Arrivee" value={orderDetail.deliveryAddress ?? '—'} />
              {orderDetail.receiverName && <Row label="Destinataire" value={orderDetail.receiverName} />}
              {orderDetail.receiverPhone && (
                <Row label="Tel. destinataire" value={
                  <a href={`tel:${orderDetail.receiverPhone}`} style={{ color: '#0077b6', fontWeight: 600 }}>{orderDetail.receiverPhone}</a>
                } />
              )}
              <Row label="Cree le" value={orderDetail.createdAt ? new Date(orderDetail.createdAt).toLocaleString('fr-FR') : '—'} />
              {orderDetail.deliveredAt && <Row label="Livre le" value={new Date(orderDetail.deliveredAt).toLocaleString('fr-FR')} />}
              {orderDetail.cancelledAt && <Row label="Annule le" value={new Date(orderDetail.cancelledAt).toLocaleString('fr-FR')} />}
            </div>

            {/* Actions rapides */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {orderDetail.client?.phone && (
                <a href={`tel:${orderDetail.client.phone}`} style={{ ...btnAction, color: '#0077b6', borderColor: '#0077b6' }}>
                  <Phone size={13} /> Client
                </a>
              )}
              {orderDetail.driver?.phone && (
                <a href={`tel:${orderDetail.driver.phone}`} style={{ ...btnAction, color: '#22c55e', borderColor: '#22c55e' }}>
                  <Phone size={13} /> Livreur
                </a>
              )}
              {orderDetail.receiverPhone && (
                <a href={`tel:${orderDetail.receiverPhone}`} style={{ ...btnAction, color: '#8b5cf6', borderColor: '#8b5cf6' }}>
                  <Phone size={13} /> Destinataire
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '8px 8px', verticalAlign: 'middle', fontSize: 13 }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnAction  = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
