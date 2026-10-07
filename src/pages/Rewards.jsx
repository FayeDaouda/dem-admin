import { useState, useEffect } from 'react'
import { Gift, Power, CalendarClock, Search, X, History, Sparkles } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'

// ── Centre des récompenses ────────────────────────────────────────────────────
// Décision 06/10 : rien n'est offert automatiquement. Toute récompense passe
// par ici :
//   - Règles : offres automatiques ÉTEINTES par défaut, que l'admin allume,
//     programme (dates) et dont il choisit le type de récompense ;
//   - Attribuer : une récompense à une personne (client, livreur, DEM Pro),
//     tout de suite ou à une date programmée ;
//   - Historique : tout ce qui a été attribué, utilisé, annulé.
// Serveur : modules/rewards (GET /admin/rewards, /admin/rewards/grants…).

const TABS = [
  { key: 'grant', label: 'Attribuer', icon: Gift },
  { key: 'history', label: 'Historique', icon: History },
  { key: 'rules', label: 'Règles automatiques', icon: Power },
]

const ROLE_LABELS = { CLIENT: 'Client', DRIVER: 'Livreur', DEM_PRO: 'DEM Pro', CHEF_DE_FLOTTE: 'Chef de flotte' }
const STATUS = {
  SCHEDULED: { label: 'Programmée', color: '#6366f1' },
  APPLYING: { label: 'En cours', color: '#6366f1' },
  ACTIVE: { label: 'Disponible', color: '#0077b6' },
  APPLIED: { label: 'Appliquée', color: '#16a34a' },
  CANCELLED: { label: 'Annulée', color: '#64748b' },
  FAILED: { label: 'Échec', color: '#dc2626' },
}
const RULE_TYPES = [
  { key: 'FREE_COURSE', label: 'Course offerte' },
  { key: 'PERCENT_OFF', label: 'Réduction en %' },
  { key: 'FIXED_OFF', label: 'Réduction en F' },
]

const fmt = d => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const toLocalInput = d => {
  if (!d) return ''
  const x = new Date(d)
  const p = n => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`
}

export default function Rewards() {
  const [tab, setTab] = useState('grant')
  const [meta, setMeta] = useState(null)
  const [metaVersion, setMetaVersion] = useState(0)
  const [historyVersion, setHistoryVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/admin/rewards').then(r => { if (!cancelled) setMeta(r.data) }).catch(() => {})
    return () => { cancelled = true }
  }, [metaVersion])

  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} color="var(--primary)" /> Récompenses
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Rien n'est offert automatiquement : vous attribuez chaque récompense, ou vous activez une règle, avec ses dates.
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {TABS.map(t => {
            const Icon = t.icon
            const on = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--primary)' : 'transparent',
                color: on ? '#fff' : 'var(--text-muted)', fontWeight: on ? 700 : 500,
              }}><Icon size={14} /> {t.label}</button>
            )
          })}
        </div>
      </div>
      <div style={pageScroll}>
        {!meta ? (
          <div style={{ color: 'var(--text-muted)', padding: 30 }}>Chargement…</div>
        ) : tab === 'grant' ? (
          <GrantForm meta={meta} onGranted={() => { setHistoryVersion(v => v + 1); setTab('history') }} />
        ) : tab === 'history' ? (
          <HistoryTab key={historyVersion} />
        ) : (
          <RulesTab rules={meta.rules} onSaved={() => setMetaVersion(v => v + 1)} />
        )}
      </div>
    </div>
  )
}

// ── Attribuer ─────────────────────────────────────────────────────────────────
function GrantForm({ meta, onGranted }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [user, setUser] = useState(null)
  const [type, setType] = useState('')
  const [value, setValue] = useState('')
  const [uses, setUses] = useState('1')
  const [when, setWhen] = useState('now')
  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [reason, setReason] = useState('GESTURE')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || user) return undefined
    const t = setTimeout(() => {
      api.get('/admin/promotions/users-search', { params: { search: q } })
        .then(r => setResults(Array.isArray(r.data) ? r.data : (r.data?.users ?? [])))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query, user])

  const types = meta.types.filter(t => !user || t.roles.includes(user.role))
  const typeDef = meta.types.find(t => t.key === type)
  const isDays = type === 'FORFAIT_DAYS' || type === 'PRO_PLAN_DAYS'
  const needsValue = type === 'COURSE_PERCENT' || type === 'COURSE_FIXED' || isDays
  const isCourse = type.startsWith('COURSE_')

  function pick(u) {
    setUser(u); setResults([]); setQuery(u.name ?? u.phone)
    setType(''); setValue('')
  }

  const summary = !user || !type ? null : (() => {
    const v = Number(value)
    const what = {
      COURSE_FREE: `${uses > 1 ? `${uses} courses offertes` : '1 course offerte'}`,
      COURSE_PERCENT: `-${v || '…'} % sur ${uses > 1 ? `${uses} courses` : '1 course'}`,
      COURSE_FIXED: `-${v || '…'} F sur ${uses > 1 ? `${uses} courses` : '1 course'}`,
      FORFAIT_DAYS: `passe livreur offerte ${v || '…'} jour(s)`,
      PRO_PLAN_DAYS: `${v || '…'} jour(s) d'offre DEM Pro`,
    }[type]
    return `${user.name ?? user.phone} recevra : ${what}${when === 'later' && startsAt ? `, le ${fmt(startsAt)}` : ', tout de suite'}.`
  })()

  async function submit() {
    setBusy(true); setError('')
    try {
      await api.post('/admin/rewards/grants', {
        userId: user.id, type, reason,
        value: needsValue ? Number(value) : undefined,
        uses: isCourse ? Number(uses) : undefined,
        startsAt: when === 'later' && startsAt ? new Date(startsAt).toISOString() : undefined,
        expiresAt: isCourse && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        note: note.trim() || undefined,
      })
      onGranted()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  const ready = user && type && (!needsValue || Number(value) > 0) && (when === 'now' || startsAt)

  return (
    <div style={{ ...glass, padding: 22, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="1. Bénéficiaire">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input value={query} onChange={e => { setQuery(e.target.value); setUser(null) }} placeholder="Nom ou numéro (client, livreur, DEM Pro)"
            style={{ ...glassInput, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} />
          {results.length > 0 && (
            <div style={{ ...glass, position: 'absolute', zIndex: 5, left: 0, right: 0, top: 40, padding: 4 }}>
              {results.map(u => (
                <button key={u.id} onClick={() => pick(u)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                  <span><strong>{u.name ?? '—'}</strong> · {u.phone}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{ROLE_LABELS[u.role] ?? u.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {user && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{ROLE_LABELS[user.role] ?? user.role} sélectionné.</div>}
      </Field>

      <Field label="2. Type de récompense">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {types.map(t => (
            <button key={t.key} disabled={!user} onClick={() => setType(t.key)} style={{
              padding: '8px 12px', borderRadius: 10, fontSize: 13, cursor: user ? 'pointer' : 'default',
              border: `1.5px solid ${type === t.key ? 'var(--primary)' : 'rgba(0,119,182,.15)'}`,
              background: type === t.key ? 'rgba(0,180,230,.08)' : 'rgba(255,255,255,.5)',
              color: type === t.key ? 'var(--primary)' : 'var(--text)', fontWeight: 600, opacity: user ? 1 : 0.5,
            }}>{t.label}</button>
          ))}
        </div>
        {!user && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Choisissez d'abord le bénéficiaire : les types dépendent de son compte.</div>}
        {typeDef && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            {needsValue && (
              <Small label={type === 'COURSE_PERCENT' ? 'Pourcentage' : type === 'COURSE_FIXED' ? 'Montant (F)' : 'Nombre de jours'}>
                <input type="number" min={1} value={value} onChange={e => setValue(e.target.value)} style={{ ...glassInput, width: 110 }} />
              </Small>
            )}
            {isCourse && (
              <Small label="Nombre de courses">
                <input type="number" min={1} max={20} value={uses} onChange={e => setUses(e.target.value)} style={{ ...glassInput, width: 90 }} />
              </Small>
            )}
            {isCourse && (
              <Small label="À utiliser avant (optionnel)">
                <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={glassInput} />
              </Small>
            )}
          </div>
        )}
      </Field>

      <Field label="3. Quand">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[['now', 'Tout de suite'], ['later', 'Programmer']].map(([k, l]) => (
            <button key={k} onClick={() => setWhen(k)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
              border: `1.5px solid ${when === k ? 'var(--primary)' : 'rgba(0,119,182,.15)'}`,
              background: when === k ? 'rgba(0,180,230,.08)' : 'rgba(255,255,255,.5)', color: when === k ? 'var(--primary)' : 'var(--text)',
            }}>{k === 'later' && <CalendarClock size={14} />}{l}</button>
          ))}
          {when === 'later' && (
            <input type="datetime-local" value={startsAt} min={toLocalInput(new Date())} onChange={e => setStartsAt(e.target.value)} style={glassInput} />
          )}
        </div>
      </Field>

      <Field label="4. Motif">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={reason} onChange={e => setReason(e.target.value)} style={glassInput}>
            {meta.reasons.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Note interne (optionnelle)"
            style={{ ...glassInput, flex: '1 1 220px' }} />
        </div>
      </Field>

      {summary && <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,180,230,.07)', fontSize: 13 }}>{summary} Il sera prévenu par notification.</div>}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      <div>
        <button onClick={submit} disabled={!ready || busy} style={{ ...btnPrimary, opacity: !ready || busy ? 0.6 : 1 }}>
          <Gift size={14} /> {busy ? 'Attribution…' : when === 'later' ? 'Programmer la récompense' : 'Attribuer la récompense'}
        </button>
      </div>
    </div>
  )
}

// ── Historique ────────────────────────────────────────────────────────────────
function HistoryTab() {
  const [status, setStatus] = useState('')
  const [data, setData] = useState(null)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/admin/rewards/grants', { params: { status: status || undefined, limit: 100 } })
      .then(r => { if (!cancelled) setData(r.data) })
      .catch(e => { if (!cancelled) setError(e.response?.data?.message ?? 'Erreur de chargement.') })
    return () => { cancelled = true }
  }, [status, version])

  async function cancel(g) {
    if (!confirm(`Annuler « ${g.label} » pour ${g.user?.name ?? g.user?.phone} ?`)) return
    try {
      await api.post(`/admin/rewards/grants/${g.id}/cancel`)
      setVersion(v => v + 1)
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['', 'Toutes'], ['SCHEDULED', 'Programmées'], ['ACTIVE', 'Disponibles'], ['APPLIED', 'Appliquées'], ['CANCELLED', 'Annulées']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: status === k ? 'none' : '1px solid var(--border)', background: status === k ? 'var(--primary)' : 'transparent',
            color: status === k ? '#fff' : 'var(--text-muted)',
          }}>{l}</button>
        ))}
      </div>
      <div style={{ ...glass, padding: '6px 14px', overflowX: 'auto' }}>
        {error ? <div style={{ color: 'var(--danger)', padding: 16 }}>{error}</div>
          : !data ? <div style={{ color: 'var(--text-muted)', padding: 16 }}>Chargement…</div>
            : data.grants.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: 16 }}>Aucune récompense.</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                  <thead><tr>{['Bénéficiaire', 'Récompense', 'Motif', 'Effet', 'Statut', 'Attribuée par', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.grants.map(g => {
                      const st = STATUS[g.status] ?? { label: g.status, color: '#64748b' }
                      return (
                        <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={td}><strong>{g.user?.proBusinessName || g.user?.name || '—'}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.user?.phone} · {ROLE_LABELS[g.role] ?? g.role}</div></td>
                          <td style={td}>{g.label}
                            {g.usedCount != null && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Utilisée {g.usedCount}/{g.uses}{g.discountGiven > 0 ? ` · ${Math.round(g.discountGiven).toLocaleString('fr-FR')} F offerts` : ''}</div>}</td>
                          <td style={td}>{g.reasonLabel}{g.note && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.note}</div>}</td>
                          <td style={td}>{fmt(g.startsAt)}{g.expiresAt && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>avant le {fmt(g.expiresAt)}</div>}</td>
                          <td style={td}><span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span>{g.error && <div style={{ fontSize: 11, color: 'var(--danger)' }}>{g.error}</div>}</td>
                          <td style={td}>{g.grantedBy?.name ?? '—'}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(g.createdAt)}</div></td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            {['SCHEDULED', 'ACTIVE'].includes(g.status) && (g.usedCount == null || g.usedCount < g.uses) && (
                              <button onClick={() => cancel(g)} style={btnOutline}><X size={13} /> Annuler</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
      </div>
    </div>
  )
}

// ── Règles automatiques ───────────────────────────────────────────────────────
function RulesTab({ rules, onSaved }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        Ces offres ne s'appliquent que si vous les activez, et seulement entre les dates choisies.
        Tout le reste (promotions, parrainages, gestes commerciaux) passe par « Attribuer » ou par la page Promotions.
      </div>
      {rules.map(r => <RuleCard key={r.name} rule={r} onSaved={onSaved} />)}
    </div>
  )
}

function RuleCard({ rule, onSaved }) {
  const isTrial = rule.name === 'DEM_PRO_TRIAL'
  const [draft, setDraft] = useState({
    active: rule.active, startsAt: toLocalInput(rule.startsAt), endsAt: toLocalInput(rule.endsAt),
    firstClients: String(rule.firstClients ?? 100), type: rule.type ?? 'FREE_COURSE', value: rule.value == null ? '' : String(rule.value),
    days: String(rule.days ?? 7), plan: rule.plan ?? 'BUSINESS',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  async function save(patch = {}) {
    const next = { ...draft, ...patch }
    const who = isTrial ? 'Les commerçants DEM Pro validés sans offre pourront lancer l\'essai' : 'Les clients concernés recevront la réduction automatiquement'
    if (patch.active === true && !confirm(`Activer « ${rule.label} » ? ${who}${next.endsAt ? ` jusqu'au ${fmt(next.endsAt)}` : ''}.`)) return
    setBusy(true); setError('')
    try {
      const dates = {
        active: next.active,
        startsAt: next.startsAt ? new Date(next.startsAt).toISOString() : null,
        endsAt: next.endsAt ? new Date(next.endsAt).toISOString() : null,
      }
      await api.put(`/admin/rewards/rules/${rule.name}`, isTrial
        ? { ...dates, days: Number(next.days), plan: next.plan }
        : { ...dates, firstClients: Number(next.firstClients), type: next.type, value: next.type === 'FREE_COURSE' ? null : Number(next.value) })
      setDraft(next)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ ...glass, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{rule.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isTrial
              ? `Proposé une fois aux commerçants DEM Pro validés sans offre : ${draft.days || '…'} jours de ${draft.plan[0] + draft.plan.slice(1).toLowerCase()} gratuits.`
              : `Pour la 2e commande des ${draft.firstClients || '…'} premiers clients inscrits. Éteinte depuis le 06/10 (était automatique avant).`}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: draft.active ? '#16a34a' : '#64748b' }}>{draft.active ? 'Active' : 'Éteinte'}</span>
        <button onClick={() => save({ active: !draft.active })} disabled={busy} style={draft.active ? btnOutline : btnPrimary}>
          <Power size={13} /> {draft.active ? 'Éteindre' : 'Activer'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {isTrial ? (<>
          <Small label="Durée (jours)">
            <input type="number" min={1} max={60} value={draft.days} onChange={e => set('days', e.target.value)} style={{ ...glassInput, width: 90 }} />
          </Small>
          <Small label="Offre essayée">
            <select value={draft.plan} onChange={e => set('plan', e.target.value)} style={glassInput}>
              {['STARTER', 'BUSINESS', 'PREMIUM'].map(p => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
            </select>
          </Small>
        </>) : (<>
        <Small label="Premiers clients">
          <input type="number" min={1} value={draft.firstClients} onChange={e => set('firstClients', e.target.value)} style={{ ...glassInput, width: 90 }} />
        </Small>
        <Small label="Récompense">
          <select value={draft.type} onChange={e => set('type', e.target.value)} style={glassInput}>
            {RULE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Small>
        {draft.type !== 'FREE_COURSE' && (
          <Small label={draft.type === 'PERCENT_OFF' ? 'Pourcentage' : 'Montant (F)'}>
            <input type="number" min={1} value={draft.value} onChange={e => set('value', e.target.value)} style={{ ...glassInput, width: 100 }} />
          </Small>
        )}
        </>)}
        <Small label="Du (optionnel)">
          <input type="datetime-local" value={draft.startsAt} onChange={e => set('startsAt', e.target.value)} style={glassInput} />
        </Small>
        <Small label="Au (optionnel)">
          <input type="datetime-local" value={draft.endsAt} onChange={e => set('endsAt', e.target.value)} style={glassInput} />
        </Small>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => save()} disabled={busy} style={btnOutline}>Enregistrer les réglages</button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

function Small({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
      {label}{children}
    </label>
  )
}

const th = { textAlign: 'left', padding: '8px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td = { padding: '10px 8px', verticalAlign: 'top', fontSize: 13 }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
