import { useState } from 'react'
import { X } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

// Partagé par la liste (création) et la fiche (modification) des chefs de flotte.
export default function ChefFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    phone:        initial?.phone        ?? '',
    companyName:  initial?.companyName  ?? '',
    fleetMaxSize: initial?.fleetMaxSize ?? 10,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.phone.trim()) { setError('Le numéro est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await api.patch(`/admin/chefs-de-flotte/${initial.id}`, form)
      } else {
        await api.post('/admin/chefs-de-flotte', form)
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, background: 'rgba(255,255,255,0.97)', width: 420, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Modifier le chef de flotte' : 'Créer un chef de flotte'}</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        {[
          { key: 'name',        label: 'Nom complet',        type: 'text', placeholder: 'Ex : Ibrahima Sow' },
          { key: 'phone',       label: 'Téléphone *',         type: 'tel',  placeholder: '+221 77 000 00 00' },
          { key: 'companyName', label: 'Nom de la société',   type: 'text', placeholder: 'Ex : Transport Sow SARL' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              placeholder={placeholder}
              style={inputStyle}
            />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Taille max. de la flotte</label>
          <input
            type="number"
            min={1}
            max={200}
            value={form.fleetMaxSize}
            onChange={e => set('fleetMaxSize', e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
