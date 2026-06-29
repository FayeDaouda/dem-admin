import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Save, RotateCcw, Plus, Trash2, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { glass, glassInput } from '../lib/glassStyles'

// ── Helpers ───────────────────────────────────────────────────────────────────
const CONFIG_META = {
  base_fare_delivery: { label: 'Tarif de base – Livraison (F)', description: 'Montant fixe ajouté à chaque commande DELIVERY' },
  price_per_km:       { label: 'Prix par kilomètre (F)',        description: 'Montant facturé par km de distance haversine' },
}

function computeDemFeeFromGrid(price, grid) {
  if (!grid || grid.length === 0) return 0
  for (const { min, max, fee } of grid) {
    if (price >= min && price <= max) return fee
  }
  return price < grid[0].min ? 0 : grid[grid.length - 1].fee
}


const DEFAULT_FEE_GRID = [
  { min: 900,  max: 1250, fee: 65  }, { min: 1251, max: 1600, fee: 90  },
  { min: 1601, max: 2000, fee: 120 }, { min: 2001, max: 2450, fee: 155 },
  { min: 2451, max: 2750, fee: 185 }, { min: 2751, max: 3100, fee: 215 },
  { min: 3101, max: 3490, fee: 255 }, { min: 3491, max: 3900, fee: 295 },
  { min: 3901, max: 4450, fee: 350 }, { min: 4451, max: 5000, fee: 425 },
]

const TAB = (active) => ({
  padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  fontWeight: active ? 700 : 500, fontSize: 13, transition: 'all .15s',
})

const btnSave = (has) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
  borderRadius: 'var(--radius-sm)', border: 'none',
  background: has ? 'var(--primary)' : 'var(--surface2)',
  color: has ? '#fff' : 'var(--text-muted)',
  fontWeight: 600, fontSize: 13, cursor: has ? 'pointer' : 'default',
})

const btnOutline = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)',
  background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Config() {
  const [tab, setTab] = useState('tarifs')
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Configuration</h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        <button style={TAB(tab === 'tarifs')}      onClick={() => setTab('tarifs')}>Tarifs</button>
        <button style={TAB(tab === 'commissions')} onClick={() => setTab('commissions')}>Commissions</button>
        <button style={TAB(tab === 'surge')}        onClick={() => setTab('surge')}>Heures de pointe</button>
      </div>
      {tab === 'tarifs'      && <TarifsTab />}
      {tab === 'commissions' && <CommissionsTab />}
      {tab === 'surge'       && <SurgeTab />}
    </div>
  )
}

