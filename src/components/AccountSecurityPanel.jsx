import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ShieldAlert, Snowflake, KeyRound, LogOut, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react'
import api from '../lib/api'

// ── Sécurité d'un compte (SUPER + Service Client) ─────────────────────────────
// Code secret, blocages, gel, blocage des retraits, appareils connectés et
// historique des connexions — avec les actions du support. L'admin ne voit ni
// ne choisit jamais le code : « Réinitialiser » l'efface, l'utilisateur en
// choisit un nouveau après un SMS.

const EVENT_LABELS = {
  LOGIN: 'Connexion', LOGIN_FAILED: 'Code faux (connexion)', PIN_FAILED: 'Code faux (action sensible)',
  PIN_LOCKED: 'Code bloqué', PIN_SET: 'Code créé', PIN_RESET: 'Code réinitialisé', PIN_CHANGED: 'Code changé',
  NEW_DEVICE: 'Nouvel appareil', PHONE_CHANGED: 'Numéro changé', SESSION_REVOKED: 'Appareil déconnecté',
  REFRESH_REUSE: 'Vol de session détecté', FROZEN: 'Compte gelé (« ce n\'était pas moi »)', UNFROZEN: 'Compte dégelé',
  LOGOUT: 'Déconnexion',
}
const ALERT_EVENTS = new Set(['REFRESH_REUSE', 'FROZEN', 'PIN_LOCKED'])

const fmt = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

function eventDetail(e) {
  const m = e.meta ?? {}
  if (e.type === 'PIN_SET' && m.kind === 'MIGRATION') return 'sans SMS (déjà connecté)'
  if (e.type === 'PIN_SET' && m.kind === 'SIGNUP') return 'inscription'
  if (e.type === 'PIN_RESET' && m.kind === 'ADMIN') return 'par le support'
  if (e.type === 'PIN_RESET' && m.securityHold) return 'depuis un nouvel appareil → retraits bloqués 48 h'
  if (e.type === 'PIN_LOCKED') return m.resetRequired ? 'réinitialisation obligatoire' : `${m.minutes} min`
  if (e.type === 'LOGIN') return m.method === 'PIN' ? 'code secret' : 'SMS'
  if (e.type === 'NEW_DEVICE') return m.deviceName ?? ''
  if (e.type === 'PHONE_CHANGED') return `${m.from ?? ''} → ${m.to ?? ''}`
  if (e.type === 'LOGIN_FAILED' || e.type === 'PIN_FAILED') return `${m.failures} échec(s)`
  return ''
}

export default function AccountSecurityPanel({ userId }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState('')
  const [done, setDone]   = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/users/${userId}/security`)
      setData(data); setError('')
    } catch (err) {
      // Backend sans code secret (phase 1 pas encore déployée) : panneau masqué
      setData(null)
      setError(err.response?.status === 404 ? '' : (err.response?.data?.message ?? 'Erreur de chargement.'))
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function act(kind, url, question) {
    if (!window.confirm(question)) return
    setBusy(kind); setDone(''); setError('')
    try {
      const { data } = await api.post(url)
      setDone(data.message)
      await load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Action impossible.')
    } finally { setBusy('') }
  }

  if (!data) return error ? <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div> : null

  const u = data.user
  const lockedUntil = u.pinLockedUntil && new Date(u.pinLockedUntil) > new Date() ? u.pinLockedUntil : null

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {u.frozenAt ? <ShieldAlert size={15} color="#b91c1c" /> : <ShieldCheck size={15} />} Sécurité du compte
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, fontSize: 12.5 }}>
        <Fact label="Code secret" value={u.hasPin ? `créé le ${fmt(u.pinSetAt)}` : 'pas encore créé'} />
        <Fact label="Codes faux d'affilée" value={u.pinFailedCount} warn={u.pinFailedCount >= 5} />
        <Fact label="Code bloqué jusqu'au" value={lockedUntil ? fmt(lockedUntil) : '—'} warn={!!lockedUntil} />
        <Fact label="Retraits bloqués jusqu'au" value={u.securityHoldUntil ? fmt(u.securityHoldUntil) : '—'} warn={!!u.securityHoldUntil} />
        <Fact label="Compte gelé" value={u.frozenAt ? `depuis le ${fmt(u.frozenAt)}` : 'non'} warn={!!u.frozenAt} />
      </div>

      {done && <div style={{ ...notice, background: 'rgba(34,197,94,.08)', color: '#15803d' }}><CheckCircle2 size={14} /> {done}</div>}
      {error && <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {u.frozenAt && (
          <button disabled={busy !== ''} style={btn('#15803d')} onClick={() => act('unfreeze', `/admin/users/${userId}/unfreeze`,
            "Dégeler ce compte ?\n\nNe le faites qu'après avoir vérifié l'identité du titulaire (pièce d'identité, historique de commandes).")}>
            <Snowflake size={13} /> {busy === 'unfreeze' ? '…' : 'Dégeler'}
          </button>
        )}
        {u.hasPin && (
          <button disabled={busy !== ''} style={btn('#b45309')} onClick={() => act('reset', `/admin/users/${userId}/force-pin-reset`,
            "Réinitialiser le code secret ?\n\nL'utilisateur est déconnecté partout et devra reprouver son numéro par SMS pour choisir un nouveau code.")}>
            <KeyRound size={13} /> {busy === 'reset' ? '…' : 'Réinitialiser le code'}
          </button>
        )}
        <button disabled={busy !== ''} style={btn('#b91c1c')} onClick={() => act('revoke', `/admin/users/${userId}/revoke-sessions`,
          'Déconnecter tous les appareils de ce compte ?')}>
          <LogOut size={13} /> {busy === 'revoke' ? '…' : 'Déconnecter tous les appareils'}
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 12.5 }}>
        <div style={subTitle}>Appareils connectés ({data.sessions.length})</div>
        {data.sessions.length === 0
          ? <div style={{ color: 'var(--text-muted)' }}>Aucune session « code secret » active.</div>
          : data.sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <Smartphone size={13} color="var(--text-muted)" />
              <span style={{ fontWeight: 600 }}>{s.deviceName ?? s.platform ?? 'Appareil'}</span>
              <span style={{ color: 'var(--text-muted)' }}>· app {s.appVersion ?? '?'} · actif le {fmt(s.lastUsedAt)}</span>
            </div>
          ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12.5 }}>
        <div style={subTitle}>Derniers événements</div>
        {data.events.length === 0
          ? <div style={{ color: 'var(--text-muted)' }}>Aucun événement.</div>
          : (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {data.events.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 10, padding: '3px 0', color: ALERT_EVENTS.has(e.type) ? '#b91c1c' : 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{fmt(e.createdAt)}</span>
                  <span style={{ fontWeight: 600 }}>{EVENT_LABELS[e.type] ?? e.type}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{eventDetail(e)}</span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

function Fact({ label, value, warn }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: warn ? '#ef444410' : 'rgba(0,119,182,.05)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700, color: warn ? '#b91c1c' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

const btn = (color) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${color}`, background: 'transparent', color, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' })
const notice = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13 }
const subTitle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }
