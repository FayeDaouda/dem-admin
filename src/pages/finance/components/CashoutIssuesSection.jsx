import { useCallback, useEffect, useState } from 'react'
import api from '../../../lib/api'
import { glass, glassInput } from '../../../lib/glassStyles'
import { formatF, hoursSince } from '../../../lib/format'
import { useAutoRefresh } from '../../../lib/useAutoRefresh'
import AdminCashoutModal from '../../../components/AdminCashoutModal'

// « Problèmes de retrait » (GET /admin/samirpay/cashout-issues) :
//  - échoués (30 j, non traités) avec la raison SamirPay / opérateur — le
//    montant est déjà revenu sur le solde de la personne ;
//  - bloqués « en cours » depuis plus de 15 min (DEM les suit seul).
// Les retraits en vérification ont leur propre section, juste en dessous.
// Renvoyer = SUPER seul (argent réel, toujours vers le numéro du compte) ;
// Classer = SUPER + FINANCE, motif obligatoire.

const OPERATORS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }
const ROLE_LABELS = { DRIVER: 'Livreur', DEM_PRO: 'DEM Pro', CLIENT: 'Client' }
const CLOSE_NOTE_MIN = 10

export default function CashoutIssuesSection({ isSuper, reviewCount = 0, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [resend, setResend] = useState(null)   // retrait échoué à renvoyer
  const [closing, setClosing] = useState(null) // { tx, note, sending, error }
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/samirpay/cashout-issues')
      setData(r.data)
      setError(null)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Impossible de charger les problèmes de retrait.')
    }
  }, [])
  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  async function closeIssue() {
    if (!closing || closing.note.trim().length < CLOSE_NOTE_MIN) return
    setClosing(c => ({ ...c, sending: true, error: null }))
    try {
      await api.post(`/admin/samirpay/cashout-issues/${closing.tx.id}/close`, { note: closing.note.trim() })
      setClosing(null)
      setNotice('Retrait classé.')
      load()
    } catch (e) {
      setClosing(c => ({ ...c, sending: false, error: e.response?.data?.message ?? 'Échec. Rien n\'a été modifié.' }))
    }
  }

  const failed = data?.failed ?? []
  const stuck = data?.stuck ?? []
  const total = failed.length + stuck.length

  return (
    <div style={{ ...glass, padding: '18px 20px' }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Problèmes de retrait {total > 0 && <span style={{ color: '#e53e3e' }}>({total})</span>}
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
        Retraits refusés par SamirPay ou l'opérateur (30 derniers jours) : le montant est déjà revenu sur le solde de la personne.
        {isSuper ? ' Renvoyez-le sur son numéro, ou classez-le s\'il est réglé autrement.' : ' Seul le super admin peut renvoyer un retrait.'}
        {reviewCount > 0 && <> <strong style={{ color: '#dc2626' }}>{reviewCount} retrait{reviewCount > 1 ? 's' : ''} en vérification</strong> plus bas.</>}
      </p>

      {notice && <div role="status" style={okBox}>{notice}</div>}
      {error && <div role="alert" style={errBox}>{error}</div>}
      {!data && !error && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chargement…</div>}

      {data && total === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aucun problème de retrait. ✓</div>}

      {failed.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: stuck.length ? 18 : 0 }}>
          <div style={subTitle}>Échoués — recrédités ({failed.length})</div>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Compte</th>
                <th style={th}>Montant</th>
                <th style={th}>Raison</th>
                <th style={th}>Retirable</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {failed.map(tx => (
                <tr key={tx.id}>
                  <td style={td} title={new Date(tx.createdAt).toLocaleString('fr-FR')}>{new Date(tx.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{tx.user?.name ?? '—'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{ROLE_LABELS[tx.user?.role] ?? tx.user?.role} · {tx.user?.phone ?? '—'}</div>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <strong>{formatF(Math.abs(tx.amount))}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{OPERATORS[tx.operatorName] ?? tx.operatorName ?? '—'}{tx.initiatedByAdminId ? ' · envoyé par DEM' : ''}</div>
                  </td>
                  <td style={{ ...td, maxWidth: 280 }}>
                    <span style={{ color: '#b91c1c' }}>{tx.failureReason || 'Raison non enregistrée (échec antérieur au suivi)'}</span>
                    {tx.succeededSince && <div style={{ ...tag, marginTop: 4 }}>Retrait réussi depuis</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatF(tx.user?.withdrawableBalance ?? 0)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {isSuper && (
                      <button type="button" onClick={() => { setNotice(null); setResend(tx) }} style={{ ...btn, color: '#15803d', borderColor: 'rgba(21,128,61,.4)' }}>Renvoyer</button>
                    )}
                    <button type="button" onClick={() => { setNotice(null); setClosing({ tx, note: '', sending: false, error: null }) }} style={{ ...btn, marginLeft: isSuper ? 6 : 0 }}>Classer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stuck.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <div style={subTitle}>En cours depuis plus de 15 min ({stuck.length})</div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            DEM interroge SamirPay toutes les 10 min : confirmé, ou recrédité si l'opérateur refuse. Sans réponse après 24 h, le retrait passe en vérification manuelle.
          </p>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Compte</th><th style={th}>Montant</th><th style={th}>Opérateur</th><th style={th}>Depuis</th></tr>
            </thead>
            <tbody>
              {stuck.map(tx => (
                <tr key={tx.id}>
                  <td style={td}>{tx.user?.name ?? '—'} <span style={{ color: 'var(--text-muted)' }}>· {tx.user?.phone ?? '—'}</span></td>
                  <td style={td}>{formatF(Math.abs(tx.amount))}</td>
                  <td style={td}>{OPERATORS[tx.operatorName] ?? tx.operatorName ?? '—'}</td>
                  <td style={td}>{hoursSince(tx.createdAt)} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {closing && (
        <div style={overlay} onClick={closing.sending ? undefined : () => setClosing(null)}>
          <div role="dialog" aria-modal="true" style={{ ...glass, background: 'var(--surface, #fff)', padding: '22px 24px', width: 440, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Classer ce retrait échoué</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 12px' }}>
              {formatF(Math.abs(closing.tx.amount))} de {closing.tx.user?.name ?? 'ce compte'} — rien n'est envoyé ni débité : le retrait sort simplement de la liste.
            </p>
            <textarea
              value={closing.note}
              onChange={e => setClosing(c => ({ ...c, note: e.target.value }))}
              rows={3}
              placeholder="Ex. : il a refait le retrait lui-même le 18/11"
              style={{ ...glassInput, resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 11, color: closing.note.trim().length >= CLOSE_NOTE_MIN ? '#15803d' : 'var(--text-muted)', marginTop: 4 }}>
              {closing.note.trim().length}/{CLOSE_NOTE_MIN} caractères minimum
            </div>
            {closing.error && <div role="alert" style={errBox}>{closing.error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setClosing(null)} disabled={closing.sending} style={btn}>Annuler</button>
              <button
                type="button"
                onClick={closeIssue}
                disabled={closing.sending || closing.note.trim().length < CLOSE_NOTE_MIN}
                style={{ ...btn, background: 'var(--primary)', color: '#fff', borderColor: 'transparent', opacity: closing.note.trim().length < CLOSE_NOTE_MIN ? 0.5 : 1 }}
              >{closing.sending ? 'En cours…' : 'Classer'}</button>
            </div>
          </div>
        </div>
      )}

      {resend && (
        <AdminCashoutModal
          userId={resend.userId}
          issue={resend}
          onClose={() => setResend(null)}
          onDone={() => { setResend(null); load(); onChanged?.() }}
        />
      )}
    </div>
  )
}

const subTitle = { fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }
const th  = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const td  = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid rgba(0,0,0,0.04)', verticalAlign: 'top' }
const btn = { padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,.15)', background: 'transparent', color: 'var(--text)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }
const tag = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: 'rgba(21,128,61,.1)', color: '#15803d', fontSize: 11, fontWeight: 600 }
const okBox  = { marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(21,128,61,.08)', color: '#15803d', fontSize: 12, fontWeight: 600 }
const errBox = { marginTop: 10, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: '#b91c1c', fontSize: 12.5 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 16 }
