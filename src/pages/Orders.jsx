import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw, Search } from 'lucide-react'
import { glass, glassInput } from '../lib/glassStyles'

export default function Orders() {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [detail, setDetail]     = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [paying, setPaying] = useState(false)

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

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    return !q
      || o.id.includes(q)
      || o.client?.name?.toLowerCase().includes(q)
      || o.driver?.name?.toLowerCase().includes(q)
      || o.pickupAddress?.toLowerCase().includes(q)
      || o.deliveryAddress?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Toutes les courses</h1>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par ID, client, driver, adresse…"
          style={{ ...inputStyle, paddingLeft: 36, width: '100%' }}
        />
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['ID', 'Type', 'Statut', 'Client', 'Driver', 'Prix', 'Paiement', 'Date'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr
                  key={o.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setDetail(o)}
                >
                  <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.id.slice(0,8)}</code></td>
                  <td style={tdStyle}><Badge status={o.orderType} /></td>
                  <td style={tdStyle}><Badge status={o.status} /></td>
                  <td style={tdStyle}>{o.client?.name ?? o.client?.phone ?? '—'}</td>
                  <td style={tdStyle}>{o.driver?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{o.price?.toLocaleString()} F</td>
                  <td style={tdStyle}><Badge status={o.paymentStatus ?? 'PENDING'} /></td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
              <Row label="Client"        value={detail.client?.name ?? detail.client?.phone} />
              <Row label="Driver"        value={detail.driver?.name ?? '—'} />
              <Row label="Prix"          value={`${detail.price?.toLocaleString()} F`} />
              <Row label="Départ"        value={detail.pickupAddress} />
              <Row label="Arrivée"       value={detail.deliveryAddress} />
              {detail.disputeNotes && <Row label="Note litige" value={<span style={{ color: 'var(--danger)' }}>{detail.disputeNotes}</span>} />}
              <Row label="Créée le"      value={detail.createdAt ? new Date(detail.createdAt).toLocaleString('fr-FR') : '—'} />
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8 }}>
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

const card       = { ...glass, padding: '20px 24px', overflowX: 'auto' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, padding: '28px 32px', width: 500, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }
const inputStyle = { ...glassInput, width: 'auto' }
