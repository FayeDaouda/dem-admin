import { useState, useEffect, useCallback } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Search, RefreshCw, Building2, ShieldCheck, Bell } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'

// ── DEM Pro › API DEM ─────────────────────────────────────────────────────────
// Surveillance de l'API partenaires (/v1) : mesures des 15 dernières minutes,
// alertes ouvertes (calculées toutes les 5 min côté serveur, SUPER + DEV
// prévenus par notification), recherche d'un appel par request_id (support),
// comptes API et seuils d'alerte (modifiables par le SUPER).
// Lecture : SUPER + SC ; seuils : SUPER (vérifié aussi côté serveur).

const THRESHOLD_FIELDS = [
  ['error5xxRatePct',         'Erreurs serveur (5xx)',                 '%',            'Toute l\'API et chaque compte. Critique au double du seuil.'],
  ['error4xxRatePct',         'Appels refusés (4xx) d\'un compte',      '%',            'Intégration du commerçant probablement cassée.'],
  ['latencyP95Ms',            'Temps de réponse p95',                  'ms',           '95 % des appels doivent répondre plus vite.'],
  ['minRequests',             'Volume minimum pour un taux',           'appels / 15 min', 'En dessous, pas d\'alerte de taux (évite les fausses alertes).'],
  ['rateLimitedPerWindow',    'Appels bloqués par la limite / minute', 'en 15 min',    'Le compte dépasse son quota : quota sur mesure à envisager.'],
  ['dailyQuotaPct',           'Quota de livraisons du jour utilisé',   '%',            'Le commerçant est aussi prévenu.'],
  ['webhookFailuresPerHour',  'Webhooks en échec d\'un compte',         'en 1 h',       'Le commerçant est aussi prévenu.'],
  ['webhookBacklog',          'Webhooks en retard (plus de 2 min)',    'envois',       'L\'envoi ne suit plus.'],
  ['databaseErrorsPerWindow', 'Erreurs base de données',               'en 15 min',    ''],
  ['redisErrorsPerWindow',    'Erreurs Redis',                         'en 15 min',    'Limiteur coupé : les appels passent sans limite par minute.'],
  ['walletErrorsPerWindow',   'Erreurs wallet',                        'en 15 min',    'Erreur serveur sur une livraison payée par wallet.'],
]

const SEVERITY = {
  CRITICAL: ['Critique', '#dc2626'],
  WARNING:  ['Attention', '#d97706'],
}

