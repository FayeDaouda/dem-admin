import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

// ── Interrupteurs DEM Pro ─────────────────────────────────────────────────────
// GET/PUT /admin/dem-pro-settings (SUPER pour l'écriture) :
//   - tiersActive : paliers Starter/Business/Premium en vente
//     (AppConfig 'dem_pro_tiers_active'). À `false`, tout le nouveau système
//     de gating reste inerte quel que soit le contenu de `proPlan` en base.
//   - paidOnly : comptes payants obligatoires (AppConfig 'dem_pro_paid_only').
//     Un compte Gratuit (ou dont l'offre est terminée) reste bloqué sur la
//     page des offres de l'app tant qu'il n'a pas payé une offre ou lancé
//     l'essai Business de 7 jours. Demande les paliers actifs.
export default function TiersActiveToggle({ onChange }) {
  const [settings, setSettings] = useState(null) // null = pas encore chargé
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/dem-pro-settings')
      setSettings(res.data)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(patch) {
    setSaving(true); setError('')
    try {
      const res = await api.put('/admin/dem-pro-settings', patch)
      setSettings(res.data)
      onChange?.()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  function toggleTiers() {
    const next = !settings.tiersActive
    if (next && !confirm(
      "Activer les nouveaux paliers Starter/Business/Premium ?\n\n" +
      "Prérequis : prix des paliers posés (seed) et mise à jour de l'app publiée.\n" +
      "Juste après l'activation : lancer la migration de données (migrate_pro_plan_tiers.sql) — " +
      "tant qu'elle n'a pas tourné, les comptes Pro restent sur l'ancien système, sans perte d'accès."
    )) return
    if (!next && settings.paidOnly && !confirm(
      "Désactiver les paliers désactive aussi « Comptes payants obligatoires ». Continuer ?"
    )) return
    save(next ? { tiersActive: true } : { tiersActive: false, paidOnly: false })
  }

  function togglePaidOnly() {
    const next = !settings.paidOnly
    if (next && !confirm(
      "Rendre les comptes DEM Pro payants ?\n\n" +
      "Les comptes sans offre (et ceux dont l'essai ou la semaine payée est terminé) resteront " +
      "bloqués sur la page des 3 offres de l'app tant qu'ils n'ont pas payé une offre ou lancé " +
      "l'essai Business gratuit de 7 jours.\n\n" +
      "Prérequis : la version de l'app avec la fenêtre des offres est publiée sur les stores."
    )) return
    save({ paidOnly: next })
  }

  if (settings === null) return null // chargement initial

  return (
    <div style={{ ...glass, padding: '4px 18px', marginBottom: 16 }}>
      <Row
        title="Paliers Starter / Business / Premium"
        hint={settings.tiersActive
          ? 'Actif — les nouvelles règles de palier s\'appliquent aux comptes Starter / Business / Premium.'
          : 'Inactif — comportement identique à aujourd\'hui, même avec le backend déployé.'}
        on={settings.tiersActive}
        disabled={saving}
        onToggle={toggleTiers}
      />
      <div style={{ height: 1, background: 'rgba(0,0,0,.07)' }} />
      <Row
        title="Comptes payants obligatoires"
        hint={!settings.tiersActive
          ? 'Disponible une fois les paliers activés.'
          : settings.paidOnly
            ? 'Actif — un compte sans offre (ou dont l\'offre est terminée) est bloqué sur la page des offres jusqu\'à l\'essai Business de 7 jours ou au paiement.'
            : 'Inactif — les comptes Gratuit créent leurs courses comme aujourd\'hui.'}
        on={settings.paidOnly}
        disabled={saving || (!settings.tiersActive && !settings.paidOnly)}
        onToggle={togglePaidOnly}
      />
      <div style={{ height: 1, background: 'rgba(0,0,0,.07)' }} />
      <Row
        title="Parrainage DEM Pro"
        hint={!settings.tiersActive
          ? 'Disponible une fois les paliers activés (une récompense est du temps d\'offre).'
          : settings.referralActive
            ? 'Actif — les commerçants peuvent saisir un code de parrainage. Aucune récompense automatique : elles sont attribuées depuis l\'onglet Parrainage.'
            : 'Inactif — les codes de parrainage saisis à l\'inscription DEM Pro sont ignorés.'}
        on={settings.referralActive}
        disabled={saving}
        onToggle={() => save({ referralActive: !settings.referralActive })}
      />
      {settings.referralActive && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 0 12px' }}>
          <NumberSetting
            label="Jours proposés par défaut pour une récompense"
            value={settings.referralDays}
            min={1} max={60}
            disabled={saving}
            onSave={v => save({ referralDays: v })}
          />
        </div>
      )}
      {error && <div style={{ color: 'var(--danger)', fontSize: 11, padding: '0 0 10px' }}>{error}</div>}
    </div>
  )
}

// Champ numérique enregistré au clic sur « OK » (borné comme le serveur).
function NumberSetting({ label, value, min, max, disabled, onSave }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const n = Number(draft)
  const valid = Number.isInteger(n) && n >= min && n <= max
  const changed = valid && n !== value
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
      {label}
      <input
        type="number" min={min} max={max} value={draft}
        onChange={e => setDraft(e.target.value)}
        style={{ width: 64, padding: '5px 8px', borderRadius: 8, border: `1px solid ${valid ? 'rgba(0,119,182,.25)' : 'var(--danger)'}`, background: 'rgba(255,255,255,.6)', fontSize: 13 }}
      />
      {changed && (
        <button
          onClick={() => onSave(n)} disabled={disabled}
          style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >OK</button>
      )}
    </label>
  )
}

function Row({ title, hint, on, disabled, onToggle }) {
  return (
    <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 240px' }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{hint}</div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={on}
        aria-label={title}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'default' : 'pointer',
          background: on ? 'var(--primary)' : 'rgba(0,0,0,.15)', opacity: disabled && !on ? 0.5 : 1,
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 24 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  )
}
