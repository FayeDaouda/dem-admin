import { useState, useEffect, useCallback, useRef } from 'react'
import { Send, Gift, CheckCircle2, ImageIcon } from 'lucide-react'
import api from '../lib/api'
import { glassInput } from '../lib/glassStyles'
import InlineConfirm from './InlineConfirm'

// ── Réclamation client (serveur : claims.service.js) ─────────────────────────
// Fil d'échanges visible par le client, réponse de l'équipe, passage en
// « traitée », geste commercial (avoir non retirable sur le wallet du
// client, une seule fois, au plus le montant payé). Les notes internes de
// l'incident restent dans la section « Suivi », jamais vues par le client.

const CLIENT_STEP = {
  RECEIVED:  { label: 'Reçue',    color: '#ef4444' },
  IN_REVIEW: { label: 'En cours', color: '#f59e0b' },
  RESOLVED:  { label: 'Traitée',  color: '#22c55e' },
}

const fcfa = n => `${Math.round(n).toLocaleString('fr-FR')} F`
const when = d => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function ClaimThread({ incidentId, canReply, canRefund, onChanged }) {
  const [thread, setThread]   = useState(null)
  const [error, setError]     = useState('')
  const [message, setMessage] = useState('')
  const [resolve, setResolve] = useState(false)
  const [refundOn, setRefundOn] = useState(false)
  // Réclamation fondée, faute du coursier : retire des points de la semaine
  const [driverFault, setDriverFault] = useState(false)
  const [refund, setRefund]   = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/incidents/${incidentId}/thread`)
      setThread(data)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message ?? 'Le fil de la réclamation n’a pas pu être chargé.')
    }
  }, [incidentId])

  useEffect(() => { load() }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [thread?.messages?.length])

  if (error && !thread) return <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>
  if (!thread) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement du fil…</div>

  const step = CLIENT_STEP[thread.status] ?? CLIENT_STEP.RECEIVED
  // Réclamation d'un client ou signalement d'un coursier (même fil)
  const byDriver = thread.reporter === 'DRIVER'
  const who = byDriver ? 'coursier' : 'client'
  const Who = byDriver ? 'Coursier' : 'Client'
  const kind = byDriver ? 'le signalement' : 'la réclamation'
  const closed = thread.status === 'RESOLVED'
  const cap = thread.refundCap ?? 0
  const refundValue = refundOn ? Number(refund) : 0
  const refundInvalid = refundOn && (!Number.isInteger(refundValue) || refundValue < 1 || refundValue > cap)
  const canSend = message.trim().length > 0 && !refundInvalid && !sending

  const summary = [
    resolve ? `Envoyer la réponse et marquer ${kind} comme traité${byDriver ? '' : 'e'} ?` : `Envoyer la réponse au ${who} ?`,
    refundOn && `Geste commercial : ${fcfa(refundValue)} crédités sur son wallet (avoir pour ses prochaines courses, non retirable). Une seule fois par réclamation.`,
    resolve && driverFault && 'Faute du coursier : des points sont retirés de sa semaine.',
    `Le ${who} reçoit une notification avec votre message.`,
  ].filter(Boolean)

  async function send() {
    setSending(true); setError('')
    try {
      const { data } = await api.post(`/admin/incidents/${incidentId}/reply`, {
        message: message.trim(),
        ...(resolve ? { status: 'RESOLVED' } : {}),
        ...(refundOn ? { refundAmount: refundValue } : {}),
        ...(resolve && !byDriver ? { driverFault } : {}),
      })
      setThread(data)
      setMessage(''); setResolve(false); setRefundOn(false); setRefund(''); setDriverFault(false); setConfirming(false)
      onChanged?.()
    } catch (e) {
      setError(e.response?.data?.message ?? 'La réponse n’a pas pu être envoyée. Réessayez.')
      setConfirming(false)
    } finally { setSending(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── Résumé ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
        <span style={{ fontWeight: 700 }}>{thread.reference}</span>
        <span style={{ color: 'var(--text-muted)' }}>· {thread.categoryLabel}</span>
        {thread.loyaltyTier && (
          <span title="Support prioritaire (fidélité)" style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#b45309', background: '#f59e0b20' }}>
            Client fidèle · {thread.loyaltyTier}
          </span>
        )}
        <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: step.color, background: `${step.color}20` }}>
          Côté {who} : {step.label}
        </span>
      </div>
      {thread.order && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {thread.order.pickupAddress} → {thread.order.deliveryAddress}
          {thread.order.receiverName ? ` (pour ${thread.order.receiverName})` : ''}
          <br />
          {thread.order.status === 'DELIVERED' ? 'Livrée' : 'Annulée'}
          {thread.order.finishedAt ? ` le ${when(thread.order.finishedAt)}` : ''}
          {' · '}payé par le client : <strong style={{ color: 'var(--text)' }}>{fcfa(thread.order.amountPaid)}</strong>
        </div>
      )}
      {thread.driverFault && (
        <div style={{ fontSize: 12.5, color: '#b45309', fontWeight: 600 }}>Faute du coursier retenue : points retirés de sa semaine.</div>
      )}
      {thread.refundAmount != null && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>
          <Gift size={14} /> Geste commercial de {fcfa(thread.refundAmount)} crédité le {when(thread.refundedAt)}
        </div>
      )}

      {/* ── Fil ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', padding: '4px 2px' }}>
        {thread.messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.fromClient ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
            <div style={{
              padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              background: m.fromClient ? 'var(--surface2, #f1f5f9)' : 'rgba(0,180,216,0.12)',
              borderTopLeftRadius: m.fromClient ? 4 : 12, borderTopRightRadius: m.fromClient ? 12 : 4,
            }}>
              {m.body}
              {m.photoUrls?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {m.photoUrls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" title={`Photo ${i + 1} en grand`}>
                      <img src={url} alt={`Photo ${i + 1} du client`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, textAlign: m.fromClient ? 'left' : 'right' }}>
              {m.fromClient ? Who : 'Équipe DEM'} · {when(m.createdAt)}
              {m.photoUrls?.length > 0 && <> · <ImageIcon size={10} style={{ verticalAlign: -1 }} /> {m.photoUrls.length}</>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* ── Réponse ── */}
      {canReply && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {closed && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Réclamation traitée : le client ne peut plus écrire. Vous pouvez encore lui répondre, elle reste traitée. Pour la rouvrir, passez-la en « En cours » dans Suivi.
            </div>
          )}
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={1000}
            aria-label={`Réponse au ${who}`}
            placeholder={`Réponse au ${who} : visible dans son application et envoyée en notification.`}
            style={{ ...glassInput, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', fontSize: 12.5 }}>
            {!closed && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={resolve} onChange={e => setResolve(e.target.checked)} />
                <CheckCircle2 size={14} color="#22c55e" /> Marquer comme traitée
              </label>
            )}
            {resolve && !byDriver && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }} title="Réclamation fondée et le coursier est fautif : des points sont retirés de sa semaine">
                <input type="checkbox" checked={driverFault} onChange={e => setDriverFault(e.target.checked)} />
                Faute du coursier
              </label>
            )}
            {canRefund && !thread.refundAmount && cap > 0 && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={refundOn} onChange={e => { setRefundOn(e.target.checked); if (e.target.checked && !refund) setRefund(String(cap)) }} />
                <Gift size={14} color="var(--primary)" /> Geste commercial
              </label>
            )}
            {refundOn && (
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" min={1} max={cap} step={1} value={refund} onChange={e => setRefund(e.target.value)}
                  aria-label="Montant du geste commercial en francs CFA"
                  style={{ ...glassInput, width: 110, padding: '5px 8px' }} />
                <span style={{ color: refundInvalid ? '#dc2626' : 'var(--text-muted)' }}>F, au plus {fcfa(cap)}</span>
              </span>
            )}
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
          {confirming ? (
            <InlineConfirm lines={summary} confirmLabel="Envoyer" busy={sending} onConfirm={send} onCancel={() => setConfirming(false)} />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirming(true)} disabled={!canSend} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'linear-gradient(135deg,#00b4d8,#0077b6)', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5,
              }}>
                <Send size={14} /> Répondre au {who}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
