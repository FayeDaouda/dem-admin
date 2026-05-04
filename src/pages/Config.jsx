import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Save, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { glass, glassInput } from '../lib/glassStyles'

const CONFIG_META = {
  base_fare_delivery: { label: 'Tarif de base – Livraison (F)', description: 'Montant fixe ajouté à chaque commande de type DELIVERY' },
  base_fare_ride:     { label: 'Tarif de base – Course (F)',    description: 'Montant fixe ajouté à chaque commande de type RIDE' },
  price_per_km:       { label: 'Prix par kilomètre (F)',        description: 'Montant facturé par km de distance haversine' },
}

// Grille des frais DEM (identique à pricing_service.dart et orders.service.js)
const FEE_GRID = [
  [900,  1250,  65], [1251, 1600,  90], [1601, 2000, 120],
  [2001, 2450, 155], [2451, 2750, 185], [2751, 3100, 215],
  [3101, 3490, 255], [3491, 3900, 295], [3901, 4450, 350],
  [4451, 5000, 425],
]
function computeDemFee(coursePrice) {
  for (const [min, max, fee] of FEE_GRID) {
    if (coursePrice >= min && coursePrice <= max) return fee
  }
  return coursePrice < 900 ? 0 : 425
}

export default function Config() {
  const navigate = useNavigate()
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

          {/* Simulation prix */}
          <div style={{ ...glass, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Simulation — Course de 5 km</h3>
              <button
                onClick={() => navigate('/acquisition')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', color: 'var(--primary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Voir grille frais <ExternalLink size={11} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {['DELIVERY', 'RIDE'].map(type => {
                const base      = parseFloat(draft[`base_fare_${type.toLowerCase()}`] ?? 500)
                const perKm     = parseFloat(draft['price_per_km'] ?? 200)
                const coursePx  = Math.round(base + 5 * perKm)
                const demFee    = computeDemFee(coursePx)
                const totalPx   = coursePx + demFee

                return (
                  <div key={type} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    {/* Titre type */}
                    <div style={{ padding: '6px 12px', background: 'rgba(0,119,182,.07)', fontWeight: 700, fontSize: 11, color: 'var(--primary)', letterSpacing: '.5px' }}>
                      {type}
                    </div>
                    {/* Décomposition */}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Prix course (livreur)</span>
                        <span style={{ fontWeight: 600 }}>{coursePx.toLocaleString()} F</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>+ Frais DEM</span>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>+{demFee} F</span>
                      </div>
                      <div style={{ height: 1, background: 'rgba(0,0,0,.08)', margin: '3px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Total client</span>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{totalPx.toLocaleString()} F</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
              Hors surge pricing. Calcul : base + 5 × prix/km + frais DEM selon grille.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
