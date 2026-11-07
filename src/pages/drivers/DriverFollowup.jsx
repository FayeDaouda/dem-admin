import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glassInput } from '../../lib/glassStyles'

// ── Fiche coursier enrichie (Responsable de flottes, C7) ────────────────────
// Historique de connexion jour par jour (7 / 30 jours) et notes internes
// datées — visibles du Super Admin et du Responsable de flottes, jamais du
// coursier. `Section` : la section de la fiche (titre).

function fmtDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}
const fmtDay = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

export function ConnectionHistory(props) {
  const { driverId, Section } = props
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.get(`/admin/drivers/${driverId}/connection-history`, { params: { days } })
      .then(r => { if (alive) { setData(r.data); setError('') } })
      .catch(e => alive && setError(e.response?.data?.message ?? 'Historique indisponible.'))
    return () => { alive = false }
  }, [driverId, days])

  const max = Math.max(1, ...(data?.history ?? []).map(r => r.onlineSeconds))
  return (
    <Section title="Historique de connexion">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {[7, 30].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(0,119,182,.25)',
            background: days === d ? 'var(--primary)' : 'transparent', color: days === d ? '#fff' : 'var(--text-muted)',
          }}>{d} j</button>
        ))}
        {data && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtDuration(data.totals.onlineSeconds)} en ligne · {data.totals.accepted} acceptée{data.totals.accepted > 1 ? 's' : ''} · {data.totals.delivered} livrée{data.totals.delivered > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {[...data.history].reverse().map(r => (
            <div key={r.date} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 70px 64px', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{fmtDay(r.date)}</span>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,.06)' }}>
                <div style={{ width: `${Math.round(r.onlineSeconds / max * 100)}%`, height: '100%', borderRadius: 4, background: '#7c3aed' }} />
              </div>
              <span style={{ fontWeight: 600, textAlign: 'right' }}>{fmtDuration(r.onlineSeconds)}</span>
              <span style={{ color: r.accepted ? 'var(--text)' : 'var(--text-muted)', textAlign: 'right' }}>{r.accepted} course{r.accepted > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

export function DriverNotes(props) {
  const { driverId, Section } = props
  const [notes, setNotes] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => api.get(`/admin/drivers/${driverId}/notes`)
    .then(r => setNotes(r.data?.notes ?? []))
    .catch(e => setError(e.response?.data?.message ?? 'Notes indisponibles.')), [driverId])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true); setError('')
    try {
      await api.post(`/admin/drivers/${driverId}/notes`, { text: text.trim() })
      setText('')
      load()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <Section title="Notes internes">
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder="Retard au shift, appel, avertissement… (jamais vu par le coursier)"
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
