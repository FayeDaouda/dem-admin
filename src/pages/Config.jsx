import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Save } from 'lucide-react'
import { glass, glassInput } from '../lib/glassStyles'

const CONFIG_META = {
  base_fare_delivery: { label: 'Tarif de base – Livraison (F)', description: 'Montant fixe ajouté à chaque commande de type DELIVERY' },
  base_fare_ride:     { label: 'Tarif de base – Course (F)',    description: 'Montant fixe ajouté à chaque commande de type RIDE' },
  price_per_km:       { label: 'Prix par kilomètre (F)',        description: 'Montant facturé par km de distance haversine' },
}

export default function Config() {
  const [config, setConfig] = useState({})
  const [draft,  setDraft]  = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/config')
      // res.data = [{ key, value, label }]
      const map = {}
      for (const row of (res.data ?? [])) map[row.key] = row.value
      setConfig(map)
      setDraft(map)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function handleSave() {
    setSaving(true)
    try {
      const updates = Object.entries(draft).map(([key, value]) => ({ key, value }))
      await api.put('/admin/config', { updates })
      setConfig({ ...draft })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(CONFIG_META).some(k => draft[k] !== config[k])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Configuration tarifaire</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Les modifications sont appliquées immédiatement aux nouvelles commandes.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: hasChanges ? 'var(--primary)' : 'var(--surface2)',
            color: hasChanges ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: 13,
            cursor: hasChanges ? 'pointer' : 'default',
            transition: 'all .15s',
          }}
        >
          <Save size={14} />
          {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement…' : 'Sauvegarder'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
          {Object.entries(CONFIG_META).map(([key, meta]) => (
            <div key={key} style={{ ...glass, padding: '20px 24px' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>{meta.label}</label>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>{meta.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number"
                  value={draft[key] ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  style={{
                    ...glassInput,
                    width: 140,
                    fontSize: 15,
                    fontWeight: 600,
                    border: `1px solid ${draft[key] !== config[key] ? 'var(--primary)' : 'rgba(0,119,182,0.3)'}`,
                  }}
                />
                {draft[key] !== config[key] && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    était {config[key] ?? 'non défini'}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Aperçu prix */}
          <div style={{ ...glass, padding: '20px 24px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Simulation — Course de 5 km</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              {['DELIVERY', 'RIDE'].map(type => {
                const base = parseFloat(draft[`base_fare_${type.toLowerCase()}`] ?? 500)
                const perKm = parseFloat(draft['price_per_km'] ?? 200)
                const total = Math.round(base + 5 * perKm)
                return (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{type}</span>
                    <span style={{ fontWeight: 700 }}>{total.toLocaleString()} F</span>
                  </div>
                )
              })}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 10 }}>
              Hors multiplicateur surge. Calcul : base + 5 × prix/km
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
