import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquareLock, Search, Unlock, AlertTriangle, CheckCircle2, Clock, User } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import AccountSecurityPanel from './AccountSecurityPanel'
import InfoTip from './InfoTip'

// ── Codes SMS bloqués (SUPER + Service Client) ────────────────────────────────
// Un numéro ne peut recevoir que 5 codes par 24 h (et doit patienter entre deux
// demandes). N'importe qui peut épuiser ce quota avec le numéro d'un autre et
// l'empêcher de se connecter jusqu'au lendemain : le support constate le
// blocage ici et le lève. Chaque déblocage est tracé dans l'audit.
// Le numéro cherché est gardé dans l'adresse (?tel=…) : un rechargement ou un
// lien rouvre le même résultat.

const PURPOSE_LABELS = { LOGIN: 'Connexion', CASHOUT: 'Retrait', PIN_SETUP: 'Code secret (création / oubli)', PHONE_CHANGE: 'Changement de numéro' }
const ROLE_LABELS = { CLIENT: 'Client', DRIVER: 'Coursier', DEM_PRO: 'DEM Pro', CHEF_DE_FLOTTE: 'Chef de flotte', ADMIN: 'Admin' }

function formatWait(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec} s`
  if (sec < 3600) return `${Math.ceil(sec / 60)} min`
  return `${Math.ceil(sec / 3600)} h`
}

export default function OtpUnblockPanel() {
  const [params, setParams] = useSearchParams()
  const tel = params.get('tel') ?? ''
  const [phone, setPhone]   = useState(tel)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState(null) // { tel, status?, error? } — réponse de la recherche
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState('')

  useEffect(() => {
    if (!tel) return
    let cancelled = false
    api.get('/admin/otp/status', { params: { phone: tel } })
      .then(({ data }) => { if (!cancelled) setResult({ tel, status: data }) })
      .catch(err => { if (!cancelled) setResult({ tel, error: err.response?.data?.message ?? 'Erreur lors de la recherche.' }) })
    return () => { cancelled = true }
  }, [tel, reloadKey])

  function search(e) {
    e?.preventDefault()
    const q = phone.trim()
    if (!q) return
    setResult(null); setError(''); setDone(''); setConfirming(false)
    if (q === tel) setReloadKey(k => k + 1)
    else setParams(prev => { const next = new URLSearchParams(prev); next.set('tel', q); return next }, { replace: true })
  }

  async function unblock() {
    setBusy(true); setError('')
    try {
      const { data } = await api.post('/admin/otp/unblock', { phone: status.phone })
      setResult({ tel, status: data })
      setDone(data.message)
      setConfirming(false)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Le déblocage a échoué.')
    } finally { setBusy(false) }
  }

  const current   = result?.tel === tel ? result : null
  const searching = !!tel && !current
  const status    = current?.status ?? null
  const purposes  = status ? Object.entries(status.purposes) : []
  const somethingToUnblock = purposes.some(([, s]) => s.sentToday > 0 || s.cooldownLeft > 0)
  const limitHit  = purposes.some(([, s]) => s.dailyLimitHit)
  const waiting   = purposes.some(([, s]) => s.cooldownLeft > 0)
  const state = limitHit ? { text: 'Codes SMS bloqués (quota du jour atteint)', color: '#b91c1c', bg: 'rgba(239,68,68,.10)', Icon: AlertTriangle }
    : waiting          ? { text: 'Attente avant le prochain code', color: '#b45309', bg: 'rgba(245,158,11,.12)', Icon: Clock }
    :                    { text: 'Rien de bloqué', color: '#15803d', bg: 'rgba(34,197,94,.10)', Icon: CheckCircle2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Recherche */}
      <form onSubmit={search} style={{ ...glass, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Numéro de téléphone (ex : 77 123 45 67)" style={{ ...glassInput, paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <button type="submit" disabled={searching || !phone.trim()} style={btnPrimary}>
          {searching ? 'Recherche…' : 'Vérifier'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: '1 1 260px' }}>
          Un utilisateur ne reçoit plus de code (« Trop de codes demandés pour ce numéro ») ? Cherchez son numéro pour voir où il en est.
        </span>
      </form>

      {current?.error && (
        <div style={{ ...notice, marginTop: 0, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {current.error}</div>
      )}

      {status && (<>
        {/* Bandeau : numéro, compte, état */}
        <div style={{ ...glass, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
            <User size={18} color="var(--text-muted)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{status.phone}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {status.account
                  ? <>{status.account.name ?? 'Sans nom'} · {ROLE_LABELS[status.account.role] ?? status.account.role}{status.account.isActive ? '' : ' · compte suspendu'}</>
                  : 'Aucun compte (inscription pas encore terminée)'}
              </div>
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 20, background: state.bg, color: state.color }}>
            <state.Icon size={14} /> {state.text}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'start' }}>
          {/* Colonne gauche : codes SMS */}
          <div style={{ ...glass, padding: '16px 18px' }}>
            <h2 style={blockTitle}><MessageSquareLock size={15} /> Codes SMS<InfoTip k="Codes SMS" size={13} /></h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Motif</th>
                  <th style={th}>Envoyés (24 h)</th>
                  <th style={th}>Quota remis à zéro dans</th>
                  <th style={th}>Prochain code dans</th>
                  <th style={th}>Code en attente</th>
                </tr>
              </thead>
              <tbody>
                {purposes.map(([purpose, s]) => (
                  <tr key={purpose} style={{ background: s.dailyLimitHit ? 'rgba(239,68,68,.07)' : 'transparent' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{PURPOSE_LABELS[purpose] ?? purpose}</td>
                    <td style={{ ...td, fontWeight: 700, color: s.dailyLimitHit ? '#b91c1c' : 'var(--text)' }}>
                      {s.sentToday} / {s.maxPerDay}{s.dailyLimitHit ? ' — bloqué' : ''}
                    </td>
                    <td style={td}>{s.sentToday > 0 ? formatWait(s.windowResetsIn) : '—'}</td>
                    <td style={td}>{formatWait(s.cooldownLeft)}</td>
                    <td style={td}>{s.codePending ? 'Oui (valable 5 min)' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {done ? (
              <div style={{ ...notice, background: 'rgba(34,197,94,.08)', color: '#15803d' }}><CheckCircle2 size={14} /> {done}</div>
            ) : somethingToUnblock ? (
              confirming ? (
                <div style={confirmBox}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Débloquer les codes SMS du {status.phone} ?</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Le quota du jour et le délai d'attente sont remis à zéro. Action tracée dans l'audit.</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setConfirming(false)} disabled={busy} style={btnOutline}>Retour</button>
                    <button onClick={unblock} disabled={busy} style={btnPrimary}><Unlock size={14} /> {busy ? 'Déblocage…' : 'Confirmer le déblocage'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirming(true)} style={{ ...btnPrimary, marginTop: 12 }}>
                  <Unlock size={14} /> Débloquer les codes SMS
                </button>
              )
            ) : (
              <div style={{ ...notice, background: 'rgba(0,119,182,.06)', color: 'var(--text)' }}>
                Rien à débloquer : si l'utilisateur ne reçoit toujours rien, le problème vient de l'envoi (opérateur, numéro), pas d'un blocage.
              </div>
            )}
            {error && <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div>}
          </div>

          {/* Colonne droite : sécurité du compte */}
          <div style={{ ...glass, padding: '16px 18px' }}>
            {status.account
              ? <AccountSecurityPanel key={status.account.id} userId={status.account.id} />
              : (<>
                  <h2 style={blockTitle}>Sécurité du compte<InfoTip k="Sécurité du compte" size={13} /></h2>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun compte pour ce numéro : rien à afficher.</div>
                </>)}
          </div>
        </div>
      </>)}
    </div>
  )
}

const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const notice     = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13 }
const confirmBox = { marginTop: 12, background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }
const blockTitle = { fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }
const th         = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td         = { padding: '8px', verticalAlign: 'middle' }
