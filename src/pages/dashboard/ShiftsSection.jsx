import { useState } from 'react'
import { Phone, Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import WhatsAppButton from '../../components/WhatsAppButton'

// ── Shifts du jour (Responsable de flottes, C6) ──────────────────────────────
// Par créneau : coursiers prévus, présents, et statut de chacun comparé à sa
// connexion réelle (GET /admin/shifts/today). Les créneaux se règlent ici ;
// le planning de chaque coursier, dans sa fiche.
const STATUS = {
  PRESENT:    { label: 'Présent',            color: '#15803d' },
  LATE:       { label: 'En retard',          color: '#d97706' },
  ABSENT:     { label: 'Absent',             color: '#dc2626' },
  LEFT_EARLY: { label: 'Parti avant la fin', color: '#dc2626' },
  UPCOMING:   { label: 'À venir',            color: '#64748b' },
}

function SlotsEditor({ slots, onSaved, onCancel }) {
  const [rows, setRows] = useState(slots.map(s => ({ ...s })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (i, field, value) => setRows(r => r.map((x, j) => (j === i ? { ...x, [field]: value } : x)))

  async function save() {
    setSaving(true); setError('')
    try {
      const { data } = await api.put('/admin/shifts/slots', { slots: rows.map(r => ({ ...r, target: Number(r.target) })) })
      onSaved(data.slots)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ ...card, marginBottom: 10 }}>
      <h3 style={cardTitle}>Créneaux de la flotte DEM</h3>
      {rows.map((r, i) => (
        <div key={r.key ?? `new-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          <input type="time" value={r.start} onChange={e => set(i, 'start', e.target.value)} style={timeInput} />
          <span>–</span>
          <input type="time" value={r.end} onChange={e => set(i, 'end', e.target.value)} style={timeInput} />
          <input type="number" min={0} value={r.target} onChange={e => set(i, 'target', e.target.value)} style={{ ...timeInput, width: 70 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>coursiers attendus</span>
          <button onClick={() => setRows(x => x.filter((_, j) => j !== i))} title="Retirer ce créneau (il sera retiré des plannings)" style={iconBtn}><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={() => setRows(x => [...x, { start: '08:00', end: '10:00', target: 1 }])} style={btnOutline}><Plus size={13} /> Ajouter un créneau</button>
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <button onClick={onCancel} disabled={saving} style={btnOutline}>Annuler</button>
        <button onClick={save} disabled={saving || rows.length === 0} style={btnPrimary}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </div>
  )
}

export default function ShiftsSection(props) {
  const { data, canEdit, onChanged, Section, isMobile } = props
  const [editing, setEditing] = useState(false)
  if (!data) return null

  const right = canEdit && !editing
    ? <button onClick={() => setEditing(true)} style={btnOutline}>Modifier les créneaux</button>
    : null

  return (
    <Section title="Shifts du jour" hint="Planning de la flotte DEM comparé à la connexion réelle · 15 min de tolérance" right={right}>
      {editing && <SlotsEditor slots={data.slots} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }} />}
      {data.absents.length > 0 && (
        <div style={{ ...card, borderLeft: '4px solid #dc2626', marginBottom: 10 }}>
          <h3 style={{ ...cardTitle, color: '#dc2626' }}>Absents du shift ({data.absents.length})</h3>
          {data.absents.map(d => (
            <div key={`${d.slotKey}-${d.id}`} style={row}>
              <span style={{ flex: 1, fontWeight: 600 }}>{d.name ?? d.phone}</span>
              <span style={{ color: 'var(--text-muted)' }}>{d.slot}</span>
              <span style={{ color: STATUS[d.status].color, fontWeight: 700 }}>{STATUS[d.status].label}</span>
              {d.phone && <a href={`tel:${d.phone}`} title={`Appeler ${d.phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>}
              <WhatsAppButton phone={d.phone} compact />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {data.slots.map(s => (
          <div key={s.key} style={{ ...card, ...(s.ongoing ? { boxShadow: '0 0 0 2px #7c3aed55' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h3 style={{ ...cardTitle, margin: 0 }}>{s.start}–{s.end}</h3>
              {s.ongoing && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#7c3aed' }}>EN COURS</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 8px' }}>
              {s.planned} prévu{s.planned > 1 ? 's' : ''} sur {s.target} attendu{s.target > 1 ? 's' : ''}
              {(s.ongoing || s.ended) && ` · ${s.present} présent${s.present > 1 ? 's' : ''}`}
            </div>
            {s.drivers.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun coursier planifié aujourd'hui.</div>
              : s.drivers.map(d => (
                <div key={d.id} style={row}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.online ? '#22c55e' : '#cbd5e1' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.phone}{d.suspended ? ' (suspendu)' : ''}</span>
                  <span style={{ color: STATUS[d.status].color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {STATUS[d.status].label}{d.lateMinutes ? ` (${d.lateMinutes} min)` : ''}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </Section>
  )
}

const card       = { ...glass, padding: '14px 16px', minWidth: 0 }
const cardTitle  = { fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 0 }
const row        = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--border)' }
const timeInput  = { ...glassInput, padding: '6px 8px', fontSize: 13, width: 110, boxSizing: 'border-box' }
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnPrimary = { padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
