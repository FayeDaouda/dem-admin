import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { glassInput } from '../lib/glassStyles'

// Notes internes datées (fiche coursier, fiche course) — visibles de l'équipe
// admin seulement, jamais du client ni du coursier. `endpoint` : GET la liste,
// POST { text } ; `Section` : la section de la fiche (titre).
export default function InternalNotes(props) {
  const { endpoint, placeholder, Section } = props
  const [notes, setNotes] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => api.get(endpoint)
    .then(r => setNotes(r.data?.notes ?? []))
    .catch(e => setError(e.response?.data?.message ?? 'Notes indisponibles.')), [endpoint])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true); setError('')
    try {
      await api.post(endpoint, { text: text.trim() })
      setText('')
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <Section title="Notes internes">
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder={placeholder}
          style={{ ...glassInput, padding: '7px 10px', fontSize: 13, flex: 1, boxSizing: 'border-box' }} />
        <button type="submit" disabled={saving || !text.trim()} style={{
          padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', opacity: saving || !text.trim() ? 0.6 : 1,
        }}>Ajouter</button>
      </form>
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{error}</div>}
      {notes?.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Aucune note.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {(notes ?? []).map(n => (
          <div key={n.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '7px 10px' }}>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{n.text}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {n.authorName ?? 'Admin'} · {new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
