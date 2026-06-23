import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw } from 'lucide-react'
import { glass, glassModal, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'

const PAYMENT_METHODS = ['CASH', 'WAVE', 'ORANGE_MONEY']
const PM_LABELS = { CASH: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }

export default function Payments() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('PENDING') // PENDING | DISPUTED | all
  const [period, setPeriod]   = useState('all')      // all | today | week | month
  const [modal, setModal]     = useState(null) // { order }
  const [form, setForm]       = useState({ paymentStatus: 'PAID', paymentMethod: 'CASH', disputeNotes: '' })
  const [saving, setSaving]   = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter !== 'all') params.paymentStatus = filter
      if (period !== 'all') params.period = period
      const res = await api.get('/admin/payments/unpaid', { params })
      setOrders(res.data?.orders ?? res.data ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filter, period])

  useEffect(() => { fetch() }, [fetch])

  function openModal(order) {
    setModal({ order })
    setForm({ paymentStatus: 'PAID', paymentMethod: 'CASH', disputeNotes: '' })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch(`/admin/orders/${modal.order.id}/payment`, form)
      setModal(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  const disputed = orders.filter(o => o.paymentStatus === 'DISPUTED')

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Paiements</h1>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Litiges en cours */}
      {disputed.length > 0 && (
        <div style={{
          background: '#ef444415',
          border: '1px solid #ef444440',
          borderRadius: 'var(--radius)',
          padding: '14px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--danger)',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          ⚠ {disputed.length} litige{disputed.length > 1 ? 's' : ''} en attente de résolution
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        {[['PENDING', 'En attente'], ['DISPUTED', 'Litiges'], ['all', 'Tout']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: filter === val ? 'var(--primary)' : 'transparent',
              color: filter === val ? '#fff' : 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtres période */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexShrink: 0, flexWrap: 'wrap' }}>
        {[['all', 'Toutes les dates'], ['today', "Aujourd'hui"], ['week', '7 derniers jours'], ['month', '30 derniers jours']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriod(val)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: period === val ? '#f59e0b' : 'transparent',
              color: period === val ? '#fff' : 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : orders.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun paiement à traiter.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['ID', 'Type', 'Client', 'Livreur', 'Prix', 'Statut paiement', 'Note litige', 'Action'].map(h => (
                  <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.id.slice(0,8)}</code></td>
                  <td style={tdStyle}><Badge status={o.orderType} /></td>
                  <td style={tdStyle}>{o.client?.name ?? o.client?.phone ?? '—'}</td>
                  <td style={tdStyle}>{o.driver?.name ?? '—'}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{o.price?.toLocaleString()} F</td>
                  <td style={tdStyle}><Badge status={o.paymentStatus} /></td>
                  <td style={tdStyle}>
                    {o.disputeNotes
                      ? <span style={{ color: 'var(--danger)', fontSize: 12 }}>{o.disputeNotes}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => openModal(o)} style={btnPrimary}>
                      Résoudre
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>

      {/* Modal résolution */}
      {modal && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20, fontSize: 16 }}>Résoudre le paiement</h2>

            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              Commande <code>{modal.order.id.slice(0,8)}</code> — {modal.order.price?.toLocaleString()} F
            </div>

            <div style={field}>
              <label style={labelStyle}>Statut</label>
              <select
                value={form.paymentStatus}
                onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}
                style={inputStyle}
              >
                <option value="PAID">Payée</option>
                <option value="DISPUTED">Litige</option>
              </select>
            </div>

            {form.paymentStatus === 'PAID' && (
              <div style={field}>
                <label style={labelStyle}>Mode de paiement</label>
                <select
                  value={form.paymentMethod}
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  style={inputStyle}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{PM_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            )}

            {form.paymentStatus === 'DISPUTED' && (
              <div style={field}>
                <label style={labelStyle}>Note (obligatoire)</label>
                <textarea
                  value={form.disputeNotes}
                  onChange={e => setForm(f => ({ ...f, disputeNotes: e.target.value }))}
                  placeholder="Décrivez le problème…"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={btnOutline}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnPrimary = { padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glassModal }
const field      = { marginBottom: 14 }
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }
const inputStyle = { ...glassInput }
