import { useState } from 'react'
import { X } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import { SECTOR_LABELS, VOLUME_LABELS } from '../dem-pro/labels'

// ── Passer en Pro (Commercial / CRM Pro, C7) ────────────────────────────────
// Le formulaire Nouveau compte Pro, déjà rempli avec le client (nom,
// téléphone) : le même compte devient DEM Pro et garde son historique.
// Source « Client passé Pro » (POST /admin/clients/:id/convert-to-pro).
export default function ConvertToProModal({ client, onClose, onDone }) {
  const [form, setForm] = useState({ proBusinessName: '', proSector: '', proWeeklyVolume: '', email: client.email ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (form.proBusinessName.trim().length < 2) { setError("Indiquez le nom de l'entreprise."); return }
    setSaving(true); setError('')
    try {
      await api.post(`/admin/clients/${client.id}/convert-to-pro`, form)
      onDone(`${client.name ?? client.phone} est maintenant DEM Pro (${form.proBusinessName.trim()}).`)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={() => !saving && onClose()}>
      <form style={box} onClick={e => e.stopPropagation()} onSubmit={save}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Passer en Pro</h2>
          <button type="button" onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          Le compte de {client.name ?? client.phone} devient un compte DEM Pro validé : il garde ses courses et son historique. Source : client passé Pro.
        </p>
        <label style={label}>Contact</label>
        <input value={`${client.name ?? '—'} · ${client.phone ?? ''}`} disabled style={{ ...input, marginBottom: 12, opacity: 0.7 }} />
        <label style={label}>Nom de l'entreprise *</label>
        <input value={form.proBusinessName} onChange={e => set('proBusinessName', e.target.value)} placeholder="Ex : Boutique Awa" style={{ ...input, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={label}>Secteur</label>
            <select value={form.proSector} onChange={e => set('proSector', e.target.value)} style={input}>
              <option value="">— Choisir —</option>
              {Object.entries(SECTOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Volume hebdomadaire</label>
            <select value={form.proWeeklyVolume} onChange={e => set('proWeeklyVolume', e.target.value)} style={input}>
              <option value="">— Choisir —</option>
              {Object.entries(VOLUME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <label style={label}>Email</label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemple.com" style={input} />
        {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnOutline}>Annuler</button>
          <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Conversion…' : 'Passer en Pro'}</button>
        </div>
      </form>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 330 }
const box = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '22px 26px', width: 480, maxWidth: '94vw', borderRadius: 16 }
const label = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const input = { ...glassInput, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }
const btnOutline = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
