import { useState, useEffect, useCallback } from 'react'
import { Package, Save } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { glass, glassInput } from '../lib/glassStyles'
import InfoTip from '../components/InfoTip'

// Supplément par catégorie de colis (page Tarifs) — choisi par le client à
// la commande (Documents, Petit colis, Grand colis, Repas, Objet de valeur,
// Autre). Ajouté à la part du coursier, montré et garanti dans le prix
// avant de commander. 0 par défaut. Endpoints /admin/package-categories
// (lecture SUPER/FINANCE/AE, réglage SUPER), voir dem-backend
// orders/package-categories.js.
export default function PackageSurchargeSection() {
  const { user } = useAuth()
  const isSuper = !user?.adminRole || user.adminRole === 'SUPER'

  const [data, setData] = useState(null)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const apply = d => { setData(d); setDraft(Object.fromEntries(d.categories.map(c => [c.key, String(c.surcharge)]))) }
  const load = useCallback(async () => {
    try { apply((await api.get('/admin/package-categories')).data) } catch (e) {
      if (e.response?.status !== 404) setError(e.response?.data?.message ?? 'Erreur.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (!data) return error ? <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p> : null

  const max = data.max ?? 5000
  const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)]))
  const valid = Object.values(values).every(n => Number.isInteger(n) && n >= 0 && n <= max)
  const changed = data.categories.filter(c => values[c.key] !== c.surcharge)
  const active = data.categories.filter(c => c.surcharge > 0)

  async function save() {
    setBusy(true); setError(''); setSaved(false)
    try {
      apply((await api.put('/admin/package-categories', { surcharges: values })).data)
      setSaved(true); setConfirming(false)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={16} /> Supplément par type de colis<InfoTip k="Supplément par type de colis" size={13} />
        </h2>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: active.length ? 'rgba(22,163,74,.12)' : 'rgba(100,116,139,.12)', color: active.length ? '#16a34a' : '#64748b' }}>
          {active.length ? `${active.length} SUPPLÉMENT${active.length > 1 ? 'S' : ''} ACTIF${active.length > 1 ? 'S' : ''}` : 'AUCUN SUPPLÉMENT'}
        </span>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14, maxWidth: 700 }}>
        Le client choisit le type de colis à la commande. Le supplément s'ajoute au prix de la course,
        <b> revient entièrement au coursier</b>, et figure dans le prix affiché et garanti avant de commander.
        0 F = pas de supplément. Un changement ne touche que les nouvelles courses.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {data.categories.map(c => (
          <label key={c.key} style={{ fontSize: 12, fontWeight: 600 }}>
            {c.label}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>+</span>
              <input
                type="number" min={0} max={max} step={50} value={draft[c.key] ?? '0'} disabled={!isSuper || busy}
                onChange={e => { setDraft(d => ({ ...d, [c.key]: e.target.value })); setSaved(false) }}
                aria-label={`Supplément ${c.label} en francs CFA`}
                style={{ ...glassInput, width: 100, fontSize: 14, fontWeight: 600 }}
              />
              <span style={{ color: 'var(--text-muted)' }}>F</span>
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        {isSuper && changed.length > 0 && !confirming && (
          <button onClick={() => setConfirming(true)} disabled={busy || !valid} style={{ ...btn('var(--primary)', busy || !valid), marginLeft: 'auto' }}>
            <Save size={14} /> Enregistrer
          </button>
        )}
        {saved && changed.length === 0 && <span style={{ color: 'var(--success, #16a34a)', fontSize: 12, marginLeft: 'auto' }}>Enregistré.</span>}
      </div>

      {confirming && changed.length > 0 && (
        <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
            Appliquer sur les nouvelles courses : {changed.map(c => `${c.label} +${(values[c.key] || 0).toLocaleString('fr-FR')} F`).join(', ')} ?
          </span>
          <button onClick={() => setConfirming(false)} disabled={busy} style={{ ...btn('transparent', busy), color: 'var(--text-muted)', border: '1px solid rgba(0,119,182,.25)' }}>Retour</button>
          <button onClick={save} disabled={busy || !valid} style={btn('var(--primary)', busy || !valid)}>{busy ? '…' : 'Confirmer'}</button>
        </div>
      )}
      {!isSuper && <p style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 10 }}>Seul le super admin peut modifier ces montants.</p>}
      {!valid && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>Chaque supplément : un nombre entier entre 0 et {max.toLocaleString('fr-FR')} F.</p>}
      {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  )
}

function btn(color, disabled) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none',
    background: color, color: '#fff', fontWeight: 600, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
  }
}
