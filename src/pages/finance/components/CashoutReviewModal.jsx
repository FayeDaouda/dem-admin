import { useState } from 'react'
import api from '../../../lib/api'
import { glassModal, glassInput } from '../../../lib/glassStyles'
import { formatF, hoursSince } from '../../../lib/format'

// Clôture d'un retrait en vérification (coupure réseau pendant le virement).
// Deux issues, chacune avec sa preuve — voir samirpay.service.js
// (confirmReviewedCashout / refundReviewedCashout) :
//  - confirm : l'argent est parti → référence vue dans le tableau de bord ;
//  - refund  : il n'est pas parti → note de vérification, puis recrédit.
// Le serveur refuse l'action si le retrait n'est plus en vérification
// (collègue plus rapide, double clic) : rien n'est fait deux fois.

const OPERATORS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }
const REFERENCE_MIN = 4
const NOTE_MIN = 15

export default function CashoutReviewModal({ tx, mode, onClose, onDone }) {
  const refund = mode === 'refund'
  const amount = formatF(Math.abs(tx.amount))
  const name = tx.user?.name ?? 'ce livreur ou marchand'
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const proofOk = refund
    ? note.trim().length >= NOTE_MIN
    : reference.trim().length >= REFERENCE_MIN
  const canSubmit = proofOk && checked && !sending

  async function submit() {
    if (!canSubmit) return
    setSending(true)
    setError(null)
    try {
      const res = refund
        ? await api.post(`/admin/samirpay/manual-review/${tx.id}/refund`, { note: note.trim() })
        : await api.post(`/admin/samirpay/manual-review/${tx.id}/confirm`, {
            reference: reference.trim(),
            note: note.trim() || undefined,
          })
      onDone(res.data?.message ?? 'Retrait traité.')
    } catch (e) {
      setError(e.response?.data?.message ?? 'L\'action a échoué. Rien n\'a été modifié.')
      setSending(false)
    }
  }

  const accent = refund ? '#dc2626' : '#15803d'

  return (
    <div style={overlay} onClick={sending ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashout-review-title"
        style={{ ...glassModal, background: '#fff', width: 500, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div id="cashout-review-title" style={{ fontWeight: 700, fontSize: 16 }}>
          {refund ? 'Rembourser — l\'argent n\'est pas parti' : 'Retrait confirmé — l\'argent est parti'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 16 }}>
          {refund
            ? 'Le montant sera recrédité sur le solde total et le solde retirable, et la personne prévenue.'
            : 'Les soldes ne bougent pas : le montant avait été réservé à la demande. La personne sera prévenue.'}
        </div>

        {/* Le retrait concerné */}
        <dl style={summary}>
          <dt style={dt}>Bénéficiaire</dt><dd style={dd}>{tx.user?.name ?? '—'} · {tx.user?.phone ?? '—'}</dd>
          <dt style={dt}>Montant</dt><dd style={{ ...dd, fontWeight: 700 }}>{amount}</dd>
          <dt style={dt}>Opérateur</dt><dd style={dd}>{OPERATORS[tx.operatorName] ?? tx.operatorName ?? '—'}</dd>
          <dt style={dt}>Demandé le</dt>
          <dd style={dd}>{new Date(tx.createdAt).toLocaleString('fr-FR')} (il y a {hoursSince(tx.createdAt)} h)</dd>
          <dt style={dt}>Référence DEM</dt><dd style={{ ...dd, fontFamily: 'monospace', fontSize: 12 }}>{tx.id}</dd>
        </dl>

        {refund ? (
          <>
            <div style={warning}>
              Un remboursement à tort, c'est de l'argent payé deux fois. En cas de doute, ne remboursez pas :
              redemandez à SamirPay.
            </div>
            <label style={label} htmlFor="review-note">
              Comment avez-vous vérifié que l'argent n'est pas parti ? *
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Ex. : absent du tableau de bord SamirPay au 03/10 à 10 h, confirmé par leur support"
              style={{ ...glassInput, resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 11, color: note.trim().length >= NOTE_MIN ? '#15803d' : 'var(--text-muted)', marginTop: 4 }}>
              {note.trim().length}/{NOTE_MIN} caractères minimum
            </div>
          </>
        ) : (
          <>
            <label style={label} htmlFor="review-reference">Référence de la transaction *</label>
            <input
              id="review-reference"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Vue dans le tableau de bord SamirPay, Wave ou Orange Money"
              style={{ ...glassInput, fontSize: 13, fontFamily: 'inherit' }}
              autoComplete="off"
            />
            <label style={{ ...label, marginTop: 12 }} htmlFor="review-confirm-note">Note (facultatif)</label>
            <textarea
              id="review-confirm-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              style={{ ...glassInput, resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
            />
          </>
        )}

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ marginTop: 2, accentColor: accent, flexShrink: 0 }}
          />
          <span>
            {refund
              ? <>J'ai vérifié que ce retrait n'a pas abouti : recréditer <strong>{amount}</strong> à {name}.</>
              : <>J'ai vu ce retrait de <strong>{amount}</strong> abouti dans le tableau de bord.</>}
          </span>
        </label>

        {error && <div role="alert" style={errorBox}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={sending} style={btnCancel}>Annuler</button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{ ...btnAction, background: accent, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            {sending ? 'Envoi…' : refund ? `Rembourser ${amount}` : 'Confirmer le retrait'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay   = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const summary   = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: 'rgba(0,0,0,.03)', fontSize: 13 }
const dt        = { color: 'var(--text-muted)' }
const dd        = { margin: 0, wordBreak: 'break-all' }
const label     = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }
const warning   = { padding: '10px 12px', borderRadius: 10, background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.25)', color: '#b91c1c', fontSize: 12, marginBottom: 14, lineHeight: 1.45 }
const errorBox  = { marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(220,38,38,.08)', color: '#b91c1c', fontSize: 13 }
const btnCancel = { padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', background: 'rgba(255,255,255,.6)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const btnAction = { padding: '8px 18px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }
