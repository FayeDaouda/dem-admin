import { useState, useEffect } from 'react'
import { Clock, Save } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// ── Alerte « course sans coursier » (SUPER) ──────────────────────────────────
// Délai au-delà duquel une course en attente déclenche l'alerte rouge et
// sonore chez les rôles qui attribuent les courses (Responsable de flottes) ;
// serveur : utils/dispatch-alert.js.
export default function DispatchAlertPanel() {
  const [config, setConfig]   = useState(null) // { minutes, default, min, max }
  const [value, setValue]     = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    api.get('/admin/dispatch-alert')
      .then(({ data }) => { setConfig(data); setValue(String(data.minutes)) })
      .catch(err => {
        if (err.response?.status === 404) setUnavailable(true) // serveur pas encore à jour
        else setError(err.response?.data?.message ?? 'Erreur de chargement.')
      })
  }, [])

  if (unavailable) return null

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError(''); setDone('')
    try {
      const { data } = await api.put('/admin/dispatch-alert', { minutes: Number(value) })
      setConfig(c => ({ ...c, minutes: data.minutes }))
      setDone(data.message ?? 'Enregistré.')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Enregistrement impossible.')
    } finally { setSaving(false) }
  }

  const changed = config && value !== String(config.minutes)

  return (
    <div style={{ ...glass, padding: '18px 22px', maxWidth: 620 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Clock size={16} color="#dc2626" />
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Alerte course sans coursier</h3>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Une course en attente depuis plus de ce délai affiche une alerte rouge, avec un son, en haut de l'admin
        du Super Admin et du Responsable de flottes.{config ? ` Par défaut : ${config.default} min.` : ''}
      </p>
      {config && (
        <form onSubmit={save} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input type="number" min={config.min} max={config.max} step={1} required value={value}
            onChange={e => setValue(e.target.value)} style={{ ...glassInput, width: 100 }} />
          <span style={{ fontSize: 13 }}>minutes</span>
          <button type="submit" disabled={!changed || saving} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !changed || saving ? 0.5 : 1,
          }}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 10 }}>{error}</div>}
      {done && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 10 }}>{done}</div>}
    </div>
  )
}
