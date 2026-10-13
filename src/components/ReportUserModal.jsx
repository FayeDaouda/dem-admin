import { useState } from 'react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// Signaler un client ou un coursier (POST /admin/report-user) — ouvre un
// incident « Signalement utilisateur ». Ancien bouton de l'onglet Incidents du
// Poste Service Client, désormais sur la page Incidents (plan de refonte, 3.7).
export default function ReportUserModal({ onClose }) {
  const [userRole, setUserRole] = useState('CLIENT')
  const [phone, setPhone]       = useState('')
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function submit() {
    if (!phone.trim() || !reason.trim()) { setError('Téléphone et motif requis.'); return }
    setSaving(true); setError('')
    try {
      const listPath = userRole === 'CLIENT' ? '/admin/clients' : '/admin/drivers'
      const res = await api.get(listPath, { params: { search: phone.trim(), limit: 1 } })
      const found = (res.data?.clients ?? res.data?.drivers ?? [])[0]
      if (!found) { setError('Aucun utilisateur trouvé avec ce numéro.'); setSaving(false); return }
      await api.post('/admin/report-user', { userId: found.id, userRole, reason: reason.trim() })
      onClose()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ ...glass, width: 400, maxWidth: '94vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Signaler un utilisateur</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['CLIENT', 'Client'], ['DRIVER', 'Coursier']].map(([v, l]) => (
            <button key={v} onClick={() => setUserRole(v)} style={{
              flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)',
              background: userRole === v ? 'var(--primary)' : 'rgba(255,255,255,.5)',
              color: userRole === v ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        <input style={glassInput} placeholder="Numéro de téléphone" value={phone} onChange={e => setPhone(e.target.value)} />
        <textarea style={{ ...glassInput, marginTop: 10, resize: 'vertical' }} rows={3} placeholder="Motif du signalement" value={reason} onChange={e => setReason(e.target.value)} />
        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            {saving ? 'Envoi…' : 'Signaler'}
          </button>
        </div>
      </div>
    </div>
  )
}
