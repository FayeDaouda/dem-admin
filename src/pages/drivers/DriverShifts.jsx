import { useState, useEffect } from 'react'
import api from '../../lib/api'

// ── Shifts d'un coursier de la flotte DEM (Responsable de flottes, C6) ──────
// Grille jours × créneaux ; enregistrée telle quelle (PUT /admin/drivers/:id/shifts).
// Les créneaux eux-mêmes se règlent sur le Dashboard (Shifts du jour).
const WEEKDAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']]

export default function DriverShifts(props) {
  const { driverId, canEdit, Section } = props
  const [slots, setSlots] = useState(null)
  const [selected, setSelected] = useState(new Set()) // 'weekday:slotKey'
  const [saved, setSaved] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.get(`/admin/drivers/${driverId}/shifts`)
      .then(r => {
        if (!alive) return
        const set = new Set((r.data?.shifts ?? []).map(s => `${s.weekday}:${s.slotKey}`))
        setSlots(r.data?.slots ?? []); setSelected(set); setSaved(set)
      })
      .catch(e => alive && setError(e.response?.data?.message ?? 'Planning indisponible.'))
    return () => { alive = false }
  }, [driverId])

  function toggle(id) {
    if (!canEdit) return
    setNotice('')
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  async function save() {
    setSaving(true); setError(''); setNotice('')
    try {
      const shifts = [...selected].map(id => { const [weekday, slotKey] = id.split(':'); return { weekday: Number(weekday), slotKey } })
      await api.put(`/admin/drivers/${driverId}/shifts`, { shifts })
      setSaved(new Set(selected))
      setNotice('Planning enregistré.')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  const changed = selected.size !== saved.size || [...selected].some(id => !saved.has(id))

  return (
    <Section title="Shifts">
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{error}</div>}
      {slots && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th />
                {WEEKDAYS.map(([d, label]) => <th key={d} style={{ padding: '2px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {slots.map(s => (
                <tr key={s.key}>
                  <td style={{ padding: '3px 8px 3px 0', whiteSpace: 'nowrap', fontWeight: 600 }}>{s.start}–{s.end}</td>
                  {WEEKDAYS.map(([d]) => {
                    const id = `${d}:${s.key}`
                    const on = selected.has(id)
                    return (
                      <td key={d} style={{ padding: 2, textAlign: 'center' }}>
                        <button type="button" onClick={() => toggle(id)} disabled={!canEdit} title={on ? 'Prévu' : 'Non prévu'} style={{
                          width: 26, height: 22, borderRadius: 6, cursor: canEdit ? 'pointer' : 'default',
                          border: `1px solid ${on ? '#7c3aed' : 'var(--border)'}`, background: on ? '#7c3aed' : 'transparent', color: '#fff', fontSize: 11,
                        }}>{on ? '✓' : ''}</button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {slots && selected.size === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Aucun créneau : ce coursier n'est pas dans le planning de la flotte DEM.</div>}
      {canEdit && changed && (
        <button onClick={save} disabled={saving} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer le planning'}
        </button>
      )}
      {notice && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 6 }}>{notice}</div>}
    </Section>
  )
}