const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'
const fmtMs = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} s` : `${v} ms`)
const fmtPct = (v) => (v == null ? '—' : `${String(v).replace('.', ',')} %`)
const fmtNum = (v) => (v ?? 0).toLocaleString('fr-FR')
const errMsg = (e, fallback) => e.response?.data?.message ?? fallback

export default function ApiMonitoringTab({ isSuper, onOpenAccount }) {
  const [state, setState] = useState(null) // { monitoring, organizations } | { error }
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion(v => v + 1), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get('/admin/api/monitoring'), api.get('/admin/api/organizations')])
      .then(([m, o]) => { if (!cancelled) setState({ monitoring: m.data, organizations: o.data.organizations }) })
      .catch(e => {
        if (cancelled) return
        setState({ error: e.response?.status === 404 ? 'La surveillance de l\'API n\'est pas encore disponible sur le serveur.' : errMsg(e, 'Erreur de chargement.') })
      })
    return () => { cancelled = true }
  }, [version])

  // Mesures rafraîchies toutes les minutes tant que l'onglet est ouvert
  useEffect(() => {
    const t = setInterval(reload, 60_000)
    return () => clearInterval(t)
  }, [reload])

  if (!state) return <div style={{ ...glass, padding: 24, color: 'var(--text-muted)' }}>Chargement…</div>
  if (state.error) return <div style={{ ...glass, padding: 24, color: 'var(--danger)' }}>{state.error}</div>

  const { monitoring: m, organizations } = state
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingBottom: 20 }}>
      <div style={{ ...glass, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Activity size={18} color="var(--primary)" />
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Surveillance de l'API DEM</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            Mesures des {m.now.windowMinutes} dernières minutes. Les alertes sont calculées toutes les 5 min ; SUPER et DEV sont prévenus par notification,
            le commerçant aussi pour ses webhooks et son quota. Une alerte se ferme seule 15 min après le retour à la normale.
          </div>
        </div>
        <button onClick={reload} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
      </div>

      <NowSection now={m.now} thresholds={m.thresholds} />
      <OpenAlertsSection alerts={m.open} onOpenAccount={onOpenAccount} onChanged={reload} />
      <RequestLookup onOpenAccount={onOpenAccount} />
      <OrganizationsSection organizations={organizations} onOpenAccount={onOpenAccount} />
      <ThresholdsSection monitoring={m} isSuper={isSuper} onSaved={reload} />
      {m.recent.length > 0 && <RecentAlertsSection alerts={m.recent} onOpenAccount={onOpenAccount} />}
    </div>
  )
}

// ── Mesures du moment ───────────────────────────────────────────────────────
function NowSection({ now, thresholds: t }) {
  const over = (v, limit) => v != null && v >= limit
  const enough = now.requests >= t.minRequests
  return (
    <Card title="En ce moment" icon={<Activity size={15} />}>
      <div style={grid}>
        <Stat label="Appels (15 min)" value={fmtNum(now.requests)} sub="Production et test" />
        <Stat label="Erreurs serveur" value={fmtPct(now.error5xxRate)}
          color={enough && over(now.error5xxRate, t.error5xxRatePct) ? 'var(--danger)' : undefined}
          sub={`Seuil ${fmtPct(t.error5xxRatePct)}`} />
        <Stat label="Temps de réponse p95" value={fmtMs(now.p95LatencyMs)}
          color={enough && over(now.p95LatencyMs, t.latencyP95Ms) ? 'var(--danger)' : undefined}
          sub={`Seuil ${fmtMs(t.latencyP95Ms)}`} />
        <Stat label="Webhooks en retard" value={fmtNum(now.webhookBacklog)}
          color={over(now.webhookBacklog, t.webhookBacklog) ? 'var(--danger)' : undefined}
          sub="Envois dus depuis plus de 2 min" />
        <Stat label="Erreurs techniques" value={fmtNum(now.databaseErrors + now.redisErrors + now.walletErrors)}
          color={now.databaseErrors + now.redisErrors + now.walletErrors > 0 ? 'var(--danger)' : undefined}
          sub={`Base ${now.databaseErrors} · Redis ${now.redisErrors} · Wallet ${now.walletErrors}`} />
      </div>
    </Card>
  )
}

// ── Alertes ─────────────────────────────────────────────────────────────────
function OpenAlertsSection({ alerts, onOpenAccount, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function ack(a) {
    setBusyId(a.id); setError('')
    try {
      await api.post(`/admin/api/alerts/${a.id}/ack`)
      onChanged()
    } catch (e) { setError(errMsg(e, 'Action impossible.')) } finally { setBusyId(null) }
  }

  return (
    <Card title={`Alertes ouvertes${alerts.length ? ` (${alerts.length})` : ''}`} icon={<Bell size={15} />}>
      {alerts.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: 13, fontWeight: 600 }}>
          <CheckCircle2 size={16} /> Aucune alerte : l'API fonctionne normalement.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => <AlertRow key={a.id} alert={a} onOpenAccount={onOpenAccount}
            action={a.acknowledgedAt
              ? <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Vue le {fmtDateTime(a.acknowledgedAt)}</span>
              : <button onClick={() => ack(a)} disabled={busyId === a.id} style={btnSmall}>{busyId === a.id ? '…' : 'Marquer comme vue'}</button>} />)}
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
    </Card>
  )
}

export function AlertRow({ alert: a, onOpenAccount, action, hideAccount = false }) {
  const [label, color] = SEVERITY[a.severity] ?? [a.severity, '#64748b']
  const resolved = a.status === 'RESOLVED'
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: resolved ? 'var(--surface2)' : color + '0f', border: `1px solid ${resolved ? 'var(--border)' : color + '33'}`, flexWrap: 'wrap' }}>
      <AlertTriangle size={16} color={resolved ? 'var(--text-muted)' : color} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</span>
          {resolved ? <Chip color="#16a34a">Résolue</Chip> : <Chip color={color}>{label}</Chip>}
          {hideAccount ? null : a.organization
            ? (onOpenAccount
              ? <button onClick={() => onOpenAccount(a.organization.accountId)} style={linkBtn}>{a.organization.name}</button>
              : <span style={{ fontSize: 12, fontWeight: 600 }}>{a.organization.name}</span>)
            : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Toute l'API</span>}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 3 }}>{a.message}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
          Ouverte le {fmtDateTime(a.openedAt)}
          {resolved ? ` · résolue le ${fmtDateTime(a.resolvedAt)}` : ` · dernier constat le ${fmtDateTime(a.lastSeenAt)}`}
        </div>
      </div>
      {action && <div style={{ alignSelf: 'center' }}>{action}</div>}
    </div>
  )
}

function RecentAlertsSection({ alerts, onOpenAccount }) {
  return (
    <Card title="Alertes résolues (7 jours)" icon={<CheckCircle2 size={15} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map(a => <AlertRow key={a.id} alert={a} onOpenAccount={onOpenAccount} />)}
      </div>
    </Card>
  )
}

// ── Support : retrouver un appel ────────────────────────────────────────────
function RequestLookup({ onOpenAccount }) {
  const [rid, setRid] = useState('')
  const [result, setResult] = useState(null) // { log, organization } | { error }
  const [busy, setBusy] = useState(false)

  async function search(e) {
    e.preventDefault()
    const q = rid.trim()
    if (!q) return
    setBusy(true); setResult(null)
    try {
      const r = await api.get(`/admin/api/logs/${encodeURIComponent(q)}`)
      setResult(r.data)
    } catch (err) {
      setResult({ error: errMsg(err, 'Recherche impossible.') })
    } finally { setBusy(false) }
  }

  const l = result?.log
  return (
    <Card title="Retrouver un appel" icon={<Search size={15} />}
      hint="Le partenaire donne le request_id reçu dans la réponse ou l'en-tête X-Request-ID">
      <form onSubmit={search} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={rid} onChange={e => setRid(e.target.value)} placeholder="req_…" spellCheck={false}
          style={{ ...glassInput, flex: '1 1 260px', width: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
        <button type="submit" disabled={busy || !rid.trim()} style={{ ...btnPrimary, opacity: busy || !rid.trim() ? 0.6 : 1 }}>
          <Search size={14} /> {busy ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>
      {result?.error && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 10 }}>{result.error}</div>}
      {l && (
        <div style={{ marginTop: 12, ...grid }}>
          <Stat label="Appel" value={<span style={{ fontSize: 14 }}>{l.method} {l.route}</span>} sub={l.path !== l.route ? l.path : null} />
          <Stat label="Réponse" value={<StatusCode code={l.status_code} />} sub={l.error_code ?? 'Sans erreur'} />
          <Stat label="Durée" value={fmtMs(l.duration_ms)} sub={fmtDateTime(l.created_at)} />
          <Stat label="Compte" value={result.organization
            ? (onOpenAccount ? <button onClick={() => onOpenAccount(result.organization.accountId)} style={{ ...linkBtn, fontSize: 14 }}>{result.organization.name}</button> : result.organization.name)
            : '—'}
            sub={`${l.environment === 'LIVE' ? 'Production' : 'Test'} · clé ${l.api_key_id ?? '—'} · IP ${l.ip ?? '—'}`} />
        </div>
      )}
    </Card>
  )
}

export function StatusCode({ code }) {
  const color = code >= 500 ? '#dc2626' : code === 429 ? '#7c3aed' : code >= 400 ? '#d97706' : '#16a34a'
  return <span style={{ fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{code}</span>
}

// ── Comptes API ─────────────────────────────────────────────────────────────
function OrganizationsSection({ organizations, onOpenAccount }) {
  return (
    <Card title={`Comptes API (${organizations.length})`} icon={<Building2 size={15} />} hint="Activité du jour en production">
      {organizations.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun compte n'utilise encore l'API.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>{['Compte', 'Réglages', 'Clés actives', 'Appels', 'Erreurs', 'Livraisons', 'Alertes', 'Dernier appel'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {organizations.map(o => (
                <tr key={o.id} onClick={() => onOpenAccount?.(o.accountId)} style={{ borderBottom: '1px solid var(--border)', cursor: onOpenAccount ? 'pointer' : 'default' }} title="Ouvrir la fiche (onglet API)">
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    {o.group && !o.isGroupHead && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Groupe {o.group}</div>}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {o.status === 'SUSPENDED' && <Chip color="#dc2626">Suspendu</Chip>}
                      {o.enterprise && <Chip color="#0f766e">Entreprise</Chip>}
                      {o.isGroupHead && <Chip color="#0077b6">Tête de groupe</Chip>}
                      {o.customQuotas && <Chip color="#7c3aed">Quotas sur mesure</Chip>}
                      {o.ipRestricted && <Chip color="#475569">IP limitées</Chip>}
                      {o.status !== 'SUSPENDED' && !o.enterprise && !o.isGroupHead && !o.customQuotas && !o.ipRestricted && <span style={{ color: 'var(--text-muted)' }}>Standard</span>}
                    </div>
                  </td>
                  <td style={td}>{o.activeKeys}</td>
                  <td style={td}>{fmtNum(o.requestsToday)}</td>
                  <td style={{ ...td, color: o.errorsToday ? 'var(--danger)' : undefined }}>{fmtNum(o.errorsToday)}</td>
                  <td style={td}>{fmtNum(o.deliveriesToday)}</td>
                  <td style={td}>{o.openAlerts > 0 ? <Chip color="#dc2626">{o.openAlerts} ouverte{o.openAlerts > 1 ? 's' : ''}</Chip> : '—'}</td>
                  <td style={td}>{fmtDateTime(o.lastUsedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Seuils ──────────────────────────────────────────────────────────────────
function ThresholdsSection({ monitoring: m, isSuper, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function start() {
    setValues(Object.fromEntries(THRESHOLD_FIELDS.map(([k]) => [k, String(m.thresholds[k])])))
    setError(''); setEditing(true)
  }

  async function save(e) {
    e.preventDefault()
    const patch = {}
    for (const [k] of THRESHOLD_FIELDS) {
      const v = Number(String(values[k]).replace(',', '.'))
      if (!Number.isFinite(v)) { setError('Chaque seuil doit être un nombre.'); return }
      if (v !== m.thresholds[k]) patch[k] = v
    }
    if (Object.keys(patch).length === 0) { setEditing(false); return }
    setBusy(true); setError('')
    try {
      await api.patch('/admin/api/monitoring/thresholds', patch)
      setEditing(false); onSaved()
    } catch (err) { setError(errMsg(err, 'Enregistrement impossible.')) } finally { setBusy(false) }
  }

  async function resetAll() {
    setBusy(true); setError('')
    try {
      await api.patch('/admin/api/monitoring/thresholds', Object.fromEntries(THRESHOLD_FIELDS.map(([k]) => [k, null])))
      setEditing(false); onSaved()
    } catch (err) { setError(errMsg(err, 'Enregistrement impossible.')) } finally { setBusy(false) }
  }

  return (
    <Card title="Seuils d'alerte" icon={<ShieldCheck size={15} />}
      action={isSuper && !editing && <button onClick={start} style={btnSmall}>Modifier</button>}>
      <form onSubmit={save}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>{['Mesure', 'Seuil', 'Par défaut', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {THRESHOLD_FIELDS.map(([k, label, unit, help]) => {
                const [min, max] = m.limits[k] ?? []
                const changed = m.thresholds[k] !== m.defaults[k]
                return (
                  <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      {help && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{help}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {editing ? (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <input type="number" min={min} max={max} step="any" value={values[k]} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))}
                            style={{ ...glassInput, width: 110, padding: '6px 9px' }} aria-label={label} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span>
                        </label>
                      ) : (
                        <span style={{ fontWeight: 700 }}>{fmtNum(m.thresholds[k])} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span></span>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtNum(m.defaults[k])} {unit}</td>
                    <td style={td}>{changed && !editing && <Chip color="#7c3aed">Modifié</Chip>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
        {editing && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={resetAll} disabled={busy} style={btnOutline}>Tout remettre par défaut</button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} style={btnOutline}>Annuler</button>
            <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        )}
      </form>
    </Card>
  )
}

// ── Petits composants ───────────────────────────────────────────────────────
function Card({ title, icon, hint, action, children }) {
  return (
    <div style={{ ...glass, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {icon && <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>{icon}</span>}
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{title}</h3>
        {hint && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</span>}
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.55)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? 'var(--text)', marginTop: 3, overflowWrap: 'anywhere' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{sub}</div>}
    </div>
  )
}

function Chip({ color, children }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color + '18', color, whiteSpace: 'nowrap' }}>{children}</span>
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }
const th = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'rgba(255,255,255,.6)', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }
const btnSmall = { ...btnOutline, padding: '5px 10px', fontSize: 12 }
const linkBtn = { background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
