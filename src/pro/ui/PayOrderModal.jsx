import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2 } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { fcfa } from '../lib/format'
import { Button, Modal, Spinner } from './ui'
import { useNotify } from './notifyContext'

// Paiement en ligne d'une livraison réglée par la boutique — même parcours
// que l'app (dem_pro_order_tracking_screen.dart:_payOnline) :
// 1. choix de l'opérateur (Wave ou Orange Money) ;
// 2. POST /orders/:id/pay → page de paiement de l'opérateur, ouverte dans un
//    nouvel onglet, et QR code pour payer depuis le téléphone ;
// 3. confirmation en direct (socket order:payment_confirmed), sans rien à
//    cliquer.
const OPERATORS = [['WAVE', 'Wave'], ['ORANGE_MONEY', 'Orange Money']]

export default function PayOrderModal({ order, open, onClose, onPaid }) {
  const notify = useNotify()
  const [operator, setOperator] = useState(null)
  const [payment, setPayment] = useState(null)
  const [qr, setQr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [paid, setPaid] = useState(false)
  const starting = useRef(false)

  useEffect(() => {
    if (!open) { setOperator(null); setPayment(null); setQr(null); setPaid(false) }
  }, [open])

  // Confirmation : événement temps réel de cette livraison
  useEffect(() => {
    if (!open || !order?.id) return
    const onRefresh = (e) => {
      const { ev, p } = e.detail ?? {}
      if (ev === 'order:payment_confirmed' && p?.orderId === order.id) { setPaid(true); onPaid?.() }
    }
    window.addEventListener('dem-pro:refresh', onRefresh)
    return () => window.removeEventListener('dem-pro:refresh', onRefresh)
  }, [open, order?.id, onPaid])

  useEffect(() => {
    const url = payment?.paymentUrl
    if (!url) return
    let alive = true
    QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#021520', light: '#ffffff' } })
      .then(d => { if (alive) setQr(d) }).catch(() => {})
    return () => { alive = false }
  }, [payment])

  const start = async (op) => {
    if (starting.current) return
    starting.current = true
    setOperator(op); setBusy(true)
    try {
      const res = await proApi.post(`/orders/${order.id}/pay`, { operatorName: op })
      setPayment(res.data ?? {})
      if (res.data?.paymentUrl) window.open(res.data.paymentUrl, '_blank', 'noopener')
    } catch (e) {
      setOperator(null)
      notify.error('Paiement impossible', errMsg(e))
    } finally { setBusy(false); starting.current = false }
  }

  const amount = order ? (Number(order.price) || 0) + (Number(order.demFee) || 0) - (Number(order.discountAmount) || 0) : 0
  return (
    <Modal open={open} onClose={onClose} title="Payer la livraison" subtitle={`${fcfa(amount)} · réglé par votre boutique`} width={460}
      footer={<Button variant="ghost" onClick={onClose}>{paid ? 'Fermer' : 'Plus tard'}</Button>}>
      {paid ? (
        <div role="status" style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: '12px 0', textAlign: 'center' }}>
          <CheckCircle2 size={36} color="var(--p-success)" aria-hidden />
          <strong style={{ fontSize: 17 }}>Paiement confirmé</strong>
          <span className="muted">La livraison est réglée.</span>
        </div>
      ) : !payment ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <span className="muted" style={{ fontSize: 14 }}>Payer avec</span>
          {OPERATORS.map(([k, label]) => (
            <Button key={k} variant="ghost" loading={busy && operator === k} disabled={busy} onClick={() => start(k)} style={{ justifyContent: 'flex-start' }}>
              {label}
            </Button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5 }}>
            Terminez le paiement sur la page {operator === 'WAVE' ? 'Wave' : 'Orange Money'} qui vient de s'ouvrir, ou scannez ce code avec votre téléphone.
          </p>
          {qr ? <img src={qr} alt="QR code de paiement" width={180} height={180} style={{ border: '1px solid var(--p-line)' }} /> : null}
          {payment.paymentUrl && (
            <Button variant="ghost" size="sm" href={payment.paymentUrl} target="_blank" rel="noopener noreferrer" arrow="ne">Rouvrir la page de paiement</Button>
          )}
          <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <Spinner size={14} /> En attente de la confirmation de l'opérateur…
          </span>
        </div>
      )}
    </Modal>
  )
}
