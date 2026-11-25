import { useEffect, useState } from 'react'
import { Search, X, Plus, Check } from 'lucide-react'
import api from '../../lib/api'
import { TARGET_LABELS } from '../../lib/broadcastTargets'

// Envoi à des personnes choisies une par une (cible « users:<id>,… ») :
// recherche par nom, entreprise ou numéro dans les profils ouverts au rôle
// (GET /admin/broadcast/recipients — le serveur les borne lui aussi).
// value : [{ id, name, phone, profile, canReceive }]

const MAX_PICKED = 500

export default function RecipientPicker({ profiles, value, onChange }) {
  const [profile, setProfile] = useState('')
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      setLoading(true)
      api.get('/admin/broadcast/recipients', { params: { profile: profile || undefined, q: q.trim() || undefined } })
        .then(r => { if (alive) { setResults(r.data?.recipients ?? []); setError('') } })
        .catch(e => { if (alive) { setResults([]); setError(e.response?.data?.message ?? 'Recherche impossible.') } })
        .finally(() => { if (alive) setLoading(false) })
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [profile, q])

  const pickedIds = new Set(value.map(v => v.id))
  const add = (r) => { if (!pickedIds.has(r.id) && value.length < MAX_PICKED) onChange([...value, r]) }
  const remove = (id) => onChange(value.filter(v => v.id !== id))
  const addAll = () => onChange([...value, ...results.filter(r => !pickedIds.has(r.id))].slice(0, MAX_PICKED))
  const noApp = value.filter(v => !v.canReceive).length

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Filtre par profil */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {[['', 'Tous les profils'], ...profiles.map(p => [p, TARGET_LABELS[p] ?? p])].map(([val, lbl]) => (
          <button
            key={val || 'all'}
            type="button"
            aria-pressed={profile === val}
            onClick={() => setProfile(val)}
            style={{ ...chip, ...(profile === val ? chipOn : {}) }}
          >{lbl}</button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Nom, entreprise ou numéro"
          aria-label="Rechercher une personne"
          style={{ ...input, paddingLeft: 34 }}
        />
      </div>

      {/* Résultats */}
      <div style={{ border: '1px solid rgba(0,119,182,.15)', borderRadius: 10, maxHeight: 220, overflowY: 'auto', background: 'rgba(255,255,255,.5)' }}>
        {error ? <div style={{ ...empty, color: 'var(--danger)' }}>{error}</div>
          : loading && results.length === 0 ? <div style={empty}>Recherche…</div>
          : results.length === 0 ? <div style={empty}>{q.trim().length >= 2 ? 'Personne ne correspond.' : 'Tapez au moins 2 caractères, ou choisissez parmi les plus récents.'}</div>
          : results.map(r => {
            const picked = pickedIds.has(r.id)
            return (
              <div key={r.id} style={row}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || 'Sans nom'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {TARGET_LABELS[r.profile] ?? r.profile} · {r.phone ?? '—'}{!r.canReceive && <span style={{ color: '#b45309' }}> · notifications non activées</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (picked ? remove(r.id) : add(r))}
                  aria-label={picked ? `Retirer ${r.name ?? r.phone}` : `Ajouter ${r.name ?? r.phone}`}
                  style={{ ...smallBtn, ...(picked ? { color: 'var(--success)', borderColor: 'rgba(16,185,129,.4)' } : {}) }}
                >
                  {picked ? <><Check size={13} /> Ajouté</> : <><Plus size={13} /> Ajouter</>}
                </button>
              </div>
            )
          })}
      </div>
      {results.length > 1 && results.some(r => !pickedIds.has(r.id)) && (
        <button type="button" onClick={addAll} style={{ ...linkBtn, marginTop: 6 }}>Ajouter les {results.filter(r => !pickedIds.has(r.id)).length} résultats</button>
      )}

      {/* Personnes choisies */}
      {value.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{value.length} personne{value.length > 1 ? 's' : ''} choisie{value.length > 1 ? 's' : ''}</span>
            <button type="button" onClick={() => onChange([])} style={linkBtn}>Tout retirer</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
            {value.map(v => (
              <span key={v.id} style={tag}>
                {v.name || v.phone || 'Sans nom'}
                <button type="button" onClick={() => remove(v.id)} aria-label={`Retirer ${v.name ?? v.phone}`} style={tagX}><X size={12} /></button>
              </span>
            ))}
          </div>
          {noApp > 0 && (
            <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 6 }}>
              {noApp} sans notifications activées : {noApp > 1 ? 'elles ne recevront' : 'elle ne recevra'} rien.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const input   = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const chip    = { padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const chipOn  = { background: 'var(--primary)', color: '#fff', borderColor: 'transparent' }
const row     = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(0,119,182,.08)' }
const empty   = { padding: '14px 12px', fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }
const smallBtn = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }
const linkBtn = { background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }
const tag     = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 10px', borderRadius: 999, background: 'rgba(0,180,230,.1)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }
const tagX    = { display: 'flex', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }
