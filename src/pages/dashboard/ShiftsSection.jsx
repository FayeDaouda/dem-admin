import { useState, useEffect } from 'react'
import { Phone, Plus, Trash2, Users, X, Search } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import WhatsAppButton from '../../components/WhatsAppButton'

// ── Shifts du jour (Responsable de flottes, C6) ──────────────────────────────
// Par créneau : coursiers prévus, présents, et statut de chacun comparé à sa
// connexion réelle (GET /admin/shifts/today). Super + Resp. flottes règlent
// ici les créneaux et les coursiers de chaque créneau, jour par jour
// (/admin/shifts/slots/:key/drivers) ; aussi dans la fiche de chaque coursier.
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

const WEEKDAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']]
const WEEKDAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

// Coursiers d'un créneau, pour un jour de la semaine (planning hebdomadaire)
function SlotPlanner({ slot, today, onClose, onSaved }) {
  const [weekday, setWeekday] = useState(today)
  const [drivers, setDrivers] = useState(null)
  const [saved, setSaved] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    setDrivers(null); setError(''); setNotice('')
    api.get(`/admin/shifts/slots/${slot.key}/drivers`, { params: { weekday } })
      .then(r => { if (alive) { setDrivers(r.data.drivers); setSaved(r.data.drivers.map(d => d.id)) } })
      .catch(e => alive && setError(e.response?.data?.message ?? 'Planning indisponible.'))
    return () => { alive = false }
  }, [slot.key, weekday])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      api.get('/admin/drivers', { params: { search: q, limit: 8 } })
        .then(r => setResults(Array.isArray(r.data?.drivers) ? r.data.drivers : []))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const ids = new Set((drivers ?? []).map(d => d.id))
  const changed = drivers && (drivers.length !== saved.length || drivers.some(d => !saved.includes(d.id)))
  const add = d => { setNotice(''); setDrivers(list => [...list, { id: d.id, name: d.name, phone: d.phone, isActive: d.isActive }]); setQuery(''); setResults([]) }
  const remove = id => { setNotice(''); setDrivers(list => list.filter(d => d.id !== id)) }

  async function save() {
    setSaving(true); setError('')
    try {
      const { data } = await api.put(`/admin/shifts/slots/${slot.key}/drivers`, { weekday, driverIds: drivers.map(d => d.id) })
      setDrivers(data.drivers); setSaved(data.drivers.map(d => d.id))
      setNotice(`Enregistré pour chaque ${WEEKDAY_NAMES[weekday]}.`)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, background: 'rgba(255,255,255,0.97)', padding: '20px 22px', width: 460, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Créneau {slot.start}–{slot.end}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{slot.target} coursier{slot.target > 1 ? 's' : ''} attendu{slot.target > 1 ? 's' : ''} · planning répété chaque semaine</div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
          {WEEKDAYS.map(([d, label]) => (
            <button key={d} onClick={() => { if (!changed || window.confirm('Changements non enregistrés : les abandonner ?')) setWeekday(d) }} style={{
              padding: '5px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: d === weekday ? 'none' : '1px solid var(--border)',
              background: d === weekday ? 'var(--primary)' : 'transparent', color: d === weekday ? '#fff' : 'var(--text)', fontWeight: d === weekday ? 700 : 500,
            }}>{label}{d === today ? ' ·' : ''}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          Coursiers prévus le {WEEKDAY_NAMES[weekday]}{drivers ? ` (${drivers.length}/${slot.target})` : ''}
        </div>
        {!drivers ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{error || 'Chargement…'}</div> : (
          <>
            {drivers.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Aucun coursier sur ce créneau.</div>}
            {drivers.map(d => (
              <div key={d.id} style={row}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{d.name ?? d.phone}{d.isActive === false ? ' (suspendu)' : ''}</span>
                <span style={{ color: 'var(--text-muted)' }}>{d.phone}</span>
                <button onClick={() => remove(d.id)} title="Retirer de ce créneau" style={iconBtn}><Trash2 size={14} /></button>
              </div>
            ))}
            <div style={{ position: 'relative', marginTop: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ajouter un coursier : nom ou téléphone" style={{ ...glassInput, padding: '7px 10px 7px 30px', fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
            </div>
            {results.filter(d => !ids.has(d.id)).map(d => (
              <button key={d.id} onClick={() => add(d)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                <Plus size={13} color="var(--primary)" />
                <span style={{ flex: 1, fontWeight: 600 }}>{d.name ?? d.phone}</span>
                <span style={{ color: 'var(--text-muted)' }}>{d.phone}</span>
              </button>
            ))}
          </>
        )}
        {drivers && error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{error}</div>}
        {notice && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 8 }}>{notice}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onClose} disabled={saving} style={btnOutline}>Fermer</button>
          <button onClick={save} disabled={saving || !changed} style={{ ...btnPrimary, opacity: changed ? 1 : 0.5 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ShiftsSection(props) {
  const { data, canEdit, onChanged, Section, isMobile } = props
  const [editing, setEditing] = useState(false)
  const [planning, setPlanning] = useState(null) // créneau dont on règle les coursiers
  if (!data) return null

  const right = canEdit && !editing
    ? <button onClick={() => setEditing(true)} style={btnOutline}>Modifier les créneaux</button>
    : null

  return (
    <Section title="Shifts du jour" hint="Planning de la flotte DEM comparé à la connexion réelle · 15 min de tolérance" right={right}>
      {planning && <SlotPlanner slot={planning} today={data.weekday} onClose={() => setPlanning(null)} onSaved={onChanged} />}
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
              {canEdit && <button onClick={() => setPlanning(s)} style={{ ...btnOutline, marginLeft: 'auto', padding: '3px 10px' }}><Users size={12} /> Coursiers</button>}
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
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
const btnPrimary = { padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
