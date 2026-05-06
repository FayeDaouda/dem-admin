import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Save, ExternalLink, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { glass, glassInput } from '../lib/glassStyles'

// ── Config tarifaire ──────────────────────────────────────────────────────────
const CONFIG_META = {
  base_fare_delivery: { label: 'Tarif de base – Livraison (F)', description: 'Montant fixe ajouté à chaque commande de type DELIVERY' },
  base_fare_ride:     { label: 'Tarif de base – Course (F)',    description: 'Montant fixe ajouté à chaque commande de type RIDE' },
  price_per_km:       { label: 'Prix par kilomètre (F)',        description: 'Montant facturé par km de distance haversine' },
}

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

// ── Valeurs par défaut badges (miroir du backend) ─────────────────────────────
const DEFAULT_BADGES = [
  { tier: 'gainde',    name: 'DEM Gainde',     emoji: '🏅', courses: 500, referrals: 0,  rating: 4.2 },
  { tier: 'buur',      name: 'DEM Buur',       emoji: '👑', courses: 300, referrals: 0,  rating: 4.0 },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', emoji: '⭐', courses: 135, referrals: 0,  rating: 4.0 },
  { tier: 'doorWarr',  name: 'DEM Door Warr',  emoji: '✅', courses: 70,  referrals: 0,  rating: 3.5 },
  { tier: 'mbokk',     name: 'DEM Mbokk',      emoji: '👥', courses: 30,  referrals: 12, rating: 3.5 },
  { tier: 'xarit',     name: 'DEM Xarit',      emoji: '🤝', courses: 3,   referrals: 3,  rating: 0   },
]

const TAB = (active) => ({
  padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  fontWeight: active ? 700 : 500, fontSize: 13, transition: 'all .15s',
})

export default function Config() {
  const [tab, setTab] = useState('tarifs')
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Configuration</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        <button style={TAB(tab === 'tarifs')} onClick={() => setTab('tarifs')}>Tarifs</button>
        <button style={TAB(tab === 'badges')} onClick={() => setTab('badges')}>Badges drivers</button>
      </div>
      {tab === 'tarifs' && <TarifsTab />}
      {tab === 'badges' && <BadgesTab />}
    </div>
  )
}

// ── Tab Tarifs ────────────────────────────────────────────────────────────────
function TarifsTab() {
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
      const map = {}
      for (const row of (res.data ?? [])) map[row.key] = row.value
      setConfig(map)
      setDraft(map)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
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
    } finally { setSaving(false) }
  }

  const hasChanges = Object.keys(CONFIG_META).some(k => draft[k] !== config[k])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
            borderRadius: 'var(--radius-sm)', border: 'none',
            background: hasChanges ? 'var(--primary)' : 'var(--surface2)',
            color: hasChanges ? '#fff' : 'var(--text-muted)',
            fontWeight: 600, fontSize: 13, cursor: hasChanges ? 'pointer' : 'default',
          }}
        >
          <Save size={14} />
          {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement…' : 'Sauvegarder'}
        </button>
      </div>

      {loading ? <div style={{ color: 'var(--text-muted)' }}>Chargement…</div> : (
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
                  style={{ ...glassInput, width: 140, fontSize: 15, fontWeight: 600,
                    border: `1px solid ${draft[key] !== config[key] ? 'var(--primary)' : 'rgba(0,119,182,0.3)'}` }}
                />
                {draft[key] !== config[key] && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>était {config[key] ?? 'non défini'}</span>
                )}
              </div>
            </div>
          ))}

          <div style={{ ...glass, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Simulation — Course de 5 km</h3>
              <button onClick={() => navigate('/acquisition')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Voir grille frais <ExternalLink size={11} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {['DELIVERY', 'RIDE'].map(type => {
                const base     = parseFloat(draft[`base_fare_${type.toLowerCase()}`] ?? 500)
                const perKm    = parseFloat(draft['price_per_km'] ?? 200)
                const coursePx = Math.round(base + 5 * perKm)
                const demFee   = computeDemFee(coursePx)
                return (
                  <div key={type} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', background: 'rgba(0,119,182,.07)', fontWeight: 700, fontSize: 11, color: 'var(--primary)', letterSpacing: '.5px' }}>{type}</div>
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
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{(coursePx + demFee).toLocaleString()} F</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>Hors surge pricing. Calcul : base + 5 × prix/km + frais DEM selon grille.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Badges ────────────────────────────────────────────────────────────────
function BadgesTab() {
  const [badges,  setBadges]  = useState(null)
  const [draft,   setDraft]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/badges/config')
      setBadges(res.data.badges)
      setDraft(res.data.badges.map(b => ({ ...b })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function update(i, field, val) {
    setDraft(prev => prev.map((b, idx) =>
      idx === i ? { ...b, [field]: field === 'rating' ? parseFloat(val) || 0 : parseInt(val, 10) || 0 } : b
    ))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/admin/badges/config', { badges: draft })
      setBadges(draft.map(b => ({ ...b })))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  function handleReset() {
    if (!confirm('Remettre les valeurs par défaut ?')) return
    setDraft(DEFAULT_BADGES.map(b => ({ ...b })))
  }

  const hasChanges = draft && badges && JSON.stringify(draft) !== JSON.stringify(badges)

  if (loading || !draft) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Définissez les seuils de chaque niveau. Les badges sont recalculés en temps réel dans l'app driver.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            <RotateCcw size={13} /> Défaut
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: hasChanges ? 'var(--primary)' : 'var(--surface2)', color: hasChanges ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: hasChanges ? 'pointer' : 'default' }}
          >
            <Save size={14} />
            {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Tableau éditeur */}
      <div style={{ ...glass, padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.05)' }}>
              {['Niveau', 'Courses min', 'Parrainages min', 'Note min (/5)', 'Aperçu'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.map((b, i) => (
              <tr key={b.tier} style={{ borderBottom: i < draft.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                {/* Nom badge (non modifiable) */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{b.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</span>
                  </div>
                </td>
                {/* Courses */}
                <td style={{ padding: '10px 16px' }}>
                  <input
                    type="number" min={0}
                    value={b.courses}
                    onChange={e => update(i, 'courses', e.target.value)}
                    style={{ ...glassInput, width: 90, textAlign: 'center', fontWeight: 700,
                      border: `1px solid ${b.courses !== badges[i]?.courses ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                  />
                </td>
                {/* Parrainages */}
                <td style={{ padding: '10px 16px' }}>
                  <input
                    type="number" min={0}
                    value={b.referrals}
                    onChange={e => update(i, 'referrals', e.target.value)}
                    style={{ ...glassInput, width: 90, textAlign: 'center', fontWeight: 700,
                      border: `1px solid ${b.referrals !== badges[i]?.referrals ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                  />
                </td>
                {/* Note */}
                <td style={{ padding: '10px 16px' }}>
                  <input
                    type="number" min={0} max={5} step={0.1}
                    value={b.rating}
                    onChange={e => update(i, 'rating', e.target.value)}
                    style={{ ...glassInput, width: 90, textAlign: 'center', fontWeight: 700,
                      border: `1px solid ${b.rating !== badges[i]?.rating ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                  />
                </td>
                {/* Aperçu badge */}
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {b.courses} courses
                    {b.referrals > 0 ? ` + ${b.referrals} parrainages` : ''}
                    {b.rating > 0 ? ` + ${b.rating}★` : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
        Les champs en bleu indiquent une modification non sauvegardée. Le bouton Défaut remet les valeurs originales du lancement.
      </p>
    </div>
  )
}
