import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Save, Plus, Trash2, Clock, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'
import ZoneMatrixSection from './ZoneMatrixSection'
import FlatPromoSection from './FlatPromoSection'
import CashFeeSection from './CashFeeSection'
import PassLivreursSection from './PassLivreursSection'
import PassForfaitSettings from './PassForfaitSettings'
import { useAuth } from '../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../lib/droits'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { useUrlTab } from '../lib/useUrlTab'
import DeliveryZoneTab from './DeliveryZoneTab'

// ── Réglages /admin/config, rangés par sujet ──────────────────────────────────
const CONFIG_META = {
  base_fare_delivery:      { label: 'Tarif de base – Livraison (F)', description: 'Montant fixe ajouté à chaque commande DELIVERY' },
  price_per_km:            { label: 'Prix par kilomètre (F)',        description: 'Montant facturé par km de distance haversine' },
  dem_pro_commission_rate: { label: 'Commission DEM Pro – Wallet (%)', description: 'Prélevée sur la part "produit" des commandes payées via le paiement intégré DEM Pro (wallet)' },
  dem_pro_price_pro:       { label: 'Abonnement DEM Pro – Pro (F/mois)',      description: 'Prix mensuel facturé pour passer du palier Gratuit à Pro' },
  dem_pro_price_business:  { label: 'Abonnement DEM Pro – Business (F/mois)', description: 'Prix mensuel facturé pour passer au palier Business' },
  driver_location_interval_sec: { label: 'Position du coursier en course – envoi toutes les (s)', description: 'Rythme auquel l\'app coursier envoie sa position pendant une course (3 à 30 s, 4 s si vide). Plus court = moto plus à jour côté client ; repasser à 10 en cas de charge serveur. Pris en compte au début de la course suivante.', placeholder: '4' },
}

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

const READ_ONLY_NOTE = 'Modification réservée au Super Admin.'

// ── Page principale ───────────────────────────────────────────────────────────
// Onglets par sujet (avant : un seul onglet « Tarifs » mêlant prix, pass,
// DEM Pro et un réglage technique). La clé « tarifs » est gardée pour les
// liens existants (?tab=tarifs).
const CONFIG_TABS = [
  { key: 'tarifs',    label: 'Prix des courses' },
  { key: 'pass',      label: 'Pass coursiers' },
  { key: 'dempro',    label: 'DEM Pro' },
  { key: 'surge',     label: 'Heures de pointe' },
  { key: 'zone',      label: 'Zone de livraison' },
  { key: 'technique', label: 'Réglage technique' },
]

export default function Config() {
  const { user } = useAuth()
  const role = user?.adminRole
  const rights = {
    tariffBlocks: canSee(role, ACTION_ROLES.tariffBlocks),
    passSettings: canSee(role, ACTION_ROLES.passSettings),
    edit:         canSee(role, ACTION_ROLES.configEdit),
  }
  // Pass coursiers : rien à montrer à un rôle qui ne voit ni les pass ni leurs réglages.
  const tabs = CONFIG_TABS.filter(t => t.key !== 'pass' || rights.tariffBlocks || rights.passSettings)
  const [tab, setTab] = useUrlTab(tabs)

  return (
    <div style={pageWrap}>
      <PageHeader title="Tarifs et zones" subtitle="Prix des courses, pass coursiers, DEM Pro, heures de pointe et zone de livraison" />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {tab === 'tarifs'    && <PrixTab rights={rights} />}
        {tab === 'pass'      && <PassTab rights={rights} />}
        {tab === 'dempro'    && <DemProTab rights={rights} />}
        {tab === 'surge'     && <SurgeTab canEdit={rights.edit} />}
        {tab === 'zone'      && <DeliveryZoneTab canEdit={rights.edit} />}
        {tab === 'technique' && <TechTab rights={rights} />}
      </div>
    </div>
  )
}

// Réglages /admin/config chargés une fois par onglet.
function useAppConfig() {
  const [config, setConfig] = useState(null)
  const [error, setError]   = useState('')
  useEffect(() => {
    api.get('/admin/config')
      .then(res => {
        const map = {}
        for (const row of (res.data ?? [])) map[row.key] = row.value
        setConfig(map)
      })
      .catch(e => setError(e.response?.data?.message ?? 'Chargement impossible.'))
  }, [])
  return { config, setConfig, error }
}

