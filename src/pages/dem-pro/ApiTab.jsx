import { useState, useEffect, useCallback } from 'react'
import { Plus, Copy, Check, RotateCcw, Power, Ban, KeyRound, AlertTriangle, Search, Building2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import InfoTip from '../../components/InfoTip'
import InlineConfirm from '../../components/InlineConfirm'
import { AlertRow, StatusCode } from './ApiMonitoringTab'

// Onglet « API » de la fiche DEM Pro — API DEM partenaires (/v1) du compte :
// accès (offre Premium ou contrat Entreprise, suspension par DEM), alertes,
// réglages Entreprise (IP autorisées, limites, groupe), usage, journal des
// appels, clés, adresses webhook et derniers envois. Lecture : SUPER + SC ;
// clés, suspension et réglages : SUPER (vérifié aussi côté serveur, voir
// admin.routes.js /dem-pro/:id/api).

const SCOPES = [
  ['quotes:read',       'Devis'],
  ['deliveries:create', 'Créer des livraisons'],
  ['deliveries:read',   'Lire les livraisons'],
  ['deliveries:cancel', 'Annuler des livraisons'],
  ['tracking:read',     'Suivi'],
  ['webhooks:manage',   'Gérer les webhooks'],
]
const SCOPE_LABELS = Object.fromEntries(SCOPES)
const DEFAULT_SCOPES = ['quotes:read', 'deliveries:create', 'deliveries:read', 'tracking:read']

const REASON_LABELS = {
  ACCOUNT_INACTIVE:       'Compte DEM Pro inactif (non validé, suspendu ou supprimé)',
  API_ACCESS_DISABLED:    "Non incluse dans l'offre actuelle (Premium requis)",
  ORGANIZATION_SUSPENDED: 'Accès API suspendu par DEM',
}
const KEY_STATUS = {
  ACTIVE:   ['Active', '#16a34a'],
  DISABLED: ['Désactivée', '#d97706'],
  REVOKED:  ['Révoquée', '#dc2626'],
}
const MSG_STATUS = {
  PENDING:   ['En attente', '#d97706'],
  SUCCEEDED: ['Reçu', '#16a34a'],
  FAILED:    ['Échec', '#dc2626'],
}
const EVENT_LABELS = {
  'delivery.created':           'Livraison créée',
  'delivery.driver_assigned':   'Coursier trouvé',
  'delivery.driver_unassigned': 'Coursier retiré',
  'delivery.picked_up':         'Colis récupéré',
  'delivery.in_transit':        'En route',
  'delivery.delivered':         'Livrée',
  'delivery.cancelled':         'Annulée',
  'delivery.failed':            'Échouée',
}

// Erreurs réseau renvoyées par le serveur lors d'un envoi webhook
const SEND_ERRORS = {
  EPRIVATEADDR: 'Adresse non publique (refusée)',
  ENOTFOUND:    'Adresse introuvable',
  ECONNREFUSED: 'Connexion refusée',
  ECONNRESET:   'Connexion coupée',
  ETIMEDOUT:    'Délai dépassé',
  CERT_HAS_EXPIRED: 'Certificat https expiré',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'Certificat https non valide',
}
const sendError = (e) => SEND_ERRORS[e] ?? e

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'
const errMsg = (e, fallback) => e.response?.data?.message ?? fallback

export default function ApiTab({ accountId, canManage }) {
  const [state, setState] = useState(null) // { key, overview?, webhooks?, error? }
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion(v => v + 1), [])
  const reqKey = `${accountId}|${version}`

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get(`/admin/dem-pro/${accountId}/api`),
      api.get(`/admin/dem-pro/${accountId}/api/webhooks`).catch(() => ({ data: { endpoints: [], messages: [] } })),
      api.get(`/admin/dem-pro/${accountId}/api/alerts`).catch(() => ({ data: { alerts: [] } })),
      api.get(`/admin/dem-pro/${accountId}/api/enterprise`).catch(() => ({ data: null })),
    ])
      .then(([o, w, a, ent]) => {
        if (!cancelled) setState({ key: reqKey, overview: o.data, webhooks: w.data, alerts: a.data.alerts, enterprise: ent.data })
      })
      .catch(e => {
        if (cancelled) return
        const notDeployed = e.response?.status === 404
        setState({ key: reqKey, error: notDeployed ? 'L\'API DEM n\'est pas encore disponible sur le serveur.' : errMsg(e, 'Erreur de chargement.') })
      })
    return () => { cancelled = true }
  }, [accountId, reqKey])

  if (!state || (state.key !== reqKey && !state.overview)) return <Muted>Chargement…</Muted>
  if (state.error) return <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>{state.error}</div>

  const { overview: o, webhooks: w, alerts, enterprise } = state
  const activeKeys = o.keys.filter(k => k.status === 'ACTIVE')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <AccessSection accountId={accountId} overview={o} activeKeys={activeKeys.length} canManage={canManage} onChanged={reload} />
      {alerts.length > 0 && <AccountAlertsSection alerts={alerts} onChanged={reload} />}
      {enterprise && <EnterpriseSection accountId={accountId} data={enterprise} canManage={canManage} onChanged={reload} />}
      {o.usage && <UsageSection usage={o.usage} />}
      {o.organization && <LogsSection accountId={accountId} version={version} />}
      <KeysSection accountId={accountId} overview={o} canManage={canManage} onChanged={reload} />
      <WebhooksSection endpoints={w.endpoints} max={o.limits?.maxWebhookEndpoints ?? 3} />
      <MessagesSection accountId={accountId} messages={w.messages} onChanged={reload} />
    </div>
  )
}

