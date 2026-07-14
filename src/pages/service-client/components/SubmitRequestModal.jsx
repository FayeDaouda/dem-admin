import { useState } from 'react'
import api from '../../../lib/api'
import { glass, glassInput } from '../../../lib/glassStyles'
import { XCircle } from 'lucide-react'

const KIND_LABELS = {
  DEM_PRO_CREATE:   'Demande de création d\'un compte DEM Pro',
  DEM_PRO_SUSPEND:  'Demande de suspension de compte DEM Pro',
  DEM_PRO_ACTIVATE: 'Demande de réactivation de compte DEM Pro',
  GESTE_FREE_RIDE:  'Demande de course gratuite',
  GESTE_DISCOUNT:   'Demande de remise',
  DRIVER_SUSPEND:   'Demande de suspension de livreur',
  CHEF_SUSPEND:     'Demande de suspension de chef de flotte',
}

const inputStyle = { ...glassInput, marginTop: 4 }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 12 }

// props: kind (string), targetUser ({id,label}|null), onClose, onSubmitted
export default function SubmitRequestModal({ kind, targetUser, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', businessName: '', sector: 'commerce', weeklyVolume: 'low',
    discountPercent: '',
  })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    setSaving(true); setError('')
    try {
      const body = { kind, reason: reason.trim() || undefined }
      if (kind === 'DEM_PRO_CREATE') {
        body.payload = {
          name: form.name, phone: form.phone, email: form.email,
          businessName: form.businessName, sector: form.sector, weeklyVolume: form.weeklyVolume,
        }
      } else {
        body.targetUserId = targetUser?.id
        if (kind === 'GESTE_DISCOUNT') body.payload = { discountPercent: form.discountPercent }
      }
      await api.post('/admin/requests', body)
      onSubmitted()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ ...glass, width: 440, maxWidth: '94vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{KIND_LABELS[kind] ?? kind}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><XCircle size={18} /></button>
        </div>

        {targetUser && (
          <div style={{ fontSize: 13, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
            Concerne : <strong>{targetUser.label}</strong>
          </div>
        )}

        {kind === 'DEM_PRO_CREATE' && (
          <>
            <label style={labelStyle}>Nom du responsable</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Aïssatou Diop" />
            <label style={labelStyle}>Téléphone *</label>
            <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+221 77 000 00 00" />
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@boutique.sn" />
            <label style={labelStyle}>Nom de l'entreprise</label>
            <input style={inputStyle} value={form.businessName} onChange={e => set('businessName', e.target.value)} placeholder="Ex : Boutique Aïssa" />
            <label style={labelStyle}>Secteur</label>
            <select style={inputStyle} value={form.sector} onChange={e => set('sector', e.target.value)}>
              <option value="commerce">Commerce</option>
              <option value="restauration">Restauration</option>
              <option value="services">Services</option>
              <option value="artisanat">Artisanat</option>
              <option value="autre">Autre</option>
            </select>
            <label style={labelStyle}>Volume hebdo estimé</label>
            <select style={inputStyle} value={form.weeklyVolume} onChange={e => set('weeklyVolume', e.target.value)}>
              <option value="low">1 à 4 livraisons / semaine</option>
              <option value="medium">5 à 8 livraisons / semaine</option>
              <option value="high">9 ou plus / semaine</option>
            </select>
          </>
        )}

        {kind === 'GESTE_DISCOUNT' && (
          <>
            <label style={labelStyle}>Remise (%)</label>
            <input style={inputStyle} type="number" min="1" max="100" value={form.discountPercent} onChange={e => set('discountPercent', e.target.value)} placeholder="Ex : 20" />
          </>
        )}

        <label style={labelStyle}>Motif de la demande {kind !== 'DEM_PRO_CREATE' && '*'}</label>
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explique pourquoi cette demande est justifiée…" />

        {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            {saving ? 'Envoi…' : 'Soumettre'}
          </button>
        </div>
      </div>
    </div>
  )
}
