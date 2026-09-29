import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

// ── Interrupteur global paliers Starter/Business/Premium ──────────────────────
// AppConfig 'dem_pro_tiers_active' (même endpoint générique GET/PUT
// /admin/config que la page Config — pas de endpoint dédié, voir
// dem_pro.limits.js:getDemProTiersActive côté backend). À `false` (défaut),
// tout le nouveau système de gating reste inerte quel que soit le contenu
// de `proPlan` en base — permet de déployer le backend séparément de son
// activation réelle, synchronisée avec la sortie de la mise à jour
// frontend correspondante.
export default function TiersActiveToggle({ onChange }) {
  const [active, setActive]   = useState(null) // null = pas encore chargé
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/config')
      const row = (res.data ?? []).find(r => r.key === 'dem_pro_tiers_active')
      setActive(row?.value === 'true')
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle() {
    const next = !active
    if (next && !confirm(
      "Activer les nouveaux paliers Starter/Business/Premium ?\n\n" +
      "Prérequis : prix des paliers posés (seed) et mise à jour de l'app publiée.\n" +
      "Juste après l'activation : lancer la migration de données (migrate_pro_plan_tiers.sql) — " +
      "tant qu'elle n'a pas tourné, les comptes Pro restent sur l'ancien système, sans perte d'accès."
    )) return

    setSaving(true); setError('')
    try {
      await api.put('/admin/config', { updates: [{ key: 'dem_pro_tiers_active', value: next ? 'true' : 'false' }] })
      setActive(next)
      onChange?.()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  if (active === null) return null // chargement initial

  return (
    <div style={{ ...glass, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Paliers Starter / Business / Premium</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
          {active
            ? 'Actif — les nouvelles règles de palier s\'appliquent aux comptes Starter / Business / Premium.'
            : 'Inactif — comportement identique à aujourd\'hui, même avec le backend déployé.'}
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>{error}</div>}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: saving ? 'default' : 'pointer',
          background: active ? 'var(--primary)' : 'rgba(0,0,0,.15)',
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: active ? 24 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  )
}
