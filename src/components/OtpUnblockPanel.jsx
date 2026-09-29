import { useState } from 'react'
import { MessageSquareLock, Search, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// ── Codes SMS bloqués (SUPER + Service Client) ────────────────────────────────
// Un numéro ne peut recevoir que 5 codes par 24 h (et doit patienter entre deux
// demandes). N'importe qui peut épuiser ce quota avec le numéro d'un autre et
// l'empêcher de se connecter jusqu'au lendemain : le support constate le
// blocage ici et le lève. Chaque déblocage est tracé dans l'audit.

const PURPOSE_LABELS = { LOGIN: 'Connexion', CASHOUT: 'Retrait' }
const ROLE_LABELS = { CLIENT: 'Client', DRIVER: 'Livreur', DEM_PRO: 'DEM Pro', CHEF_DE_FLOTTE: 'Chef de flotte', ADMIN: 'Admin' }

function formatWait(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec} s`
  if (sec < 3600) return `${Math.ceil(sec / 60)} min`
  return `${Math.ceil(sec / 3600)} h`
}

export default function OtpUnblockPanel() {
  const [phone, setPhone]   = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy]     = useState('') // 'search' | 'unblock' | ''
  const [error, setError]   = useState('')
  const [done, setDone]     = useState('')

  async function search(e) {
    e?.preventDefault()
    if (!phone.trim()) return
    setBusy('search'); setError(''); setDone('')
    try {
      const { data } = await api.get('/admin/otp/status', { params: { phone } })
      setStatus(data)
    } catch (err) {
      setStatus(null)
      setError(err.response?.data?.message ?? 'Erreur lors de la recherche.')
    } finally { setBusy('') }
  }

  async function unblock() {
    if (!window.confirm(`Débloquer les codes SMS du ${status.phone} ?\n\nLe quota du jour et le délai d'attente sont remis à zéro. Action tracée dans l'audit.`)) return
    setBusy('unblock'); setError('')
    try {
      const { data } = await api.post('/admin/otp/unblock', { phone: status.phone })
      setStatus(data)
      setDone(data.message)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Le déblocage a échoué.')
    } finally { setBusy('') }
  }

  const purposes = status ? Object.entries(status.purposes) : []
  const somethingToUnblock = purposes.some(([, s]) => s.sentToday > 0 || s.cooldownLeft > 0)

  return (
    <div style={{ ...glass, padding: '18px 20px', maxWidth: 760 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquareLock size={16} /> Codes SMS bloqués
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Un utilisateur ne reçoit plus de code (« Trop de codes demandés pour ce numéro ») ? Cherchez son numéro pour voir
        où il en est, puis débloquez-le si nécessaire.
      </p>

      <form onSubmit={search} style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="77 123 45 67" style={{ ...glassInput, paddingLeft: 36 }} />
        </div>
        <button type="submit" disabled={busy !== '' || !phone.trim()} style={btnPrimary}>
          {busy === 'search' ? 'Recherche…' : 'Vérifier'}
        </button>
      </form>

      {error && (
        <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div>
      )}

      {status && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>{status.phone}</strong>
            {' — '}
            {status.account
              ? <>{status.account.name ?? 'Sans nom'} · {ROLE_LABELS[status.account.role] ?? status.account.role}{status.account.isActive ? '' : ' · compte suspendu'}</>
              : <span style={{ color: 'var(--text-muted)' }}>aucun compte (inscription pas encore terminée)</span>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Motif</th>
                <th style={th}>Codes envoyés (24 h)</th>
                <th style={th}>Quota remis à zéro dans</th>
                <th style={th}>Prochain code possible dans</th>
                <th style={th}>Code en attente</th>
              </tr>
            </thead>
            <tbody>
              {purposes.map(([purpose, s]) => (
                <tr key={purpose}>
                  <td style={td}>{PURPOSE_LABELS[purpose] ?? purpose}</td>
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
            <button onClick={unblock} disabled={busy !== ''} style={{ ...btnPrimary, marginTop: 12 }}>
              <Unlock size={14} /> {busy === 'unblock' ? 'Déblocage…' : 'Débloquer les codes SMS'}
            </button>
          ) : (
            <div style={{ ...notice, background: 'rgba(0,119,182,.06)', color: 'var(--text)' }}>
              Rien à débloquer : si l'utilisateur ne reçoit toujours rien, le problème vient de l'envoi (opérateur, numéro), pas d'un blocage.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const notice     = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13 }
const th         = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td         = { padding: '8px', verticalAlign: 'middle' }
