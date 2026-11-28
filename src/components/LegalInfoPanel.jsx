import { useState, useEffect } from 'react'
import { FileText, Save } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// ── Mentions légales de DEM (SUPER) ───────────────────────────────────────────
// Imprimées sur les factures d'abonnement DEM Pro (DEM émettrice).
// Serveur : dem_pro/dem_pro.invoices.js (AppConfig dem_legal_info).
const FIELDS = [
  { key: 'name',    label: 'Raison sociale',        placeholder: 'DEM · Delivery Express Mobility' },
  { key: 'address', label: 'Adresse',               placeholder: 'Dakar, Sénégal' },
  { key: 'ninea',   label: 'NINEA',                 placeholder: 'Ex. 0012345 2G3' },
  { key: 'rccm',    label: 'RCCM',                  placeholder: 'Ex. SN-DKR-2025-B-12345' },
  { key: 'phone',   label: 'Téléphone',             placeholder: '+221 …' },
  { key: 'email',   label: 'E-mail',                placeholder: 'contact@dem.sn' },
  { key: 'vatNote', label: 'Mention TVA',           placeholder: 'TVA non applicable' },
]

export default function LegalInfoPanel() {
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/admin/legal-info')
      .then(({ data }) => { setSaved(data); setDraft(data) })
      .catch(err => {
        if (err.response?.status === 404) setUnavailable(true) // serveur pas encore à jour
        else setError(err.response?.data?.message ?? 'Erreur de chargement.')
      })
  }, [])

  if (unavailable) return null
  const changed = saved && draft && FIELDS.some(f => (draft[f.key] ?? '') !== (saved[f.key] ?? ''))

  async function save() {
    setSaving(true); setError(''); setDone('')
    try {
      const body = Object.fromEntries(FIELDS.map(f => [f.key, draft[f.key] ?? '']))
      const { data } = await api.put('/admin/legal-info', body)
      setSaved(data); setDraft(data); setDone('Mentions enregistrées. Elles s\'appliquent aux factures ouvertes à partir de maintenant.')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ ...glass, padding: '18px 22px', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FileText size={16} color="var(--primary)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Mentions légales de DEM</h3>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Imprimées sur les factures d'abonnement DEM Pro, que DEM émet aux commerçants.
        Un champ vide n'apparaît pas sur la facture.
      </p>
      {draft && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {FIELDS.map(f => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              {f.label}
              <input
                value={draft[f.key] ?? ''}
                placeholder={f.placeholder}
                maxLength={160}
                onChange={e => { setDraft({ ...draft, [f.key]: e.target.value }); setDone('') }}
                style={{ ...glassInput, padding: '8px 10px', fontSize: 13, color: 'var(--text)' }}
              />
            </label>
          ))}
        </div>
      )}
      {draft && (
        <button onClick={save} disabled={!changed || saving} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none', marginTop: 16,
          background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          opacity: !changed || saving ? 0.5 : 1,
        }}>
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{error}</div>}
      {done && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 8 }}>{done}</div>}
    </div>
  )
}
