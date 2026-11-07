import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { glassInput } from '../../lib/glassStyles'
import RequestModal from '../../components/RequestModal'

// Demandes du Responsable de flottes sur une course (niveau 2) :
//  - mode 'cancel' : annuler une course en cours (motif d'annulation choisi
//    dans la liste du serveur, comme une annulation directe) ;
//  - mode 'geste'  : course offerte, remise ou remboursement du client.
const GESTES = [
  { kind: 'GESTE_FREE_RIDE', label: 'Course offerte',  hint: 'Une course gratuite créditée au client.' },
  { kind: 'GESTE_DISCOUNT',  label: 'Remise',          hint: 'Pourcentage de remise sur sa prochaine course.' },
  { kind: 'ORDER_REFUND',    label: 'Remboursement',   hint: 'Remboursement de cette course, fait par le Super Admin.' },
]

export default function OrderRequestModal({ mode, order, onClose, onDone }) {
  const [reasons, setReasons] = useState(null)
  const [reasonCode, setReasonCode] = useState('')
  const [geste, setGeste] = useState(GESTES[0].kind)
  const [percent, setPercent] = useState('20')
  const [amount, setAmount] = useState(String(order.totalPrice ?? order.price ?? ''))

  useEffect(() => {
    if (mode !== 'cancel') return
    api.get('/admin/orders/cancel-reasons')
      .then(res => setReasons(res.data?.reasons ?? []))
      .catch(() => setReasons([]))
  }, [mode])

  const clientId = order.client?.id ?? order.clientId
  const ref = order.id.slice(0, 8).toUpperCase()

  if (mode === 'cancel') {
    const reason = reasons?.find(r => r.code === reasonCode)
    return (
      <RequestModal
        kind="ORDER_CANCEL"
        title={`Demander l'annulation de la course ${ref}`}
        intro="Une course en cours ou livrée ne s'annule qu'avec l'accord du Super Admin."
        payload={{ orderId: order.id, reasonCode, reasonLabel: reason?.label }}
        ready={!!reasonCode}
        onClose={onClose}
        onDone={onDone}
      >
        <label style={labelStyle}>Motif d'annulation envoyé au client *</label>
        <select value={reasonCode} onChange={e => setReasonCode(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          <option value="">{reasons === null ? 'Chargement…' : 'Choisir…'}</option>
          {(reasons ?? []).map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </RequestModal>
    )
  }

  const payload = geste === 'GESTE_DISCOUNT' ? { orderId: order.id, discountPercent: Number(percent) }
    : geste === 'ORDER_REFUND' ? { orderId: order.id, amount: Number(amount) }
    : { orderId: order.id }
  const ready = geste === 'GESTE_DISCOUNT' ? Number(percent) > 0 && Number(percent) <= 100
    : geste === 'ORDER_REFUND' ? Number(amount) > 0
    : true

  return (
    <RequestModal
      kind={geste}
      title={`Geste commercial — course ${ref}`}
      intro={`Pour ${order.client?.name ?? order.clientName ?? 'le client'}, après un incident.`}
      targetUserId={geste === 'ORDER_REFUND' ? undefined : clientId}
      payload={payload}
      ready={ready}
      onClose={onClose}
      onDone={onDone}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {GESTES.map(g => (
          <label key={g.kind} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
            <input type="radio" checked={geste === g.kind} onChange={() => setGeste(g.kind)} style={{ marginTop: 3 }} />
            <span><strong>{g.label}</strong><span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{g.hint}</span></span>
          </label>
        ))}
      </div>
      {geste === 'GESTE_DISCOUNT' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Remise (%) *</label>
          <input type="number" min={1} max={100} value={percent} onChange={e => setPercent(e.target.value)} style={{ ...inputStyle, width: 100 }} />
        </div>
      )}
      {geste === 'ORDER_REFUND' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Montant à rembourser (F) *</label>
          <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, width: 140 }} />
        </div>
      )}
    </RequestModal>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const inputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }
