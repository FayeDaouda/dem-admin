import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw, Search } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

const firstNonEmpty = (...values) => values.find(v => typeof v === 'string' && v.trim() !== '') ?? '—'

// DEM Pro : on affiche le nom de l'entreprise plutôt que le nom du responsable.
const clientDisplayName = (client, clientName, clientPhone) =>
  client?.role === 'DEM_PRO' && client?.proBusinessName?.trim()
    ? client.proBusinessName
    : firstNonEmpty(client?.name, clientName, client?.phone, clientPhone)

export default function Orders() {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [detail, setDetail]     = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [cancelling, setCancelling]     = useState(false)
  const [paying, setPaying]             = useState(false)
  const [redispatching, setRedispatching] = useState(false)
  const [driverPicker, setDriverPicker]   = useState(null) // { drivers, loading, error } quand ouvert
  const [assigning, setAssigning]         = useState(false)

  const openDriverPicker = async (order) => {
    setDriverPicker({ drivers: [], loading: true, error: null })
    try {
      const res = await api.get(`/admin/orders/${order.id}/assignable-drivers`)
      setDriverPicker({ drivers: res.data?.drivers ?? [], loading: false, error: null })
    } catch (e) {
      setDriverPicker({ drivers: [], loading: false, error: e.response?.data?.message ?? 'Erreur de chargement des livreurs.' })
    }
  }

  const assignDriver = async (driverId) => {
    setAssigning(true)
    try {
      const res = await api.patch(`/admin/orders/${detail.id}/reassign`, { driverId })
      setDetail(res.data?.order ?? null)
      setDriverPicker(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'attribution du livreur')
    } finally {
      setAssigning(false)
    }
  }

  const suggestDriver = async (driverId) => {
    setAssigning(true)
    try {
      const res = await api.patch(`/admin/orders/${detail.id}/suggest`, { driverId })
      alert(res.data?.message ?? 'Course suggérée au livreur.')
      setDetail(null)
      setDriverPicker(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de la suggestion au livreur')
    } finally {
      setAssigning(false)
    }
  }

  const markPaid = async (id) => {
    if (!window.confirm('Marquer ce paiement comme reçu ?')) return
    setPaying(true)
    try {
      await api.patch(`/admin/orders/${id}/payment`, { paymentStatus: 'PAID' })
      setDetail(prev => prev ? { ...prev, paymentStatus: 'PAID' } : prev)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur')
    } finally {
      setPaying(false)
    }
  }

  const redispatch = async (id) => {
    if (!globalThis.confirm('Forcer un re-dispatch ? Le livreur actuel sera retiré et un nouveau sera recherché automatiquement.')) return
    setRedispatching(true)
    try {
      await api.patch(`/admin/orders/${id}/redispatch`)
      setDetail(prev => prev ? { ...prev, status: 'PENDING', driver: null } : prev)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors du re-dispatch')
    } finally {
      setRedispatching(false)
    }
  }

  const cancelOrder = async (id) => {
    if (!window.confirm('Annuler cette commande ?')) return
    setCancelling(true)
    try {
      await api.patch(`/admin/orders/${id}/cancel`, { reason: 'Annulé par admin' })
      setDetail(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'annulation')
    } finally {
      setCancelling(false)
    }
  }

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/orders?limit=100')
      setOrders(Array.isArray(res.data?.orders) ? res.data.orders : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const statusGroups = {
    all:        null,
    pending:    ['PENDING'],
    active:     ['ACCEPTED', 'PICKED_UP'],
    delivered:  ['DELIVERED'],
    cancelled:  ['CANCELLED'],
  }

  const filtered = orders.filter(o => {
    // Filtre par statut
    const group = statusGroups[statusFilter]
    if (group && !group.includes(o.status)) return false
    // Filtre par recherche
    const q = search.toLowerCase()
    return !q
      || o.id.includes(q)
      || o.client?.name?.toLowerCase().includes(q)
      || o.client?.proBusinessName?.toLowerCase().includes(q)
      || o.driver?.name?.toLowerCase().includes(q)
      || o.pickupAddress?.toLowerCase().includes(q)
      || o.deliveryAddress?.toLowerCase().includes(q)
  })

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Toutes les courses</h1>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360, flexShrink: 0 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par ID, client, driver, adresse…"
          style={{ ...inputStyle, paddingLeft: 36, width: '100%' }}
        />
      </div>

      {/* Filtres par statut */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {[
          { key: 'all',       label: 'Toutes' },
          { key: 'pending',   label: 'En attente' },
          { key: 'active',    label: 'En cours' },
          { key: 'delivered', label: 'Livrées' },
          { key: 'cancelled', label: 'Annulées' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              ...btnOutline,
              ...(statusFilter === f.key
                ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
                : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['#', 'ID', 'Type', 'Statut', 'Client', 'Livreur', 'Prix', 'Paiement', 'Date'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, idx) => (
                <tr
                  key={o.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setDetail(o)}
                >
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, ...stickyCol }}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.id.slice(0,8)}</code></td>
                  <td style={tdStyle}><Badge status={o.orderType} /></td>
                  <td style={tdStyle}><Badge status={o.status} /></td>
                  <td style={tdStyle}>{clientDisplayName(o.client, o.clientName, o.clientPhone)}</td>
                  <td style={tdStyle}>{firstNonEmpty(o.driver?.name, o.driver?.phone)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{o.price?.toLocaleString()} F</td>
                  <td style={tdStyle}><Badge status={o.paymentStatus ?? 'PENDING'} /></td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>

      {/* Détail modal */}
      {detail && (
        <div style={overlay} onClick={() => setDetail(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 16, fontSize: 16 }}>Détail commande</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <Row label="ID"            value={<code>{detail.id}</code>} />
              <Row label="Type"          value={<Badge status={detail.orderType} />} />
              <Row label="Statut"        value={<Badge status={detail.status} />} />
              <Row label="Paiement"      value={<Badge status={detail.paymentStatus ?? 'PENDING'} />} />
              <Row label="Client"        value={clientDisplayName(detail.client, detail.clientName, detail.clientPhone)} />
              <Row label="Tél. client"   value={firstNonEmpty(detail.client?.phone, detail.clientPhone)} />
              <Row label="Livreur"       value={firstNonEmpty(detail.driver?.name, detail.driver?.phone)} />
              <Row label="Tél. livreur"  value={firstNonEmpty(detail.driver?.phone)} />
              <Row label="Prix"          value={`${detail.price?.toLocaleString()} F`} />
              <Row label="Départ"        value={detail.pickupAddress} />
              <Row label="Tél. pickup"   value={firstNonEmpty(detail.senderPhone, detail.client?.phone, detail.clientPhone)} />
              <Row label="Arrivée"       value={detail.deliveryAddress} />
              <Row label="Destinataire"  value={firstNonEmpty(detail.receiverName, detail.receiverPhone)} />
              <Row label="Tél. destinataire" value={firstNonEmpty(detail.receiverPhone)} />
              {detail.disputeNotes && <Row label="Note litige" value={<span style={{ color: 'var(--danger)' }}>{detail.disputeNotes}</span>} />}
              <Row label="Créée le"      value={detail.createdAt ? new Date(detail.createdAt).toLocaleString('fr-FR') : '—'} />
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.status === 'PENDING' && !detail.driver && (
                  <button
                    onClick={() => openDriverPicker(detail)}
                    style={{ ...btnOutline, color: '#0077b6', borderColor: '#0077b6', background: 'rgba(0,119,182,0.08)' }}
                  >
                    🚴 Choisir un livreur
                  </button>
                )}
                {detail.status === 'ACCEPTED' && (
                  <button
                    onClick={() => redispatch(detail.id)}
                    disabled={redispatching}
                    style={{ ...btnOutline, color: '#f97316', borderColor: '#f97316', background: 'rgba(249,115,22,0.08)' }}
                  >
                    {redispatching ? 'Re-dispatch…' : '↺ Re-dispatcher'}
                  </button>
                )}
                {!['DELIVERED', 'CANCELLED'].includes(detail.status) && (
                  <button
                    onClick={() => cancelOrder(detail.id)}
                    disabled={cancelling}
                    style={{ ...btnOutline, color: '#e53e3e', borderColor: '#e53e3e', background: 'rgba(229,62,62,0.08)' }}
                  >
                    {cancelling ? 'Annulation…' : '✕ Annuler'}
                  </button>
                )}
                {detail.status === 'DELIVERED' && detail.paymentStatus === 'PENDING' && (
                  <button
                    onClick={() => markPaid(detail.id)}
                    disabled={paying}
                    style={{ ...btnOutline, color: '#38a169', borderColor: '#38a169', background: 'rgba(56,161,105,0.08)' }}
                  >
                    {paying ? 'En cours…' : '✓ Marquer payé'}
                  </button>
                )}
              </div>
              <button onClick={() => setDetail(null)} style={{ ...btnOutline, marginLeft: 'auto' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Sélecteur de livreur */}
      {driverPicker && (
        <div style={{ ...overlay, zIndex: 110 }} onClick={() => setDriverPicker(null)}>
          <div style={{ ...modalBox, width: 460 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4, fontSize: 16 }}>Choisir un livreur</h2>
            <p style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Suggérer</strong> envoie une offre que le livreur peut accepter ou refuser.{' '}
              <strong>Attribuer directement</strong> lui assigne la course sans confirmation de sa part.
            </p>
            {driverPicker.loading ? (
              <div style={{ color: 'var(--text-muted)', padding: 12 }}>Chargement des livreurs disponibles…</div>
            ) : driverPicker.error ? (
              <div style={{ color: '#e53e3e', padding: 12 }}>{driverPicker.error}</div>
            ) : driverPicker.drivers.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: 12 }}>Aucun livreur disponible pour le moment.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {driverPicker.drivers.map(d => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(0,119,182,0.2)', background: 'rgba(255,255,255,0.5)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <strong>{d.name ?? 'Sans nom'}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{d.phone}</span>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11 }}>{d.vehicleType ?? '—'}</span>
                    </span>
                    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => suggestDriver(d.id)}
                        disabled={assigning}
                        style={{ ...btnOutline, padding: '6px 10px', fontSize: 12, color: '#0077b6', borderColor: '#0077b6', background: 'rgba(0,119,182,0.08)' }}
                      >
                        Suggérer
                      </button>
                      <button
                        onClick={() => assignDriver(d.id)}
                        disabled={assigning}
                        style={{ ...btnOutline, padding: '6px 10px', fontSize: 12, color: '#38a169', borderColor: '#38a169', background: 'rgba(56,161,105,0.08)' }}
                      >
                        Attribuer directement
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDriverPicker(null)} disabled={assigning} style={btnOutline}>
                {assigning ? 'Attribution…' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 100 }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px' }
const tableStyle = { width: '100%', minWidth: 760, borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, padding: '28px 32px', width: 500, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }
const inputStyle = { ...glassInput, width: 'auto' }