// ── Accès et quotas ─────────────────────────────────────────────────────────
function AccessSection({ accountId, overview: o, activeKeys, canManage, onChanged }) {
  const [confirm, setConfirm] = useState(false)
  const [editQuotas, setEditQuotas] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const suspended = o.organization?.status === 'SUSPENDED'

  async function toggle() {
    setBusy(true); setError('')
    try {
      await api.patch(`/admin/dem-pro/${accountId}/api/status`, { status: suspended ? 'ACTIVE' : 'SUSPENDED' })
      setConfirm(false); onChanged()
    } catch (e) { setError(errMsg(e, 'Action impossible.')) } finally { setBusy(false) }
  }

  return (
    <Section title="Accès API" action={canManage && o.organization && (
      <button onClick={() => setConfirm(true)} style={suspended ? btnPrimary : btnDanger}>
        <Power size={13} /> {suspended ? 'Rétablir l\'accès' : 'Suspendre l\'accès'}
      </button>
    )}>
      <div style={grid4}>
        <Stat label="Accès" value={o.available ? 'Ouvert' : 'Fermé'} color={o.available ? 'var(--success)' : 'var(--danger)'}
          sub={o.available ? 'Les clés actives fonctionnent' : (REASON_LABELS[o.reason] ?? o.reason)} />
        {o.enterprise
          ? <Stat label="Offre" value="Entreprise" color="#0f766e" sub={`Contrat DEM${o.plan ? ` · palier ${o.plan}` : ''}`} />
          : <Stat label="Offre" value={o.plan ?? '—'} sub="L'API est incluse dans Premium" />}
        <QuotaStat overview={o} canManage={canManage} onEdit={() => setEditQuotas(true)} />
        <Stat label="Clés actives" value={activeKeys} sub={o.organization ? `Organisation ${o.organization.id}` : 'Aucune clé créée'} />
      </div>
      {editQuotas && (
        <QuotaForm accountId={accountId} overview={o}
          onCancel={() => setEditQuotas(false)}
          onSaved={() => { setEditQuotas(false); onChanged() }} />
      )}
      {confirm && (
        <InlineConfirm
          lines={suspended
            ? ['Rétablir l\'accès API de ce compte ?', 'Ses clés actives fonctionneront de nouveau tout de suite.']
            : ['Suspendre l\'accès API de ce compte ?', 'Toutes ses clés seront refusées immédiatement (erreur ORGANIZATION_SUSPENDED). Ses courses en cours ne sont pas touchées.']}
          confirmLabel={suspended ? 'Rétablir' : 'Suspendre'} danger={!suspended} busy={busy}
          onConfirm={toggle} onCancel={() => setConfirm(false)} />
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Section>
  )
}

// ── Quotas : valeurs de l'offre ou sur mesure pour ce compte ────────────────
function QuotaStat({ overview: o, canManage, onEdit }) {
  const custom = o.organization && (o.organization.requestsPerMinute != null || o.organization.deliveriesPerDay != null)
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Quotas</span>
        {custom && <Chip color="#7c3aed">Sur mesure</Chip>}
        {canManage && <button onClick={onEdit} style={{ ...btnGhostSmall, marginLeft: 'auto', padding: '2px 8px' }} title="Quotas sur mesure pour ce compte">Ajuster</button>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{o.quotas.requestsPerMinute} / min</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{o.quotas.deliveriesPerDay} livraisons / jour</div>
    </div>
  )
}

function QuotaForm({ accountId, overview: o, onCancel, onSaved }) {
  const plan = o.planQuotas ?? o.quotas
  const [rpm, setRpm] = useState(o.organization?.requestsPerMinute ?? '')
  const [perDay, setPerDay] = useState(o.organization?.deliveriesPerDay ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toValue = (v) => (v === '' || v == null ? null : Number(v))

  async function save(body) {
    setBusy(true); setError('')
    try {
      await api.patch(`/admin/dem-pro/${accountId}/api/quotas`, body)
      onSaved()
    } catch (e) { setError(errMsg(e, 'Enregistrement impossible.')) } finally { setBusy(false) }
  }

  return (
    <form style={{ ...formBox, marginTop: 12 }} onSubmit={e => { e.preventDefault(); save({ requestsPerMinute: toValue(rpm), deliveriesPerDay: toValue(perDay) }) }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Quotas sur mesure pour ce compte</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Laissez vide pour garder la valeur de l'offre {o.plan ?? ''} ({plan.requestsPerMinute} appels / min, {plan.deliveriesPerDay} livraisons / jour). Effet immédiat.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={lbl}>Appels par minute
          <input type="number" min={1} max={10000} step={1} value={rpm} placeholder={`${plan.requestsPerMinute} (offre)`} onChange={e => setRpm(e.target.value)} style={input} />
        </label>
        <label style={lbl}>Livraisons par jour
          <input type="number" min={1} max={100000} step={1} value={perDay} placeholder={`${plan.deliveriesPerDay} (offre)`} onChange={e => setPerDay(e.target.value)} style={input} />
        </label>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => save({ requestsPerMinute: null, deliveriesPerDay: null })} disabled={busy} style={btnGhost}>Revenir à l'offre</button>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Annuler</button>
        <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

// ── Alertes du compte ───────────────────────────────────────────────────────
function AccountAlertsSection({ alerts, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const open = alerts.filter(a => a.status === 'OPEN')

  async function ack(a) {
    setBusyId(a.id); setError('')
    try {
      await api.post(`/admin/api/alerts/${a.id}/ack`)
      onChanged()
    } catch (e) { setError(errMsg(e, 'Action impossible.')) } finally { setBusyId(null) }
  }

  return (
    <Section title="Alertes" hint={open.length ? `${open.length} ouverte${open.length > 1 ? 's' : ''} · 30 derniers jours` : '30 derniers jours'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map(a => <AlertRow key={a.id} alert={a} hideAccount
          action={a.status === 'OPEN' && (a.acknowledgedAt
            ? <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Vue le {fmtDate(a.acknowledgedAt)}</span>
            : <button onClick={() => ack(a)} disabled={busyId === a.id} style={btnGhostSmall}>{busyId === a.id ? '…' : 'Marquer comme vue'}</button>)} />)}
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
    </Section>
  )
}

// ── Entreprise : contrat, IP autorisées, limites, groupe ────────────────────
// Valeurs standard du serveur (api.service MAX_KEYS_PER_ORG, api.webhooks MAX_ENDPOINTS_PER_ENV)
const STANDARD_LIMITS = { maxKeys: 10, maxWebhookEndpoints: 3 }

function EnterpriseSection({ accountId, data, canManage, onChanged }) {
  const [editing, setEditing] = useState(false)
  const org = data.organization
  const ips = org?.allowedIps ?? []
  const group = data.group ?? { parent: null, members: [] }
  const inGroup = group.members.length > 0
  const configured = org && (org.enterprise || ips.length > 0 || inGroup || org.maxKeys != null || org.maxWebhookEndpoints != null)
  if (!canManage && !configured) return null

  return (
    <Section title="Entreprise" hint="Grands comptes sous contrat (ex. Orange › Max Store)"
      action={canManage && !editing && <button onClick={() => setEditing(true)} style={btnGhostSmall}>{configured ? 'Modifier' : 'Configurer'}</button>}>
      {editing ? (
        <EnterpriseForm accountId={accountId} data={data} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }} />
      ) : (
        <>
          <div style={grid4}>
            <Stat label="Contrat Entreprise" value={org?.enterprise ? 'Oui' : 'Non'} color={org?.enterprise ? '#0f766e' : undefined}
              sub={org?.enterprise ? (data.note || 'Accès API par contrat, quel que soit le palier') : 'Accès API selon l\'offre DEM Pro'} />
            <Stat label="Adresses IP autorisées" value={ips.length ? `${ips.length} règle${ips.length > 1 ? 's' : ''}` : 'Toutes'}
              sub={ips.length ? <span style={mono}>{ips.slice(0, 3).join(', ')}{ips.length > 3 ? '…' : ''}</span> : 'Aucune restriction'} />
            <Stat label="Limites" value={`${data.limits.maxKeys} clés`}
              sub={`${data.limits.maxWebhookEndpoints} adresses webhook / environnement${org?.maxKeys != null || org?.maxWebhookEndpoints != null ? ' · sur mesure' : ''}`} />
            <Stat label="Groupe" value={inGroup ? group.parent?.name ?? '—' : 'Aucun'}
              sub={inGroup ? (group.parent?.isCurrent ? `Tête du groupe · ${group.members.length} compte${group.members.length > 1 ? 's' : ''} rattaché${group.members.length > 1 ? 's' : ''}` : 'Ce compte est rattaché à ce groupe') : 'Compte indépendant'} />
          </div>
          {inGroup && <GroupTable group={group} />}
        </>
      )}
    </Section>
  )
}

function GroupTable({ group }) {
  const rows = [group.parent, ...group.members].filter(Boolean)
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Compte du groupe', 'Rôle', 'Accès', 'Appels aujourd\'hui', 'Livraisons aujourd\'hui'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={td}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {r.isCurrent && <span style={{ marginLeft: 6 }}><Chip color="#0077b6">Ce compte</Chip></span>}
                <div style={mono}>{r.id}</div>
              </td>
              <td style={td}>{r.isHead ? 'Tête du groupe' : 'Rattaché'}</td>
              <td style={td}>
                {r.status === 'SUSPENDED' ? <Chip color="#dc2626">Suspendu</Chip> : r.enterprise ? <Chip color="#0f766e">Entreprise</Chip> : <Chip color="#16a34a">Standard</Chip>}
              </td>
              <td style={td}>{r.requestsToday.toLocaleString('fr-FR')}</td>
              <td style={td}>{r.deliveriesToday.toLocaleString('fr-FR')}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total du groupe (production)</td>
            <td style={{ ...td, fontWeight: 700 }}>{group.totals.requestsToday.toLocaleString('fr-FR')}</td>
            <td style={{ ...td, fontWeight: 700 }}>{group.totals.deliveriesToday.toLocaleString('fr-FR')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function EnterpriseForm({ accountId, data, onCancel, onSaved }) {
  const org = data.organization
  const group = data.group ?? { parent: null, members: [] }
  const isHead = group.parent?.isCurrent && group.members.length > 0
  const currentParent = group.parent && !group.parent.isCurrent ? group.parent.accountId : ''

  const [enterprise, setEnterprise] = useState(org?.enterprise ?? false)
  const [note, setNote] = useState(data.note ?? '')
  const [ips, setIps] = useState((org?.allowedIps ?? []).join('\n'))
  const [maxKeys, setMaxKeys] = useState(org?.maxKeys ?? '')
  const [maxHooks, setMaxHooks] = useState(org?.maxWebhookEndpoints ?? '')
  const [parent, setParent] = useState(currentParent)
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/admin/api/organizations')
      .then(r => { if (!cancelled) setCandidates(r.data.organizations.filter(o => o.accountId !== accountId && (!o.group || o.isGroupHead))) })
      .catch(() => { if (!cancelled) setCandidates([]) })
    return () => { cancelled = true }
  }, [accountId])

  const toValue = (v) => (v === '' || v == null ? null : Number(v))
  const ipList = ips.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)

  async function save(e) {
    e.preventDefault()
    const body = {}
    if (enterprise !== (org?.enterprise ?? false)) body.enterprise = enterprise
    if ((note.trim() || null) !== (data.note ?? null)) body.enterpriseNote = note.trim() || null
    if (ipList.join('|') !== (org?.allowedIps ?? []).join('|')) body.allowedIps = ipList
    if (toValue(maxKeys) !== (org?.maxKeys ?? null)) body.maxKeys = toValue(maxKeys)
    if (toValue(maxHooks) !== (org?.maxWebhookEndpoints ?? null)) body.maxWebhookEndpoints = toValue(maxHooks)
    if (!isHead && parent !== currentParent) body.parentAccountId = parent || null
    if (Object.keys(body).length === 0) { onCancel(); return }
    setBusy(true); setError('')
    try {
      await api.patch(`/admin/dem-pro/${accountId}/api/settings`, body)
      onSaved()
    } catch (err) { setError(errMsg(err, 'Enregistrement impossible.')) } finally { setBusy(false) }
  }

  return (
    <form style={formBox} onSubmit={save}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 12 }}>
        <input type="checkbox" checked={enterprise} onChange={e => setEnterprise(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Contrat Entreprise</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
            L'API reste ouverte quel que soit le palier DEM Pro (le compte doit rester actif). Réglez ses quotas dans « Quotas › Ajuster ».
          </span>
        </span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Référence du contrat, contact (visible dans l'admin seulement)
          <input value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="Ex. Contrat Orange › Max Store 2026 — contact technique" style={input} />
        </label>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Adresses IP autorisées
          <textarea value={ips} onChange={e => setIps(e.target.value)} rows={3} spellCheck={false}
            placeholder={'Une par ligne, ex.\n196.207.224.10\n41.82.0.0/16'} style={{ ...input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical' }} />
          <span style={{ fontWeight: 400 }}>
            Vide = toutes les adresses. Sinon, tout appel venant d'une autre adresse est refusé (erreur IP_NOT_ALLOWED) : à remplir avec les serveurs du partenaire, effet immédiat.
            {ipList.length > 0 && ` ${ipList.length} règle${ipList.length > 1 ? 's' : ''}.`}
          </span>
        </label>
        <label style={lbl}>Clés actives au maximum
          <input type="number" min={1} max={100} step={1} value={maxKeys} placeholder={`${STANDARD_LIMITS.maxKeys} (standard)`} onChange={e => setMaxKeys(e.target.value)} style={input} />
        </label>
        <label style={lbl}>Adresses webhook par environnement
          <input type="number" min={1} max={20} step={1} value={maxHooks} placeholder={`${STANDARD_LIMITS.maxWebhookEndpoints} (standard)`} onChange={e => setMaxHooks(e.target.value)} style={input} />
        </label>
        <label style={{ ...lbl, gridColumn: '1 / -1' }}>Groupe
          {isHead ? (
            <span style={{ fontWeight: 400 }}>Ce compte est la tête d'un groupe ({group.members.length} compte{group.members.length > 1 ? 's' : ''} rattaché{group.members.length > 1 ? 's' : ''}) : il ne peut pas rejoindre un autre groupe.</span>
          ) : (
            <>
              <select value={parent} onChange={e => setParent(e.target.value)} disabled={!candidates} style={input}>
                <option value="">Aucun groupe (compte indépendant)</option>
                {(candidates ?? []).map(c => <option key={c.accountId} value={c.accountId}>{c.name}{c.isGroupHead ? ' (tête de groupe)' : ''}</option>)}
              </select>
              <span style={{ fontWeight: 400 }}>Rattache ce compte à la tête de son groupe (ex. Max Store → Orange) : activité consolidée dans les deux fiches. Chaque compte garde ses clés, ses quotas et ses livraisons.</span>
            </>
          )}
        </label>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Annuler</button>
        <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

// ── Journal des appels ──────────────────────────────────────────────────────
const LOG_STATUS = [
  ['',        'Toutes les réponses'],
  ['success', 'Réussis'],
  ['errors',  'Toutes les erreurs'],
  ['4xx',     'Refusés (4xx)'],
  ['429',     'Limite atteinte (429)'],
  ['5xx',     'Erreurs serveur (5xx)'],
]

function LogsSection({ accountId, version }) {
  const [filters, setFilters] = useState({ environment: '', status: '', request_id: '', route: '' })
  const [draft, setDraft] = useState({ request_id: '', route: '' })
  const [page, setPage] = useState(null) // { key, logs, next, error? }
  const [more, setMore] = useState(false)
  const [copied, setCopied] = useState(null)
  const reqKey = `${accountId}|${version}|${JSON.stringify(filters)}`

  const params = useCallback((before) => Object.fromEntries(
    Object.entries({ ...filters, before, limit: 25 }).filter(([, v]) => v),
  ), [filters])

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/dem-pro/${accountId}/api/logs`, { params: params() })
      .then(r => { if (!cancelled) setPage({ key: reqKey, logs: r.data.logs, next: r.data.next_before }) })
      .catch(e => { if (!cancelled) setPage({ key: reqKey, logs: [], next: null, error: errMsg(e, 'Journal indisponible.') }) })
    return () => { cancelled = true }
  }, [accountId, reqKey, params])

  async function loadMore() {
    setMore(true)
    try {
      const r = await api.get(`/admin/dem-pro/${accountId}/api/logs`, { params: params(page.next) })
      setPage(p => ({ ...p, logs: [...p.logs, ...r.data.logs], next: r.data.next_before }))
    } catch (e) { setPage(p => ({ ...p, error: errMsg(e, 'Journal indisponible.') })) } finally { setMore(false) }
  }

  function copy(rid) {
    navigator.clipboard?.writeText(rid).then(() => { setCopied(rid); setTimeout(() => setCopied(null), 1500) }).catch(() => {})
  }

  const loading = page?.key !== reqKey
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <Section title="Journal des appels" hint="30 derniers jours · appels faits avec une clé valide">
      <form onSubmit={e => { e.preventDefault(); setFilters(f => ({ ...f, request_id: draft.request_id.trim(), route: draft.route.trim() })) }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={filters.environment} onChange={e => setFilter('environment', e.target.value)} style={{ ...input, flex: '0 1 150px' }} aria-label="Environnement">
          <option value="">Production et test</option>
          <option value="LIVE">Production</option>
          <option value="TEST">Test</option>
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ ...input, flex: '0 1 190px' }} aria-label="Réponse">
          {LOG_STATUS.map(([k, label]) => <option key={k || 'all'} value={k}>{label}</option>)}
        </select>
        <input value={draft.route} onChange={e => setDraft(d => ({ ...d, route: e.target.value }))} placeholder="Route (ex. deliveries)" style={{ ...input, flex: '1 1 150px' }} aria-label="Route" />
        <input value={draft.request_id} onChange={e => setDraft(d => ({ ...d, request_id: e.target.value }))} placeholder="request_id" spellCheck={false}
          style={{ ...input, flex: '1 1 190px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} aria-label="request_id" />
        <button type="submit" style={btnGhostSmall}><Search size={12} /> Filtrer</button>
      </form>

      {page?.error && <ErrorLine>{page.error}</ErrorLine>}
      {!page || (loading && page.logs.length === 0) ? <Muted small>Chargement…</Muted>
        : page.logs.length === 0 ? <Muted small>Aucun appel {filters.status || filters.environment || filters.request_id || filters.route ? 'pour ces filtres' : 'enregistré pour l\'instant'}.</Muted> : (
          <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>{['Heure', 'Appel', 'Réponse', 'Durée', 'Clé', 'IP', 'request_id'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {page.logs.map(l => (
                  <tr key={l.request_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      <div><Chip color={l.environment === 'LIVE' ? '#0077b6' : '#7c3aed'}>{l.environment === 'LIVE' ? 'Production' : 'Test'}</Chip></div>
                    </td>
                    <td style={td}>
                      <span style={methodTag}>{l.method}</span> <span style={{ fontWeight: 600 }}>{l.route}</span>
                      {l.path !== l.route && <div style={mono}>{l.path}</div>}
                    </td>
                    <td style={td}>
                      <StatusCode code={l.status_code} />
                      {l.error_code && <div style={{ ...mono, color: 'var(--danger)' }}>{l.error_code}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtMs(l.duration_ms)}</td>
                    <td style={td}><span style={mono}>{l.api_key_id ?? '—'}</span></td>
                    <td style={td}><span style={mono}>{l.ip ?? '—'}</span></td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span style={mono}>{l.request_id}</span>
                      <button type="button" onClick={() => copy(l.request_id)} style={iconBtn} title="Copier">
                        {copied === l.request_id ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {page?.next && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <button onClick={loadMore} disabled={more} style={btnGhostSmall}>{more ? 'Chargement…' : 'Afficher les appels plus anciens'}</button>
        </div>
      )}
    </Section>
  )
}

// ── Usage ───────────────────────────────────────────────────────────────────
const fmtMs = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`)
const TOOLTIP_STYLE = {
  background: '#ffffff', border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
}

function UsageSection({ usage }) {
  // Production par défaut ; Test si le compte n'a encore servi qu'en test
  const hasLive = usage.live.last7d.requests > 0
  const [env, setEnv] = useState(hasLive || usage.test.last7d.requests === 0 ? 'live' : 'test')
  const u = usage[env]
  const t = u.today
  const failed = t.clientErrors + t.rateLimited + t.serverErrors
  const wh = usage.webhooks7d
  const chart = u.daily.map(d => ({
    label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }),
    Réussies: d.success,
    Erreurs: d.clientErrors + d.rateLimited + d.serverErrors,
  }))

  return (
    <Section title="Usage de l'API" hint="Aujourd'hui (heure de Dakar) et 7 derniers jours"
      action={
        <div style={{ display: 'flex', gap: 4 }}>
          {[['live', 'Production'], ['test', 'Test']].map(([k, label]) => (
            <button key={k} onClick={() => setEnv(k)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: env === k ? 'none' : '1px solid var(--border)',
              background: env === k ? 'var(--primary)' : 'transparent', color: env === k ? '#fff' : 'var(--text-muted)',
            }}>{label}</button>
          ))}
        </div>
      }>
      <div style={grid4}>
        <Stat label="Appels aujourd'hui" value={t.requests}
          sub={t.requests ? `${t.success} réussis · ${failed} en erreur` : 'Aucun appel'} />
        <Stat label="Erreurs aujourd'hui" value={failed} color={t.serverErrors > 0 ? 'var(--danger)' : undefined}
          sub={`${t.clientErrors} requêtes refusées · ${t.rateLimited} limite · ${t.serverErrors} serveur`} />
        <Stat label="Temps de réponse" value={fmtMs(t.avgLatencyMs)}
          sub={`p95 ≤ ${fmtMs(t.p95LatencyMs)} · p99 ≤ ${fmtMs(t.p99LatencyMs)}`} />
        <Stat label="Livraisons créées" value={t.deliveries}
          sub={`${u.last7d.deliveries} sur 7 jours · ${t.quotes} devis aujourd'hui`} />
        <Stat label="Webhooks (7 jours)" value={wh.successRate == null ? '—' : `${wh.successRate} %`}
          color={wh.successRate != null && wh.successRate < 95 ? 'var(--danger)' : undefined}
          sub={`${wh.succeeded} reçus · ${wh.failed} en échec · ${wh.pending} en attente`} />
      </div>
      {u.last7d.requests > 0 && (
        <div style={{ marginTop: 12, height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,119,182,.06)' }} />
              <Bar dataKey="Réussies" stackId="a" fill="#0077b6" />
              <Bar dataKey="Erreurs" stackId="a" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  )
}

// ── Clés ────────────────────────────────────────────────────────────────────
function KeysSection({ accountId, overview: o, canManage, onChanged }) {
  const [creating, setCreating] = useState(false)
  const [secret, setSecret] = useState(null) // { secret, name }
  const [pending, setPending] = useState(null) // { key, action }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    const { key, action } = pending
    setBusy(true); setError('')
    try {
      if (action === 'revoke') await api.post(`/admin/dem-pro/${accountId}/api/keys/${key.id}/revoke`)
      else await api.patch(`/admin/dem-pro/${accountId}/api/keys/${key.id}`, { status: action === 'disable' ? 'DISABLED' : 'ACTIVE' })
      setPending(null); onChanged()
    } catch (e) { setError(errMsg(e, 'Action impossible.')) } finally { setBusy(false) }
  }

  const confirmLines = pending && ({
    revoke:  [`Révoquer la clé « ${pending.key.name} » ?`, 'Définitif : le site qui l\'utilise ne pourra plus appeler l\'API. Il faudra lui donner une nouvelle clé.'],
    disable: [`Désactiver la clé « ${pending.key.name} » ?`, 'Ses appels seront refusés jusqu\'à sa réactivation.'],
    enable:  [`Réactiver la clé « ${pending.key.name} » ?`, ''],
  })[pending.action]

  return (
    <Section title="Clés API" hint="La clé complète n'est montrée qu'une fois, à sa création"
      action={canManage && o.available && !secret && (
        <button onClick={() => setCreating(true)} style={btnPrimary}><Plus size={13} /> Nouvelle clé</button>
      )}>
      {secret && <SecretBox secret={secret} onDone={() => setSecret(null)} />}
      {creating && (
        <NewKeyForm accountId={accountId}
          onCancel={() => setCreating(false)}
          onCreated={(s) => { setCreating(false); setSecret(s); onChanged() }} />
      )}
      {o.keys.length === 0 ? (
        <Muted small>{o.available ? 'Aucune clé. Le commerçant peut en créer depuis son app, ou un SUPER ici.' : 'Aucune clé.'}</Muted>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Clé', 'Environnement', 'Droits', 'Statut', 'Dernière utilisation', 'Créée le', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {o.keys.map(k => {
                const [label, color] = KEY_STATUS[k.status] ?? [k.status, '#64748b']
                const expired = k.status === 'ACTIVE' && k.expiresAt && new Date(k.expiresAt) <= new Date()
                return (
                  <tr key={k.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>
                      <strong>{k.name}</strong>
                      <div style={mono}>{k.prefix}…</div>
                    </td>
                    <td style={td}><Chip color={k.environment === 'LIVE' ? '#0077b6' : '#7c3aed'}>{k.environment === 'LIVE' ? 'Production' : 'Test'}</Chip></td>
                    <td style={{ ...td, maxWidth: 220 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {k.scopes.map(s => <span key={s} style={scopeTag}>{SCOPE_LABELS[s] ?? s}</span>)}
                      </div>
                    </td>
                    <td style={td}>
                      <Chip color={expired ? '#dc2626' : color}>{expired ? 'Expirée' : label}</Chip>
                      {k.expiresAt && !expired && k.status === 'ACTIVE' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Expire le {fmtDate(k.expiresAt)}</div>}
                    </td>
                    <td style={td}>{k.lastUsedAt ? fmtDate(k.lastUsedAt) : <span style={{ color: 'var(--text-muted)' }}>Jamais</span>}</td>
                    <td style={td}>{fmtDate(k.createdAt)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {canManage && k.status !== 'REVOKED' && (
                        <>
                          {k.status === 'ACTIVE'
                            ? <button title="Désactiver" style={iconBtn} onClick={() => setPending({ key: k, action: 'disable' })}><Power size={14} /></button>
                            : <button title="Réactiver" style={iconBtn} onClick={() => setPending({ key: k, action: 'enable' })}><RotateCcw size={14} /></button>}
                          <button title="Révoquer" style={{ ...iconBtn, color: 'var(--danger)' }} onClick={() => setPending({ key: k, action: 'revoke' })}><Ban size={14} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {pending && (
        <InlineConfirm lines={confirmLines} busy={busy} danger={pending.action === 'revoke'}
          confirmLabel={{ revoke: 'Révoquer', disable: 'Désactiver', enable: 'Réactiver' }[pending.action]}
          onConfirm={run} onCancel={() => setPending(null)} />
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Section>
  )
}

function NewKeyForm({ accountId, onCancel, onCreated }) {
  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState('LIVE')
  const [scopes, setScopes] = useState(DEFAULT_SCOPES)
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggleScope = (s) => setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const body = { name: name.trim(), environment, scopes, ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString() } : {}) }
      const r = await api.post(`/admin/dem-pro/${accountId}/api/keys`, body)
      onCreated({ secret: r.data.secret, name: r.data.key.name })
    } catch (e2) { setError(errMsg(e2, 'Création impossible.')) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} style={formBox}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={lbl}>Nom de la clé
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Site WooCommerce" maxLength={60} required minLength={2} style={input} />
        </label>
        <label style={lbl}>Environnement
          <select value={environment} onChange={e => setEnvironment(e.target.value)} style={input}>
            <option value="LIVE">Production — vraies courses</option>
            <option value="TEST">Test — aucune course réelle</option>
          </select>
        </label>
        <label style={lbl}>Expiration (facultatif)
          <input type="date" value={expiresAt} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={e => setExpiresAt(e.target.value)} style={input} />
        </label>
      </div>
      <div style={{ ...lbl, marginTop: 12 }}>Droits de la clé
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {SCOPES.map(([s, label]) => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: scopes.includes(s) ? 'rgba(0,119,182,.08)' : 'transparent' }}>
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} /> {label}
            </label>
          ))}
        </div>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Annuler</button>
        <button type="submit" disabled={busy || scopes.length === 0 || name.trim().length < 2} style={{ ...btnPrimary, opacity: busy ? 0.7 : 1 }}>
          <KeyRound size={13} /> {busy ? 'Création…' : 'Créer la clé'}
        </button>
      </div>
    </form>
  )
}

function SecretBox({ secret, onDone }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(secret.secret); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* copie refusée par le navigateur */ }
  }
  return (
    <div style={{ ...formBox, borderColor: 'rgba(217,119,6,.4)', background: 'rgba(217,119,6,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
        <AlertTriangle size={15} color="#d97706" /> Clé « {secret.name} » créée — copiez-la maintenant
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
        Elle ne sera plus jamais affichée. Transmettez-la au commerçant par un moyen sûr ; en cas de perte, révoquez-la et créez-en une autre.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ ...mono, fontSize: 13, flex: 1, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, wordBreak: 'break-all', userSelect: 'all' }}>{secret.secret}</code>
        <button onClick={copy} style={btnPrimary}>{copied ? <><Check size={13} /> Copiée</> : <><Copy size={13} /> Copier</>}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button onClick={onDone} style={btnGhost}>J'ai copié la clé</button>
      </div>
    </div>
  )
}

// ── Webhooks ────────────────────────────────────────────────────────────────
function WebhooksSection({ endpoints, max }) {
  return (
    <Section title="Adresses webhook" hint={`Déclarées par le partenaire via l'API (${max} max par environnement)`}>
      {endpoints.length === 0 ? <Muted small>Aucune adresse webhook.</Muted> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Adresse', 'Environnement', 'Événements', 'Statut', 'Dernier succès', 'Dernier échec'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {endpoints.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...td, maxWidth: 260, wordBreak: 'break-all' }}><span style={mono}>{e.url}</span>{e.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.description}</div>}</td>
                  <td style={td}><Chip color={e.livemode ? '#0077b6' : '#7c3aed'}>{e.livemode ? 'Production' : 'Test'}</Chip></td>
                  <td style={td} title={e.events.map(x => EVENT_LABELS[x] ?? x).join(', ')}>{e.events.length} type{e.events.length > 1 ? 's' : ''}</td>
                  <td style={td}><Chip color={e.status === 'ACTIVE' ? '#16a34a' : '#64748b'}>{e.status === 'ACTIVE' ? 'Active' : 'Désactivée'}</Chip></td>
                  <td style={td}>{fmtDate(e.last_success_at)}</td>
                  <td style={{ ...td, color: e.last_failure_at ? 'var(--danger)' : undefined }}>{fmtDate(e.last_failure_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function MessagesSection({ accountId, messages, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const failed = messages.filter(m => m.status === 'FAILED').length

  async function resend(m) {
    setBusyId(m.id); setError('')
    try {
      await api.post(`/admin/dem-pro/${accountId}/api/webhooks/${m.endpoint_id}/messages/${m.id}/resend`)
      onChanged()
    } catch (e) { setError(errMsg(e, 'Renvoi impossible.')) } finally { setBusyId(null) }
  }

  return (
    <Section title="Derniers envois webhook" hint={failed > 0 ? `${failed} en échec — « Renvoyer » les remet en file (envoi sous 15 s)` : 'Relances automatiques : 30 s, 2 min, 10 min, 30 min, 2 h, 6 h'}>
      {messages.length === 0 ? <Muted small>Aucun envoi pour l'instant.</Muted> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Événement', 'Statut', 'Essais', 'Dernière réponse', 'Prochain essai', 'Créé le', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {messages.map(m => {
                const [label, color] = MSG_STATUS[m.status] ?? [m.status, '#64748b']
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{EVENT_LABELS[m.event_type] ?? m.event_type}<div style={mono}>{m.event_id}</div></td>
                    <td style={td}><Chip color={color}>{label}</Chip></td>
                    <td style={td}>{m.attempts}</td>
                    <td style={{ ...td, color: m.last_error ? 'var(--danger)' : undefined }}>
                      {m.last_status_code ? `HTTP ${m.last_status_code}` : (m.last_error ? sendError(m.last_error) : '—')}
                    </td>
                    <td style={td}>{m.next_attempt_at ? fmtDate(m.next_attempt_at) : '—'}</td>
                    <td style={td}>{fmtDate(m.created_at)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => resend(m)} disabled={busyId === m.id} style={btnGhostSmall}
                        title={m.status === 'SUCCEEDED' ? 'Renvoyer le même événement' : 'Réessayer maintenant'}>
                        <RotateCcw size={12} /> {busyId === m.id ? '…' : 'Renvoyer'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Section>
  )
}

// ── Petits composants (même style que la fiche) ─────────────────────────────
function Section({ title, hint, action, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)' }}>{title}<InfoTip k={title} size={12} /></h3>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
        {action && <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? 'var(--text)', marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Chip({ color, children }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color + '18', color, whiteSpace: 'nowrap' }}>{children}</span>
}

const Muted = ({ children, small }) => <div style={{ color: 'var(--text-muted)', fontSize: small ? 13 : 14, textAlign: small ? 'left' : 'center', padding: small ? 0 : 30 }}>{children}</div>
const ErrorLine = ({ children }) => <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{children}</div>

const grid4   = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }
const th      = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td      = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
const mono    = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: 'var(--text-muted)' }
const scopeTag = { fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const formBox = { border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }
const lbl     = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }
const input   = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnDanger  = { ...btnPrimary, background: 'var(--danger)' }
const btnGhost   = { padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnGhostSmall = { ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', fontSize: 11.5 }
const methodTag  = { fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, borderRadius: 6, display: 'inline-flex' }
