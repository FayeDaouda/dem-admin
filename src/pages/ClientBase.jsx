import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search, Phone, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import WhatsAppButton from '../components/WhatsAppButton'

// ── Base de données Clients (CM / CRM Client, M11 — ex-Relances › Client) ───
// Qui relancer, d'où vient chaque client, où il en est. Le statut est calculé
// (Jamais servi / Actif / Inactif / Fidèle) ; le CM note la source quand
// elle n'est pas connue, la prochaine action et une ligne de note.
// GET /admin/client-base (filtres et pages côté serveur), PATCH /admin/client-base/:id.
const FILTERS = [
  ['', 'Tous'], ['relancer', 'À relancer'], ['jamais', 'Jamais servis'], ['inactifs', 'Inactifs 30 j'],
  ['semaine', 'Inscrits cette semaine'], ['fideles', 'Fidèles'],
]
const STATUS_COLORS = { NEVER_SERVED: '#64748b', ACTIVE: '#0077b6', INACTIVE: '#d97706', LOYAL: '#16a34a' }
const ACTION_COLORS = { TO_CALL: '#dc2626', CALLED: '#0077b6', CONVERTED: '#16a34a', DO_NOT_CALL: '#64748b' }
const LIMIT = 50

const fmt = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—')

export default function ClientBase() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = canSee(user?.adminRole, ACTION_ROLES.clientFollowup) // Super + CM
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.some(([k]) => k === params.get('filtre')) ? params.get('filtre') : ''
  const source = params.get('source') ?? ''
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [errors, setErrors] = useState({})
  const [segment, setSegment] = useState(null) // { name } : « Créer un segment » (C3)
  const [segmentMsg, setSegmentMsg] = useState('')

  async function createSegment() {
    setSegmentMsg('')
    try {
      const { data: r } = await api.post('/admin/cm/segments', { name: segment.name, filter: { filter, source, q: query } })
      setSegment(null)
      setSegmentMsg(`Segment « ${r.segment.name} » créé (${r.segment.size} client${r.segment.size > 1 ? 's' : ''}) : choisissez-le dans Notifications › Envoyer.`)
    } catch (e) { setSegmentMsg(e.response?.data?.message ?? 'Création impossible.') }
  }

  useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [search])

  const load = useCallback(() => api.get('/admin/client-base', { params: { filter: filter || undefined, source: source || undefined, q: query || undefined, page, limit: LIMIT } })
    .then(r => setData(r.data)).catch(() => setData(d => d ?? { clients: [], total: 0, counts: {}, sources: {}, nextActions: {}, statusLabels: {} })), [filter, source, query, page])
  useEffect(() => { load() }, [load])

  function setParam(key, value) {
    setPage(1)
    setParams(prev => { const n = new URLSearchParams(prev); if (value) n.set(key, value); else n.delete(key); return n })
  }

  async function save(c, changes) {
    setErrors(e => ({ ...e, [c.id]: null }))
    setData(d => ({ ...d, clients: d.clients.map(x => (x.id === c.id ? { ...x, ...changes, ...(changes.nextAction === 'CALLED' ? { calledAt: new Date().toISOString() } : {}), ...(changes.source ? { sourceLabel: d.sources[changes.source] } : {}) } : x)) }))
    try {
      await api.patch(`/admin/client-base/${c.id}`, changes)
    } catch (e) {
      setErrors(er => ({ ...er, [c.id]: e.response?.data?.message ?? 'Erreur.' }))
      load()
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1
  const editableSources = Object.entries(data?.sources ?? {}).filter(([k]) => k !== 'REFERRAL')

  return (
    <div style={pageWrap}>
      <PageHeader title="Base de données Clients" subtitle="Qui relancer, d'où vient chaque client, où il en est"
        actions={<>
          {canEdit && <button onClick={() => { setSegment({ name: '' }); setSegmentMsg('') }} style={btnOutline}><Users size={14} /> Créer un segment</button>}
          <button onClick={load} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
        </>} />
      {segment && (
        <div style={{ ...glass, padding: 12, marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Segment avec les filtres affichés (sans les bannis ni « Ne plus relancer ») :</span>
          <input autoFocus value={segment.name} maxLength={60} onChange={e => setSegment({ name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && segment.name.trim()) createSegment() }} placeholder="Nom du segment" style={{ ...cellInput, width: 240 }} />
          <button onClick={createSegment} disabled={!segment.name.trim()} style={btnOutline}>Créer</button>
          <button onClick={() => setSegment(null)} style={btnOutline}>Annuler</button>
        </div>
      )}
      {segmentMsg && <div style={{ fontSize: 12.5, fontWeight: 600, color: segmentMsg.startsWith('Segment') ? '#15803d' : 'var(--danger)', marginBottom: 10 }}>{segmentMsg}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 260px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou téléphone…" style={{ ...glassInput, paddingLeft: 36, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setParam('filtre', key)} style={{
              padding: '6px 11px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
              background: filter === key ? 'var(--primary)' : 'transparent', color: filter === key ? '#fff' : 'var(--text-muted)', fontWeight: filter === key ? 700 : 500,
            }}>{label}<span style={{ marginLeft: 5, opacity: 0.8 }}>{key ? (data?.counts?.[key] ?? 0) : (data?.all ?? 0)}</span></button>
          ))}
        </div>
        <select value={source} onChange={e => setParam('source', e.target.value)} style={{ ...glassInput, width: 'auto', padding: '6px 10px', fontSize: 12.5 }}>
          <option value="">Toutes les sources</option>
          {Object.entries(data?.sources ?? {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div style={pageScroll}>
        <div style={{ ...glass, padding: '10px 14px' }}>
          {!data ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          : data.clients.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun client pour ce filtre.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1150, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Client', 'Inscription', 'Commandes', 'Statut', 'Parrainage', 'Prochaine action', 'Note'].map(h => <th key={h} style={{ ...th, ...stickyTh }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={td}>
                        <button onClick={() => navigate(`/clients?q=${encodeURIComponent(c.phone ?? c.name ?? '')}`)} style={linkBtn}>{c.name ?? '—'}</button>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                          {c.phone ?? '—'}
                          {c.phone && <a href={`tel:${c.phone}`} title={`Appeler ${c.phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>}
                          <WhatsAppButton phone={c.phone} compact />
                        </span>
                        {c.banned && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>banni / suspendu</div>}
                        {errors[c.id] && <div style={{ fontSize: 11.5, color: '#dc2626' }}>{errors[c.id]}</div>}
                      </td>
                      <td style={td}>
                        {fmt(c.createdAt)}
                        <div>
                          {c.source === 'REFERRAL' || !canEdit
                            ? <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.sourceLabel}</span>
                            : (
                              <select value={c.source} onChange={e => save(c, { source: e.target.value })} style={{ ...cellInput, marginTop: 3, fontSize: 11.5 }}>
                                {editableSources.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                              </select>
                            )}
                        </div>
                      </td>
                      <td style={td}>
                        <strong>{c.delivered}</strong> livrée{c.delivered > 1 ? 's' : ''}
                        <span style={{ color: 'var(--text-muted)' }}> / {c.orders}</span>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.lastOrderAt ? `dernière ${fmt(c.lastOrderAt)}` : 'jamais commandé'}</div>
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: STATUS_COLORS[c.status], background: `${STATUS_COLORS[c.status]}14`, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{data.statusLabels[c.status] ?? c.status}</span>
                      </td>
                      <td style={td}>
                        {c.referredBy ? <div style={{ fontSize: 12 }}>parrainé par <strong>{c.referredBy.name ?? '—'}</strong></div> : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>}
                        {c.referrals > 0 && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>{c.referrals} filleul{c.referrals > 1 ? 's' : ''}</div>}
                      </td>
                      <td style={td}>
                        <select disabled={!canEdit} value={c.nextAction} onChange={e => save(c, { nextAction: e.target.value })}
                          style={{ ...cellInput, color: ACTION_COLORS[c.nextAction], fontWeight: 700 }}>
                          {Object.entries(data.nextActions).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        {c.nextAction === 'CALLED' && c.calledAt && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>Relancé le {fmt(c.calledAt)}</div>}
                      </td>
                      <td style={td}>
                        <NoteCell key={`${c.id}-${c.note ?? ''}`} value={c.note} disabled={!canEdit} onSave={note => save(c, { note })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.total > LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingTop: 10, fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>{data.total.toLocaleString('fr-FR')} clients · page {page} / {pages}</span>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnOutline}><ChevronLeft size={14} /></button>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={btnOutline}><ChevronRight size={14} /></button>
            </div>
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
    <input value={text} disabled={disabled} maxLength={140} placeholder="ex. préfère WhatsApp"
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