// ── Bloc de réglages : ses champs, son bouton Enregistrer ─────────────────────
// N'enregistre que ses propres clés (avant : un bouton unique, posé au milieu
// de la page, qui n'enregistrait que les champs en dessous de lui).
function ConfigBlock({ title, keys, config, onSaved, canEdit, children }) {
  const [draft, setDraft]   = useState(() => Object.fromEntries(keys.map(k => [k, config[k]])))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')
  const hasChanges = keys.some(k => draft[k] !== config[k])

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const updates = keys.map(key => ({ key, value: draft[key] }))
      await api.put('/admin/config', { updates })
      onSaved(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de la sauvegarde.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ ...glass, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h2>
        {canEdit && (hasChanges || saved) && (
          <button onClick={handleSave} disabled={!hasChanges || saving} style={btnSave(hasChanges)}>
            {saved && !hasChanges ? <><CheckCircle size={14} /> Enregistré</> : <><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</>}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {keys.map(key => {
          const meta = CONFIG_META[key]
          return (
            <div key={key}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>{meta.label}</label>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 8px', maxWidth: 640 }}>{meta.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number" value={draft[key] ?? ''} placeholder={meta.placeholder} disabled={!canEdit}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  style={{ ...glassInput, width: 140, fontSize: 15, fontWeight: 600,
                    border: `1px solid ${draft[key] !== config[key] ? 'var(--primary)' : 'rgba(0,119,182,0.3)'}` }}
                />
                {draft[key] !== config[key] && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>était {config[key] ?? 'non défini'}</span>
                )}
              </div>
            </div>
          )
        })}
        {children?.(draft)}
      </div>
      {!canEdit && <p style={{ color: 'var(--text-muted)', fontSize: 11.5, margin: '12px 0 0' }}>{READ_ONLY_NOTE}</p>}
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  )
}

function ErrorLine({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 12 }}>
      <AlertTriangle size={13} /> {children}
    </div>
  )
}

function ConfigLoading({ error }) {
  return <div style={{ color: error ? 'var(--danger)' : 'var(--text-muted)' }}>{error || 'Chargement…'}</div>
}

// ── Onglet Prix des courses ───────────────────────────────────────────────────
// Promo prix unique (au-dessus : quand elle est active, elle remplace tous
// les prix), frais de mise en relation, grille des zones (le tarif principal,
// endpoints /admin/zone-fares/*), puis le tarif au km hors zone.
function PrixTab({ rights }) {
  const { config, setConfig, error } = useAppConfig()
  const [connectionFee, setConnectionFee] = useState(100)

  useEffect(() => {
    api.get('/admin/connection-fee')
      .then(res => { if (res.data?.amount != null) setConnectionFee(res.data.amount) })
      .catch(() => {})
  }, [])

  return (
    <div>
      {rights.tariffBlocks && <FlatPromoSection />}
      {rights.tariffBlocks && <CashFeeSection />}
      {rights.tariffBlocks && <ZoneMatrixSection />}

      {!config ? <ConfigLoading error={error} /> : (
        <ConfigBlock
          title="Tarif hors zone"
          keys={['base_fare_delivery', 'price_per_km']}
          config={config}
          canEdit={rights.edit}
          onSaved={d => setConfig(c => ({ ...c, ...d }))}
        >
          {draft => <Simulation base={draft.base_fare_delivery} perKm={draft.price_per_km} connectionFee={connectionFee} />}
        </ConfigBlock>
      )}
    </div>
  )
}

// Simulation — tarif au km (utilisé seulement hors des zones de la grille)
// avec les frais de mise en relation.
function Simulation({ base, perKm, connectionFee }) {
  const coursePx = Math.round(parseFloat(base ?? 500) + 5 * parseFloat(perKm ?? 200))
  const demFee   = Math.min(connectionFee, coursePx)
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxWidth: 520 }}>
      <div style={{ padding: '6px 12px', background: 'rgba(0,119,182,.07)', fontWeight: 700, fontSize: 11, color: 'var(--primary)', letterSpacing: '.5px' }}>SIMULATION — COURSE DE 5 KM</div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Prix payé par le client</span>
          <span style={{ fontWeight: 600 }}>{coursePx.toLocaleString()} F</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>− Frais de mise en relation DEM</span>
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>−{demFee} F</span>
        </div>
        <div style={{ height: 1, background: 'rgba(0,0,0,.08)', margin: '3px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>Part du coursier</span>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{(coursePx - demFee).toLocaleString()} F</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '6px 0 0' }}>
          Tarif au km utilisé seulement hors des zones de la grille. Les frais de mise en relation s'appliquent à toutes les courses.
        </p>
      </div>
    </div>
  )
}