// ── Tab Tarifs ────────────────────────────────────────────────────────────────
function TarifsTab() {
  const navigate = useNavigate()
  const [config,  setConfig]  = useState({})
  const [draft,   setDraft]   = useState({})
  const [feeGrid, setFeeGrid] = useState(DEFAULT_FEE_GRID)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, feeRes] = await Promise.all([
        api.get('/admin/config'),
        api.get('/admin/fees/config'),
      ])
      const map = {}
      for (const row of (cfgRes.data ?? [])) map[row.key] = row.value
      setConfig(map)
      setDraft(map)
      setFeeGrid(feeRes.data.grid ?? DEFAULT_FEE_GRID)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
        <button onClick={handleSave} disabled={!hasChanges || saving} style={btnSave(hasChanges)}>
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
                  type="number" value={draft[key] ?? ''}
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

          {/* Simulation — utilise la grille configurée */}
          <div style={{ ...glass, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Simulation — Course de 5 km</h3>
              <button onClick={() => navigate('/config', { state: { tab: 'commissions' } })}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                → Éditer grille commissions
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {['DELIVERY'].map(type => {
                const base     = parseFloat(draft[`base_fare_${type.toLowerCase()}`] ?? 500)
                const perKm    = parseFloat(draft['price_per_km'] ?? 200)
                const coursePx = Math.round(base + 5 * perKm)
                const demFee   = computeDemFeeFromGrid(coursePx, feeGrid)
                return (
                  <div key={type} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', background: 'rgba(0,119,182,.07)', fontWeight: 700, fontSize: 11, color: 'var(--primary)', letterSpacing: '.5px' }}>{type}</div>
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Prix course (livreur)</span>
                        <span style={{ fontWeight: 600 }}>{coursePx.toLocaleString()} F</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>+ Commission DEM</span>
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
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
              Phase 1 : commission = 0 FCFA. La grille s'appliquera en Phase 2.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Commissions ───────────────────────────────────────────────────────────
function CommissionsTab() {
  const [grid,    setGrid]    = useState(null)
  const [draft,   setDraft]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/fees/config')
      const g = res.data.grid ?? DEFAULT_FEE_GRID
      setGrid(g)
      setDraft(g.map(t => ({ ...t })))
    } catch (e) {
      console.error(e)
      // Fallback sur les valeurs par défaut si l'API échoue (endpoint pas encore déployé)
      setGrid(DEFAULT_FEE_GRID)
      setDraft(DEFAULT_FEE_GRID.map(t => ({ ...t })))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function update(i, field, val) {
    setDraft(prev => prev.map((t, idx) =>
      idx === i ? { ...t, [field]: parseInt(val, 10) || 0 } : t
    ))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/admin/fees/config', { grid: draft })
      setGrid(draft.map(t => ({ ...t })))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  async function handleReset() {
    if (!confirm('Remettre la grille par défaut du lancement ?')) return
    setSaving(true)
    try {
      const res = await api.post('/admin/fees/config/reset')
      setGrid(res.data.grid)
      setDraft(res.data.grid.map(t => ({ ...t })))
    } catch (e) { alert('Erreur reset.') }
    finally { setSaving(false) }
  }

  const hasChanges = draft && grid && JSON.stringify(draft) !== JSON.stringify(grid)

  if (loading || !draft) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 420 }}>
          Grille de commissions DEM prélevées sur le prix de la course. Active en Phase 2.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={btnOutline} disabled={saving}>
            <RotateCcw size={13} /> Défaut
          </button>
          <button onClick={handleSave} disabled={!hasChanges || saving} style={btnSave(hasChanges)}>
            <Save size={14} />
            {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{ ...glass, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.05)' }}>
              {['Tranche min (F)', 'Tranche max (F)', 'Commission (F)', 'Aperçu'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.map((t, i) => {
              const origMin = grid[i]?.min
              const origMax = grid[i]?.max
              const origFee = grid[i]?.fee
              return (
                <tr key={i} style={{ borderBottom: i < draft.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <input type="number" min={0} value={t.min}
                      onChange={e => update(i, 'min', e.target.value)}
                      style={{ ...glassInput, width: 100, textAlign: 'center', fontWeight: 600,
                        border: `1px solid ${t.min !== origMin ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <input type="number" min={0} value={t.max}
                      onChange={e => update(i, 'max', e.target.value)}
                      style={{ ...glassInput, width: 100, textAlign: 'center', fontWeight: 600,
                        border: `1px solid ${t.max !== origMax ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <input type="number" min={0} value={t.fee}
                      onChange={e => update(i, 'fee', e.target.value)}
                      style={{ ...glassInput, width: 100, textAlign: 'center', fontWeight: 700,
                        color: 'var(--primary)',
                        border: `1px solid ${t.fee !== origFee ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.min.toLocaleString()} – {t.max.toLocaleString()} F → <strong style={{ color: 'var(--primary)' }}>{t.fee} F</strong>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
        Champs en bleu = modifications non sauvegardées. Phase 1 active : commission = 0 FCFA quelle que soit la grille.
      </p>
    </div>
  )
}

// ── Tab Heures de pointe (Surge Pricing) ─────────────────────────────────────
const DEFAULT_SURGE = { enabled: false, shifts: [] }

function SurgeTab() {
  const [server,  setServer]  = useState(null)   // valeur serveur (référence)
  const [enabled, setEnabled] = useState(false)
  const [shifts,  setShifts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/config')
      const row = (res.data ?? []).find(r => r.key === 'surge_config')
      const val = row?.value ?? DEFAULT_SURGE
      setServer(val)
      setEnabled(val.enabled ?? false)
      setShifts((val.shifts ?? []).map(s => ({ ...s })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Mutations locales ────────────────────────────────────────────
  function updateShift(i, field, val) {
    setShifts(prev => prev.map((s, idx) =>
      idx === i ? { ...s, [field]: field === 'multiplier' ? parseFloat(val) || 1 : val } : s
    ))
  }
  function addShift() {
    setShifts(prev => [...prev, { start: '08:00', end: '10:00', multiplier: 1.2 }])
  }
  function removeShift(i) {
    setShifts(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Sauvegarde ───────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const value = { enabled, shifts }
      await api.put('/admin/config', { updates: [{ key: 'surge_config', value }] })
      setServer(value)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de la sauvegarde.')
    } finally { setSaving(false) }
  }

  const hasChanges = server && JSON.stringify({ enabled, shifts }) !== JSON.stringify(server)

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement...</div>

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header + bouton sauvegarder */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 420 }}>
          Multipliez le tarif selon les heures de forte demande. Le multiplicateur s'applique au prix total de la course.
        </p>
        <button onClick={handleSave} disabled={!hasChanges || saving} style={btnSave(hasChanges)}>
          <Save size={14} />
          {saved ? 'Sauvegarde OK' : saving ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Toggle activation */}
      <div style={{ ...glass, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Surge pricing</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {enabled ? 'Actif — les multiplicateurs sont appliques en temps reel' : 'Desactive — tarif normal applique'}
          </div>
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: enabled ? 'var(--primary)' : 'rgba(0,0,0,.15)',
            position: 'relative', transition: 'background .2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 24 : 3,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </button>
      </div>

      {/* Tableau des tranches horaires */}
      <div style={{ ...glass, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.05)' }}>
              {['Debut', 'Fin', 'Multiplicateur', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Clock size={18} style={{ marginBottom: 6, opacity: .5 }} /><br />
                  Aucune tranche horaire configuree. Cliquez sur "Ajouter une tranche" pour commencer.
                </td>
              </tr>
            )}
            {shifts.map((s, i) => {
              const origShift = server?.shifts?.[i]
              const startChanged = s.start !== origShift?.start
              const endChanged   = s.end   !== origShift?.end
              const multChanged  = s.multiplier !== origShift?.multiplier
              return (
                <tr key={i} style={{ borderBottom: i < shifts.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <input type="time" value={s.start}
                      onChange={e => updateShift(i, 'start', e.target.value)}
                      style={{ ...glassInput, width: 120, textAlign: 'center', fontWeight: 600,
                        border: `1px solid ${startChanged ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <input type="time" value={s.end}
                      onChange={e => updateShift(i, 'end', e.target.value)}
                      style={{ ...glassInput, width: 120, textAlign: 'center', fontWeight: 600,
                        border: `1px solid ${endChanged ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" step="0.1" min="1" value={s.multiplier}
                        onChange={e => updateShift(i, 'multiplier', e.target.value)}
                        style={{ ...glassInput, width: 80, textAlign: 'center', fontWeight: 700,
                          color: 'var(--primary)',
                          border: `1px solid ${multChanged ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>x</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => removeShift(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', opacity: .7, padding: 4 }}
                      title="Supprimer cette tranche">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bouton ajouter */}
      <button onClick={addShift} style={{ ...btnOutline, marginTop: 12 }}>
        <Plus size={14} /> Ajouter une tranche
      </button>

      {/* Apercu */}
      {shifts.length > 0 && (
        <div style={{ ...glass, padding: '16px 20px', marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '.5px' }}>APERCU</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {shifts.map((s, i) => (
              <div key={i} style={{
                background: enabled ? 'rgba(0,119,182,.08)' : 'var(--surface2)',
                borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 13,
                border: `1px solid ${enabled ? 'rgba(0,119,182,.15)' : 'rgba(0,0,0,.06)'}`,
              }}>
                <span style={{ fontWeight: 600 }}>{s.start} - {s.end}</span>
                <span style={{ marginLeft: 8, fontWeight: 800, color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>{s.multiplier}x</span>
              </div>
            ))}
          </div>
          {!enabled && (
            <p style={{ color: '#e67e22', fontSize: 11, marginTop: 10, fontWeight: 500 }}>
              Le surge pricing est desactive. Activez-le pour que ces tranches soient prises en compte.
            </p>
          )}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
        Champs en bleu = modifications non sauvegardees. Les multiplicateurs sont appliques au prix total de la course pendant les heures configurees.
      </p>
    </div>
  )
}

