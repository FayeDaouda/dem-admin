import { useEffect, useState } from 'react'
import api from '../lib/api'
import { glassModal, glassInput } from '../lib/glassStyles'
import { formatF } from '../lib/format'

// Retrait fait par le SUPER admin pour un livreur, un DEM Pro ou un client
// (POST /admin/users/:id/cashout). L'argent part TOUJOURS sur le numéro du
// compte : aucun autre numéro ne peut être saisi ici, et le serveur n'en
// accepte pas. Débité du solde retirable comme un retrait normal, motif
// obligatoire, journalisé. `issue` = retrait échoué que l'on renvoie (il est
// alors classé dans « Problèmes de retrait »).

const OPERATORS = [['ORANGE_MONEY', 'Orange Money'], ['WAVE', 'Wave']]
const ROLE_LABELS = { DRIVER: 'Livreur', DEM_PRO: 'DEM Pro', CLIENT: 'Client' }
const NOTE_MIN = 10

const formatPhone = (p) => (p && p.length === 9 ? `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 7)} ${p.slice(7)}` : p ?? '—')

export default function AdminCashoutModal({ userId, issue = null, onClose, onDone }) {
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [operator, setOperator] = useState(issue?.operatorName ?? '')
  const [amount, setAmount] = useState(issue ? String(Math.abs(issue.amount)) : '')
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let alive = true
    api.get(`/admin/users/${userId}/cashout-info`)
      .then(r => { if (alive) setInfo(r.data) })
      .catch(e => { if (alive) setLoadError(e.response?.data?.message ?? 'Impossible de charger le wallet de ce compte.') })
    return () => { alive = false }
  }, [userId])

  const n = Number(amount)
  const amountOk = info && Number.isInteger(n) && n >= info.minAmount && n <= info.maxAmount && n <= info.withdrawable
  const blocked = info && (!info.destinationValid || !info.nameValid || info.securityHoldUntil)
  const canSubmit = Boolean(info && !blocked && operator && amountOk && note.trim().length >= NOTE_MIN && checked && !sending)
  const operatorLabel = OPERATORS.find(([v]) => v === operator)?.[1] ?? ''

  async function submit() {
    if (!canSubmit) return
    setSending(true)
    setError(null)
    try {
      const res = await api.post(`/admin/users/${userId}/cashout`, {
        amount: n, operatorName: operator, note: note.trim(), issueId: issue?.id,
      })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Le retrait n\'a pas pu être envoyé. Rien n\'a été débité.')
      setSending(false)
    }
  }

  // ── Résultat ────────────────────────────────────────────────────────────
  if (result) {
    const review = result.review
    const pending = result.pending
    return (
      <div style={overlay}>
        <div role="dialog" aria-modal="true" style={{ ...glassModal, background: 'var(--surface, #fff)', width: 460, maxWidth: '92vw' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: review ? '#b45309' : '#15803d' }}>
            {review ? 'Retrait en vérification' : pending ? 'Retrait envoyé — en cours chez l\'opérateur' : 'Retrait envoyé'}
          </div>
          <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            {review
              ? 'SamirPay n\'a pas répondu : impossible de savoir si l\'argent est parti. Le montant reste réservé ; le retrait apparaît dans « Retraits en vérification manuelle ». Ne le renvoyez pas avant de l\'avoir vérifié.'
              : <>{formatF(n)} envoyés sur le {operatorLabel} du <strong>{formatPhone(result.destinationPhone)}</strong>. {pending ? 'DEM suit le virement jusqu\'au bout et recrédite le compte si l\'opérateur le refuse.' : ''} La personne a été prévenue.</>}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" onClick={() => onDone?.(result)} style={{ ...btnAction, background: 'var(--primary)' }}>Fermer</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={sending ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-cashout-title"
        style={{ ...glassModal, background: 'var(--surface, #fff)', width: 520, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div id="admin-cashout-title" style={{ fontWeight: 700, fontSize: 16 }}>
          {issue ? 'Renvoyer le retrait' : 'Faire un retrait pour ce compte'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 16 }}>
          De l'argent réel part tout de suite. Il est débité de son solde retirable, toujours vers le numéro du compte.
        </div>

        {!info && !loadError && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement du wallet…</div>}
        {loadError && <div role="alert" style={errorBox}>{loadError}</div>}

        {info && (
          <>
            <dl style={summary}>
              <dt style={dt}>Compte</dt>
              <dd style={dd}>{info.user.name || '—'} · {ROLE_LABELS[info.user.role] ?? info.user.role}</dd>
              <dt style={dt}>Envoyé sur</dt>
              <dd style={{ ...dd, fontWeight: 700 }}>{formatPhone(info.destinationPhone)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(numéro du compte, non modifiable)</span></dd>
              <dt style={dt}>Solde retirable</dt>
              <dd style={{ ...dd, fontWeight: 700 }}>{formatF(info.withdrawable)}</dd>
              {info.pendingCashout.count > 0 && (<>
                <dt style={dt}>Déjà en cours</dt>
                <dd style={{ ...dd, color: '#b45309', fontWeight: 600 }}>{info.pendingCashout.count} retrait{info.pendingCashout.count > 1 ? 's' : ''} · {formatF(info.pendingCashout.amount)} — vérifiez avant d'en envoyer un autre</dd>
              </>)}
              {issue && (<>
                <dt style={dt}>Échec renvoyé</dt>
                <dd style={dd}>{formatF(Math.abs(issue.amount))} le {new Date(issue.createdAt).toLocaleString('fr-FR')}{issue.failureReason ? ` — ${issue.failureReason}` : ''}</dd>
              </>)}
            </dl>

            {blocked ? (
              <div role="alert" style={errorBox}>
                {!info.destinationValid && 'Le numéro du compte n\'est pas un mobile sénégalais valide : corrigez le profil d\'abord. '}
                {!info.nameValid && 'Le compte n\'a pas de nom complet (exigé par SamirPay) : complétez le profil d\'abord. '}
                {info.securityHoldUntil && `Numéro changé ou code secret réinitialisé récemment : envoi bloqué jusqu'au ${new Date(info.securityHoldUntil).toLocaleString('fr-FR')} (protection contre le vol de numéro).`}
              </div>
            ) : (
              <>
                <div style={label}>Opérateur *</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {OPERATORS.map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={operator === val}
                      onClick={() => setOperator(val)}
                      disabled={sending}
                      style={{ ...chip, ...(operator === val ? chipOn : {}) }}
                    >{lbl}</button>
                  ))}
                </div>

                <label style={label} htmlFor="admin-cashout-amount">Montant (F) *</label>
                <input
                  id="admin-cashout-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={`Entre ${info.minAmount} et ${Math.min(info.maxAmount, info.withdrawable)}`}
                  style={{ ...glassInput, fontSize: 14, fontFamily: 'inherit' }}
                  autoComplete="off"
                  disabled={sending}
                />
                <div style={{ fontSize: 11, marginTop: 4, color: amount && !amountOk ? '#dc2626' : 'var(--text-muted)' }}>
                  {amount && n > info.withdrawable ? `Au-delà du solde retirable (${formatF(info.withdrawable)}).`
                    : amount && n < info.minAmount ? `Minimum ${formatF(info.minAmount)}.`
                    : amount && n > info.maxAmount ? `Maximum ${formatF(info.maxAmount)} par retrait.`
                    : `Minimum ${formatF(info.minAmount)}, maximum ${formatF(Math.min(info.maxAmount, info.withdrawable))}.`}
                </div>

                <label style={{ ...label, marginTop: 14 }} htmlFor="admin-cashout-note">Motif *</label>
                <textarea
                  id="admin-cashout-note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Ex. : retrait échoué le 17/11, renvoyé à sa demande par téléphone"
                  style={{ ...glassInput, resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
                  disabled={sending}
                />
                <div style={{ fontSize: 11, color: note.trim().length >= NOTE_MIN ? '#15803d' : 'var(--text-muted)', marginTop: 4 }}>
                  Gardé dans le journal d'audit — {note.trim().length}/{NOTE_MIN} caractères minimum
                </div>

                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} disabled={sending} />
                  <span>
                    J'envoie <strong>{amountOk ? formatF(n) : '…'}</strong> sur le <strong>{operatorLabel || '…'}</strong> du <strong>{formatPhone(info.destinationPhone)}</strong>, débités du solde de {info.user.name || 'ce compte'}.
                  </span>
                </label>
              </>
            )}
          </>
        )}

        {error && <div role="alert" style={errorBox}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} disabled={sending} style={btnCancel}>Annuler</button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{ ...btnAction, background: '#15803d', opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            {sending ? 'Envoi en cours…' : amountOk ? `Envoyer ${formatF(n)}` : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay   = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }
const summary   = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: 'rgba(0,0,0,.03)', fontSize: 13 }
const dt        = { color: 'var(--text-muted)' }
const dd        = { margin: 0, wordBreak: 'break-word' }
const label     = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }
const chip      = { flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const chipOn    = { background: 'var(--primary)', color: '#fff', borderColor: 'transparent' }
const errorBox  = { marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(220,38,38,.08)', color: '#b91c1c', fontSize: 13, lineHeight: 1.45 }
const btnCancel = { padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const btnAction = { padding: '8px 18px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }
