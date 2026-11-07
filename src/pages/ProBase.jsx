import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Search, Phone } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import PageHeader from '../components/PageHeader'
import WhatsAppButton from '../components/WhatsAppButton'

// ── Base de données Pro (Commercial / CRM Pro, M11 — ex-Relances) ───────────
// Un tableau de tri, pas un CRM : sur qui travailler, qui rappeler, qui est
// viable. Le suivi détaillé des appels reste dans TAM. Chaque nouveau compte
// Pro arrive seul, « À appeler ». GET /admin/pro-base, PATCH /admin/pro-base/:id.
const VIABILITY = [['', '—'], ['HOT', 'Chaud'], ['WARM', 'Tiède'], ['COLD', 'Froid'], ['NOT_VIABLE', 'Non viable']]
const VIABILITY_COLORS = { HOT: '#dc2626', WARM: '#f97316', COLD: '#0ea5e9', NOT_VIABLE: '#64748b' }
const ACTIONS = [['TO_CALL', 'À appeler'], ['CALL_BACK', 'À rappeler le…'], ['ACCOMPANY_FIRST', 'Accompagner 1re course'], ['REGULAR', 'Suivi régulier'], ['NONE', 'Rien']]
const ACTION_ORDER = Object.fromEntries(ACTIONS.map(([k], i) => [k, i]))
const PLAN_LABELS = { FREE: 'Gratuit', STARTER: 'Starter', BUSINESS: 'Business', PREMIUM: 'Premium', PRO: 'Pro' }

const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
const FILTERS = [
  { key: 'all',      label: 'Tous',                 test: () => true },
  { key: 'today',    label: 'À rappeler aujourd\'hui', test: p => p.nextAction === 'TO_CALL' || (p.nextAction === 'CALL_BACK' && p.nextActionDate && new Date(p.nextActionDate) <= endOfToday()) },
  { key: 'HOT',      label: 'Chaud',                test: p => p.viability === 'HOT' },
  { key: 'WARM',     label: 'Tiède',                test: p => p.viability === 'WARM' },
  { key: 'COLD',     label: 'Froid',                test: p => p.viability === 'COLD' },
  { key: 'NOT_VIABLE', label: 'Non viable',         test: p => p.viability === 'NOT_VIABLE' },
  { key: 'never',    label: 'Jamais commandé',      test: p => p.orders === 0 },
  { key: 'trial',    label: 'Essai en cours',       test: p => p.inTrial },
]

const toInputDate = d => (d ? new Date(d).toISOString().slice(0, 10) : '')
const fmt = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—')

export default function ProBase() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = canSee(user?.adminRole, ACTION_ROLES.proCreate) // Super + Commercial
  const [pros, setPros] = useState(null)
  const [filter, setFilter] = useState('today')
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState({})

  const load = useCallback(() => api.get('/admin/pro-base').then(r => setPros(r.data?.pros ?? [])).catch(() => setPros([])), [])
  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  async function save(p, changes) {
    setErrors(e => ({ ...e, [p.id]: null }))
    setPros(list => list.map(x => (x.id === p.id ? { ...x, ...changes } : x)))
    try {
      await api.patch(`/admin/pro-base/${p.id}`, changes)
    } catch (e) {
      setErrors(er => ({ ...er, [p.id]: e.response?.data?.message ?? 'Erreur.' }))
      load()
    }
  }

  const rows = useMemo(() => {
    if (!pros) return []
    const q = search.trim().toLowerCase()
    const test = FILTERS.find(f => f.key === filter).test
    return pros
      .filter(p => !q || [p.proBusinessName, p.name, p.phone].some(x => (x ?? '').toLowerCase().includes(q)))
      .filter(test)
      // Tri : prochaine action, puis date (rappel, sinon inscription)
      .sort((a, b) => (ACTION_ORDER[a.nextAction] - ACTION_ORDER[b.nextAction])
        || (new Date(a.nextActionDate ?? a.createdAt) - new Date(b.nextActionDate ?? b.createdAt)))
  }, [pros, filter, search])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.key, (pros ?? []).filter(f.test).length])), [pros])

  return (
    <div style={pageWrap}>
      <PageHeader title="Base de données Pro" subtitle="Sur qui travailler, qui rappeler, qui est viable — le suivi détaillé des appels se note dans TAM"
        actions={<button onClick={load} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 280px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Entreprise, contact, téléphone…" style={{ ...glassInput, paddingLeft: 36, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '6px 11px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
              background: filter === f.key ? 'var(--primary)' : 'transparent', color: filter === f.key ? '#fff' : 'var(--text-muted)', fontWeight: filter === f.key ? 700 : 500,
            }}>{f.label}<span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[f.key] ?? 0}</span></button>
          ))}
        </div>
      </div>

      <div style={pageScroll}>
        <div style={{ ...glass, padding: '10px 14px' }}>
          {!pros ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          : rows.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun Pro pour ce filtre.</div>
          : (
            <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Entreprise', 'Téléphone', 'Plan', 'Commandes', 'Viabilité', 'Prochaine action', 'Note'].map(h => <th key={h} style={{ ...th, ...stickyTh }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                    <td style={td}>
                      <button onClick={() => navigate(`/dem-pro?fiche=${p.id}`)} style={linkBtn}>{p.proBusinessName ?? p.name ?? '—'}</button>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{[p.proBusinessName && p.name, p.proSector].filter(Boolean).join(' · ')}{p.proStatus === 'PENDING' ? ' · en attente de validation' : ''}{p.suspended ? ' · suspendu' : ''}</div>
                      {errors[p.id] && <div style={{ fontSize: 11.5, color: '#dc2626' }}>{errors[p.id]}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        {p.phone ?? '—'}
                        {p.phone && <a href={`tel:${p.phone}`} title={`Appeler ${p.phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>}
                        <WhatsAppButton phone={p.phone} compact />
                      </span>
                    </td>
                    <td style={td}>
                      {PLAN_LABELS[p.plan] ?? p.plan}
                      {p.inTrial && <div style={{ fontSize: 11.5, color: '#7c3aed' }}>en essai jusqu'au {fmt(p.planEndsAt)}</div>}
                    </td>
                    <td style={td}>
                      <strong>{p.orders}</strong>{p.active && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: '#15803d' }}>ACTIF</span>}
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.lastOrderAt ? `dernière ${fmt(p.lastOrderAt)}` : 'jamais'}</div>
                    </td>
                    <td style={td}>
                      <select disabled={!canEdit} value={p.viability ?? ''} onChange={e => save(p, { viability: e.target.value || null })}
                        style={{ ...cellInput, color: VIABILITY_COLORS[p.viability] ?? 'var(--text)', fontWeight: p.viability ? 700 : 400 }}>
                        {VIABILITY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <select disabled={!canEdit} value={p.nextAction} onChange={e => {
                        const nextAction = e.target.value
                        if (nextAction === 'CALL_BACK') {
                          const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                          save(p, { nextAction, nextActionDate: new Date(`${toInputDate(p.nextActionDate) || tomorrow}T09:00:00`).toISOString() })
                        } else save(p, { nextAction })
                      }} style={cellInput}>
                        {ACTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      {p.nextAction === 'CALL_BACK' && (
                        <input type="date" disabled={!canEdit} value={toInputDate(p.nextActionDate)}
                          onChange={e => e.target.value && save(p, { nextActionDate: new Date(`${e.target.value}T09:00:00`).toISOString() })}
                          style={{ ...cellInput, marginTop: 4 }} />
                      )}
                    </td>
                    <td style={td}>
                      <NoteCell key={`${p.id}-${p.note ?? ''}`} value={p.note} disabled={!canEdit} onSave={note => save(p, { note })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// Une ligne, enregistrée en quittant le champ (remontée par `key` quand la valeur change)
function NoteCell({ value, disabled, onSave }) {
  const [text, setText] = useState(value ?? '')
  return (
    <input value={text} disabled={disabled} maxLength={120} placeholder="ex. rappeler après 15h"
      onChange={e => setText(e.target.value)}
      onBlur={() => { if ((value ?? '') !== text.trim()) onSave(text.trim()) }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      style={{ ...cellInput, width: 220 }} />
  )
}

const th = { textAlign: 'left', padding: '8px 8px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const td = { padding: '8px 8px', fontSize: 13 }
const cellInput = { ...glassInput, padding: '5px 8px', fontSize: 12.5, width: 'auto', boxSizing: 'border-box' }
const linkBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 13, textAlign: 'left' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