// ── Onglet Pass coursiers ─────────────────────────────────────────────────────
// Sections indépendantes (endpoints distincts de /admin/config). Ne pas les
// dupliquer sur une autre page : deux écrans éditant le même réglage avec
// chacun leur état local peuvent s'écraser.
function PassTab({ rights }) {
  return (
    <div>
      {rights.tariffBlocks && <PassLivreursSection />}
      {rights.passSettings && <div style={{ marginTop: 16 }}><PassForfaitSettings /></div>}
    </div>
  )
}

// ── Onglet DEM Pro ────────────────────────────────────────────────────────────
function DemProTab({ rights }) {
  const { config, setConfig, error } = useAppConfig()
  const [showLegacy, setShowLegacy] = useState(false)
  if (!config) return <ConfigLoading error={error} />
  const onSaved = d => setConfig(c => ({ ...c, ...d }))

  return (
    <div>
      <ConfigBlock title="Paiement intégré DEM Pro" keys={['dem_pro_commission_rate']} config={config} canEdit={rights.edit} onSaved={onSaved} />

      {/* Paliers Starter/Business/Premium : réglés dans DEM Pro > Offres DEM Pro
          (prix, limites, interrupteur et suivi au même endroit). */}
      <Link to="/dem-pro?onglet=offres" style={{ ...glass, display: 'block', padding: '14px 18px', textDecoration: 'none', color: 'inherit', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Paliers DEM Pro Starter / Business / Premium</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Prix, limites et activation se règlent dans <span style={{ color: 'var(--primary)', fontWeight: 600 }}>DEM Pro › Offres DEM Pro →</span>
        </div>
      </Link>

      <button onClick={() => setShowLegacy(v => !v)} style={{ ...btnOutline, marginBottom: 12 }}>
        Ancien système (gelé) — prix Pro et Business {showLegacy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showLegacy && (
        <ConfigBlock title="Ancien système DEM Pro (gelé)" keys={['dem_pro_price_pro', 'dem_pro_price_business']} config={config} canEdit={rights.edit} onSaved={onSaved} />
      )}
    </div>
  )
}

// ── Onglet Réglage technique ──────────────────────────────────────────────────
function TechTab({ rights }) {
  const { config, setConfig, error } = useAppConfig()
  if (!config) return <ConfigLoading error={error} />
  return (
    <ConfigBlock
      title="Suivi du coursier en course"
      keys={['driver_location_interval_sec']}
      config={config}
      canEdit={rights.edit}
      onSaved={d => setConfig(c => ({ ...c, ...d }))}
    />
  )
}

// ── Onglet Heures de pointe ───────────────────────────────────────────────────
const DEFAULT_SURGE = { enabled: false, shifts: [] }

function SurgeTab({ canEdit }) {
  const [server,  setServer]  = useState(null)   // valeur serveur (référence)
  const [enabled, setEnabled] = useState(false)
  const [shifts,  setShifts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/config')
      const row = (res.data ?? []).find(r => r.key === 'surge_config')
      const val = row?.value ?? DEFAULT_SURGE
      setServer(val)
      setEnabled(val.enabled ?? false)
      setShifts((val.shifts ?? []).map(s => ({ ...s })))
    } catch (e) { setError(e.response?.data?.message ?? 'Chargement impossible.') }
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
    setSaving(true); setError('')
    try {
      const value = { enabled, shifts }
      await api.put('/admin/config', { updates: [{ key: 'surge_config', value }] })
      setServer(value)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de la sauvegarde.')
    } finally { setSaving(false) }
  }

  const hasChanges = server && JSON.stringify({ enabled, shifts }) !== JSON.stringify(server)

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ ...glass, padding: '18px 22px', marginBottom: 16 }}>
        {/* En-tête du bloc : titre, interrupteur, Enregistrer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Majoration aux heures de pointe</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: 12.5, maxWidth: 460 }}>
              Multipliez le tarif selon les heures de forte demande. Le multiplicateur s'applique au prix total de la course.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>
              {enabled ? 'Activée' : 'Désactivée'}
            </span>
            <button
              onClick={() => canEdit && setEnabled(v => !v)}
              disabled={!canEdit}
              title={enabled ? 'Désactiver' : 'Activer'}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: canEdit ? 'pointer' : 'not-allowed',
                background: enabled ? 'var(--primary)' : 'rgba(0,0,0,.15)',
                position: 'relative', transition: 'background .2s', opacity: canEdit ? 1 : 0.6,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: enabled ? 24 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
            {canEdit && (hasChanges || saved) && (
              <button onClick={handleSave} disabled={!hasChanges || saving} style={btnSave(hasChanges)}>
                {saved && !hasChanges ? <><CheckCircle size={14} /> Enregistré</> : <><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</>}
              </button>
            )}
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
          {enabled ? 'Les multiplicateurs sont appliqués en temps réel pendant les tranches ci-dessous.' : 'Tarif normal appliqué à toute heure.'}
        </div>
        {!canEdit && <p style={{ color: 'var(--text-muted)', fontSize: 11.5, margin: '10px 0 0' }}>{READ_ONLY_NOTE}</p>}
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>

      {/* Tableau des tranches horaires */}
      <div style={{ ...glass, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.05)' }}>
              {['Début', 'Fin', 'Multiplicateur', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Clock size={18} style={{ marginBottom: 6, opacity: .5 }} /><br />
                  Aucune tranche horaire.{canEdit ? ' Cliquez sur « Ajouter une tranche » pour commencer.' : ''}
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
                    <input type="time" value={s.start} disabled={!canEdit}
                      onChange={e => updateShift(i, 'start', e.target.value)}
                      style={{ ...glassInput, width: 120, textAlign: 'center', fontWeight: 600,
                        border: `1px solid ${startChanged ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <input type="time" value={s.end} disabled={!canEdit}
                      onChange={e => updateShift(i, 'end', e.target.value)}
                      style={{ ...glassInput, width: 120, textAlign: 'center', fontWeight: 600,
                        border: `1px solid ${endChanged ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                    />
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" step="0.1" min="1" value={s.multiplier} disabled={!canEdit}
                        onChange={e => updateShift(i, 'multiplier', e.target.value)}
                        style={{ ...glassInput, width: 80, textAlign: 'center', fontWeight: 700,
                          color: 'var(--primary)',
                          border: `1px solid ${multChanged ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>×</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {canEdit && (
                      <button onClick={() => removeShift(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', opacity: .7, padding: 4 }}
                        title="Supprimer cette tranche">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <button onClick={addShift} style={{ ...btnOutline, marginTop: 12 }}>
          <Plus size={14} /> Ajouter une tranche
        </button>
      )}

      {/* Aperçu */}
      {shifts.length > 0 && (
        <div style={{ ...glass, padding: '16px 20px', marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '.5px' }}>APERÇU</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {shifts.map((s, i) => (
              <div key={i} style={{
                background: enabled ? 'rgba(0,119,182,.08)' : 'var(--surface2)',
                borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 13,
                border: `1px solid ${enabled ? 'rgba(0,119,182,.15)' : 'rgba(0,0,0,.06)'}`,
              }}>
                <span style={{ fontWeight: 600 }}>{s.start} – {s.end}</span>
                <span style={{ marginLeft: 8, fontWeight: 800, color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>×{s.multiplier}</span>
              </div>
            ))}
          </div>
          {!enabled && (
            <p style={{ color: '#e67e22', fontSize: 11, marginTop: 10, fontWeight: 500 }}>
              La majoration est désactivée. Activez-la pour que ces tranches soient prises en compte.
            </p>
          )}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
        Champs en bleu = modifications non enregistrées. Les multiplicateurs s'appliquent au prix total de la course pendant les heures configurées.
      </p>
    </div>
  )
}
