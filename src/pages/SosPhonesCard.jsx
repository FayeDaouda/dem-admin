import { useState, useEffect } from 'react'
import { Siren } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

/**
 * Numéros de l'équipe DEM prévenus par SMS lors d'une alerte SOS livreur
 * (GET/PUT /admin/sos/config). Par défaut : le numéro du support.
 * Modifiable par le SUPER uniquement.
 */
export default function SosPhonesCard({ canEdit }) {
  const [phones, setPhones] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/sos/config')
      .then(res => setPhones(res.data?.phones ?? []))
      .catch(() => setPhones([]))
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const list = draft.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean)
      const res = await api.put('/admin/sos/config', { phones: list })
      setPhones(res.data?.phones ?? list)
      setEditing(false)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (phones === null) return null

  return (
    <div style={{ ...glass, padding: '12px 16px', marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Siren size={18} color="#dc2626" />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          ALERTE SOS LIVREUR — NUMÉROS PRÉVENUS PAR SMS
        </div>
        {editing ? (
          <>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="+221 77 123 45 67, +221 78 …"
              style={{ ...glassInput, width: '100%', marginTop: 6 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              5 numéros maximum, séparés par des virgules.
            </div>
            {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{error}</div>}
          </>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{phones.join(' · ') || '—'}</div>
        )}
      </div>
      {canEdit && (editing ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(false)} style={btn}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btn, background: 'linear-gradient(135deg,#00b4d8,#0077b6)', color: '#fff', border: 'none' }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      ) : (
        <button onClick={() => { setDraft(phones.join(', ')); setEditing(true) }} style={btn}>Modifier</button>
      ))}
    </div>
  )
}

const btn = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
