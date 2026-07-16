import { useState } from 'react'
import api from '../../../lib/api'
import Badge from '../../../components/Badge'
import { glass, glassInput } from '../../../lib/glassStyles'

const PM_OPTIONS = [
  ['CASH', 'Espèces'],
  ['WAVE', 'Wave'],
  ['ORANGE_MONEY', 'Orange Money'],
]

// Édition rapide du statut de paiement d'une course, depuis la liste des
// transactions (rôles SUPER et FINANCE — voir PATCH /admin/orders/:id/payment)
export default function PaymentStatusEditor({ order, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState('PAID')
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod ?? 'CASH')
  const [disputeNotes, setDisputeNotes] = useState(order.disputeNotes ?? '')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const body = nextStatus === 'PAID'
        ? { paymentStatus: 'PAID', paymentMethod }
        : { paymentStatus: 'DISPUTED', disputeNotes }
      await api.patch(`/admin/orders/${order.id}/payment`, body)
      setOpen(false)
      onUpdated?.()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de la mise à jour du statut.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Badge status={order.paymentStatus} />
        <button
          onClick={() => setOpen(true)}
          title="Modifier le statut de paiement"
          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 2 }}
        >
          ✎
        </button>
      </div>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => !saving && setOpen(false)}
        >
          <div style={{ ...glass, padding: '24px 26px', width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14, fontSize: 15 }}>Modifier le statut de paiement</h3>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['PAID', 'Payée'], ['DISPUTED', 'Litige']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setNextStatus(val)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: nextStatus === val ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: nextStatus === val ? 'rgba(0,119,182,0.1)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {nextStatus === 'PAID' ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Méthode de paiement</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ ...glassInput, width: '100%' }}>
                  {PM_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Motif du litige</label>
                <textarea
                  value={disputeNotes}
                  onChange={e => setDisputeNotes(e.target.value)}
                  rows={3}
                  style={{ ...glassInput, width: '100%', resize: 'vertical' }}
                  placeholder="Décrire le litige…"
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={saving || (nextStatus === 'DISPUTED' && !disputeNotes.trim())}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || (nextStatus === 'DISPUTED' && !disputeNotes.trim()) ? 0.6 : 1 }}
              >
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
