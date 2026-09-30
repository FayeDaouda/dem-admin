import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, AlertTriangle, CheckCircle2, Save, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import { formatCount } from '../lib/format'

// ── Envoi des SMS des codes OTP (SUPER) ───────────────────────────────────────
// LAfricaMobile est le fournisseur principal ; Africa's Talking ne sert que
// de secours automatique, jusqu'à sa suppression. Ici : l'état des
// fournisseurs (variables Render, affiché seulement), le seuil d'alerte
// crédit, et la livraison mesurée par fournisseur et opérateur.
// Voir dem-backend/docs/sms-lafricamobile.md.

const PROVIDER_LABELS = { lafricamobile: 'LAfricaMobile', africastalking: "Africa's Talking" }
const OPERATOR_LABELS = { orange: 'Orange', free: 'Free', expresso: 'Expresso', promobile: 'Promobile', autre: 'Autre' }
const PERIODS = [[7, '7 jours'], [30, '30 jours']]

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const fmtDelay = (s) => (s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`)

export default function SmsRoutingPanel() {
  const [routing, setRouting] = useState(null)
  const [threshold, setThreshold] = useState('') // seuil d'alerte crédit (saisie)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState('')
  const [saving, setSaving]   = useState(false)

  const apply = (data) => {
    setRouting(data)
    setThreshold(String(data.creditAlertThreshold))
  }

  useEffect(() => {
    api.get('/admin/sms-routing')
      .then(({ data }) => apply(data))
      .catch(err => {
        if (err.response?.status === 404) setUnavailable(true) // backend sans le routeur SMS
        else setError(err.response?.data?.message ?? 'Erreur de chargement.')
      })
  }, [])

  if (unavailable) return null

  const changed = routing && threshold !== String(routing.creditAlertThreshold)

  async function save() {
    const value = Number(threshold)
    if (!Number.isInteger(value) || value < 0) { setError('Le seuil d\'alerte doit être un nombre entier positif.'); return }
    if (!window.confirm(`Alerte quand le crédit LAfricaMobile passe sous ${formatCount(value)} SMS.\n\nConfirmer ?`)) return

    setSaving(true); setError(''); setDone('')
    try {
      const { data } = await api.put('/admin/sms-routing', { creditAlertThreshold: value })
      apply(data)
      setDone('Seuil enregistré. Il s\'applique au prochain relevé du crédit.')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Enregistrement impossible.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ ...glass, padding: '18px 20px', maxWidth: 980 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={16} /> Envoi des SMS (codes de connexion et de retrait)
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Les codes partent par LAfricaMobile. S'il échoue ou ne répond pas en 8 secondes, le même code part aussitôt par
        Africa's Talking, gardé en secours jusqu'à sa suppression. Tant que LAfricaMobile n'est pas configuré sur le
        serveur, Africa's Talking reste seul.
      </p>

      {!routing && !error && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement…</div>}

      {routing && (
        <>
          <ServerState routing={routing} />

          <div style={{ marginTop: 16 }}>
            <Label>Alerte crédit LAfricaMobile sous</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input value={threshold} onChange={e => { setThreshold(e.target.value); setDone('') }} inputMode="numeric" style={{ ...glassInput, width: 100, textAlign: 'center' }} />
              <span style={{ fontSize: 13 }}>SMS</span>
              <button onClick={save} disabled={!changed || saving} style={{ ...btnPrimary, opacity: !changed || saving ? 0.5 : 1 }}>
                <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Crédit vérifié toutes les heures ; un email par passage sous le seuil.</div>
          </div>
        </>
      )}

      {done && <div style={{ ...notice, background: 'rgba(34,197,94,.08)', color: '#15803d' }}><CheckCircle2 size={14} /> {done}</div>}
      {error && <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div>}

      {routing && <DeliveryStats />}
    </div>
  )
}

// ── État côté serveur (variables Render, crédit) — lecture seule ─────────────
function ServerState({ routing }) {
  const c = routing.lamCredits
  const creditText = !routing.configured.lafricamobile ? '—'
    : !c ? 'pas encore relevé'
    : c.available === null || c.available === undefined ? (c.error ? 'relevé impossible' : 'illimité')
    : `${formatCount(c.available)} SMS`
  const creditLow = c?.low === true
  // Ordre réellement appliqué : un fournisseur non configuré est sauté
  const effective = [routing.primary, routing.fallback].filter(p => p && routing.configured[p])
  const rollback = routing.primary !== 'lafricamobile'
  const orderSub = rollback ? 'retour arrière d\'urgence actif (variables Render)'
    : !routing.configured.lafricamobile ? 'LAfricaMobile pas encore configuré : Africa\'s Talking seul'
    : effective.length > 1 ? 'Africa\'s Talking en secours automatique'
    : 'sans secours'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
      <Fact label="LAfricaMobile" ok={routing.configured.lafricamobile}
        value={routing.configured.lafricamobile ? `configuré — expéditeur « ${routing.lamSender} »` : 'non configuré (variables Render)'}
        sub={routing.configured.lafricamobile ? (routing.lamReportsEnabled ? 'accusés de livraison actifs' : 'accusés non configurés') : null} />
      <Fact label="Africa's Talking (secours)" ok={routing.configured.africastalking}
        value={routing.configured.africastalking ? 'configuré' : 'non configuré'}
        sub={routing.configured.africastalking ? (routing.atReportsEnabled ? 'accusés de livraison actifs' : 'accusés non configurés') : null} />
      <Fact label="Ordre d'envoi" ok={!rollback && routing.configured.lafricamobile}
        value={effective.map(p => PROVIDER_LABELS[p] ?? p).join(' → ') || 'aucun fournisseur configuré'}
        sub={orderSub} />
      <Fact label="Crédit LAfricaMobile" ok={!creditLow && !c?.error}
        value={creditText}
        sub={c?.error ? `${c.error} (${fmtDateTime(c.errorAt)})` : c?.checkedAt ? `relevé le ${fmtDateTime(c.checkedAt)}${creditLow ? ' — sous le seuil' : ''}` : null} />
    </div>
  )
}

// ── Livraison mesurée (GET /admin/otp-stats) ─────────────────────────────────
function DeliveryStats() {
  const [days, setDays]     = useState(7)
  const [result, setResult] = useState(null) // { days, providers?, error? }
  const [open, setOpen]     = useState(null)

  const load = useCallback(() => {
    let cancelled = false
    api.get('/admin/otp-stats', { params: { days } })
      .then(({ data }) => { if (!cancelled) setResult({ days, providers: data.smsProviders ?? {} }) })
      .catch(err => { if (!cancelled) setResult({ days, error: err.response?.data?.message ?? 'Erreur de chargement.' }) })
    return () => { cancelled = true }
  }, [days])

  useEffect(() => load(), [load])

  const providers = result?.days === days && result.providers ? Object.entries(result.providers) : []

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>LIVRAISON DES SMS PAR FOURNISSEUR</div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {PERIODS.map(([d, label]) => <button key={d} onClick={() => { setDays(d); setOpen(null) }} style={chip(days === d)}>{label}</button>)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        Taux de livraison = SMS livrés / SMS acceptés par le fournisseur. « Sans accusé » : le fournisseur n'a pas (encore)
        confirmé la livraison. Cliquez sur un fournisseur pour le détail par opérateur.
      </div>

      {result?.days !== days ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement…</div>
      ) : result.error ? (
        <div style={{ fontSize: 13, color: 'var(--danger)' }}>{result.error}</div>
      ) : providers.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun SMS envoyé par le nouveau routeur sur la période.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>{['Fournisseur', 'Tentatives', 'Acceptés', "Refus à l'envoi", 'Livrés', 'Échecs', 'Sans accusé', 'Taux de livraison', 'Délai médian', 'Après bascule'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {providers.map(([name, s]) => (
                <ProviderRows key={name} name={name} stats={s} open={open === name} onToggle={() => setOpen(o => (o === name ? null : name))} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProviderRows({ name, stats, open, onToggle }) {
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <>
      <tr onClick={onToggle} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
        <td style={{ ...td, fontWeight: 700 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Chevron size={13} />{PROVIDER_LABELS[name] ?? name}</span></td>
        <StatCells s={stats} />
      </tr>
      {open && Object.entries(stats.operators ?? {}).map(([op, s]) => (
        <tr key={op} style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,119,182,.03)' }}>
          <td style={{ ...td, paddingLeft: 28, color: 'var(--text-muted)' }}>{OPERATOR_LABELS[op] ?? op}</td>
          <StatCells s={s} />
        </tr>
      ))}
    </>
  )
}

function StatCells({ s }) {
  const rateColor = s.deliveryRate == null ? undefined : s.deliveryRate >= 95 ? 'var(--success)' : s.deliveryRate >= 85 ? '#f59e0b' : 'var(--danger)'
  return (
    <>
      <td style={td}>{formatCount(s.attempts)}</td>
      <td style={td}>{formatCount(s.accepted)}</td>
      <td style={{ ...td, color: s.submitFailed ? 'var(--danger)' : undefined }}>{formatCount(s.submitFailed)}</td>
      <td style={td}>{formatCount(s.delivered)}</td>
      <td style={{ ...td, color: s.failed ? 'var(--danger)' : undefined }}>{formatCount(s.failed)}</td>
      <td style={{ ...td, color: 'var(--text-muted)' }}>{formatCount(s.withoutReport)}</td>
      <td style={{ ...td, fontWeight: 700, color: rateColor }}>{s.deliveryRate == null ? '—' : `${s.deliveryRate.toLocaleString('fr-FR')} %`}</td>
      <td style={td}>{fmtDelay(s.medianDelaySec)}</td>
      <td style={td}>{formatCount(s.afterFallback)}</td>
    </>
  )
}

function Fact({ label, value, sub, ok }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${ok ? 'var(--success)' : '#f59e0b'}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{children}</div>
}

const chip = (active) => ({
  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  border: active ? 'none' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
})
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const notice     = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13 }
const th = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td = { padding: '8px 8px', verticalAlign: 'middle' }
