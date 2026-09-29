import { useState, useEffect, useCallback } from 'react'
import { Save } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { glass, glassInput, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

// Section "Paliers DEM Pro" de la page Tarifs (Config) — édite ProPlanLimits
// (voir dem-backend/src/modules/dem_pro/dem_pro.limits.js), le NOUVEAU
// système d'abonnement Starter/Business/Premium (docs/DEM_Pro_Offres_V1.pdf).
// Volontairement séparée des champs `dem_pro_price_pro`/`dem_pro_price_business`
// plus haut sur cette page — ceux-là appartiennent à l'ANCIEN système
// FREE/PRO/BUSINESS, encore en prod et qu'on ne touche plus : voir la
// décision "on se base plus sur l'ancien système, on complète le nouveau,
// puis bascule + suppression de l'ancien en une fois" — ne PAS fusionner
// les deux tant que cette bascule n'a pas eu lieu.
//
// Rappel : tant que `dem_pro_tiers_active` (AppConfig) est désactivé, éditer
// ces valeurs n'a AUCUN effet en prod (voir dem_pro.limits.js) — cette
// section est utilisable dès maintenant pour préparer la config avant la
// bascule, sans risque.
const PLAN_ORDER = ['STARTER', 'BUSINESS', 'PREMIUM']
const PLAN_LABELS = { STARTER: 'Starter', BUSINESS: 'Business', PREMIUM: 'Premium' }

// type: 'number' | 'nullableNumber' (vide = illimité) | 'boolean' | 'select'
const FIELDS = [
  { key: 'priceMonthly',              label: 'Prix',                              type: 'number',          unit: 'F / mois' },
  { key: 'maxBatchSimultaneous',      label: 'Tournées groupées simultanées',     type: 'nullableNumber' },
  { key: 'maxScheduledSimultaneous',  label: 'Commandes programmées simultanées', type: 'nullableNumber' },
  { key: 'maxCatalogues',             label: 'Catalogues',                        type: 'nullableNumber' },
  { key: 'maxProducts',               label: 'Produits',                          type: 'nullableNumber' },
  { key: 'maxAddresses',              label: 'Adresses / points de vente',        type: 'nullableNumber' },
  { key: 'maxUsers',                  label: 'Utilisateurs par compte',           type: 'number' },
  { key: 'withdrawalWeeklyCapFcfa',   label: 'Plafond de retrait',                type: 'nullableNumber', unit: 'F / sem' },
  { key: 'analyticsMaxPeriodDays',    label: 'Fenêtre analytics',                 type: 'number',          unit: 'jours' },
  { key: 'onlineSalesEnabled',        label: 'Vente en ligne',                    type: 'boolean' },
  { key: 'apiAccessEnabled',          label: 'API DEM',                           type: 'boolean' },
  { key: 'invoiceBatchEnabled',       label: 'Facturation groupée',               type: 'boolean' },
  { key: 'financeViewsEnabled',       label: 'Vues Finances/Activité + export',   type: 'boolean' },
  { key: 'crmEnabled',                label: 'Mes clients / CRM',                 type: 'boolean' },
  { key: 'invoiceEnabled',            label: 'Facture par commande',              type: 'boolean' },
  { key: 'supportTier',               label: 'Support',                           type: 'select', options: ['standard', 'priority', 'premium'] },
]

function Section({ title, children }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  )
}

function Cell({ field, value, onChange, editable, changed }) {
  if (!editable) {
    let display = value
    if (field.type === 'nullableNumber') display = value == null ? 'Illimité' : value.toLocaleString()
    else if (field.type === 'number') display = value?.toLocaleString?.() ?? value
    else if (field.type === 'boolean') display = value ? '✓' : '—'
    return <div style={{ fontSize: 13, padding: '4px 6px', color: value === true ? 'var(--primary)' : undefined }}>{display}</div>
  }

  if (field.type === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          background: value ? 'var(--primary)' : 'rgba(0,0,0,.15)', position: 'relative', flexShrink: 0,
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    )
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...glassInput, padding: '5px 6px', fontSize: 12, width: 100 }}>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  // number / nullableNumber
  return (
    <input
      type="number" min={0}
      value={value ?? ''}
      placeholder={field.type === 'nullableNumber' ? 'Illimité' : undefined}
      onChange={e => onChange(e.target.value === '' ? (field.type === 'nullableNumber' ? null : 0) : Number(e.target.value))}
      style={{
        ...glassInput, width: 90, padding: '5px 6px', fontSize: 12, textAlign: 'center',
        fontWeight: changed ? 700 : 500,
        border: `1px solid ${changed ? 'var(--primary)' : 'rgba(0,119,182,.2)'}`,
        color: changed ? 'var(--primary)' : undefined,
      }}
    />
  )
}

export default function DemProTiersSection() {
  const [data, setData] = useState(null)   // { STARTER: {...}, BUSINESS: {...}, PREMIUM: {...} }
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const { user } = useAuth()
  const isSuper = user?.adminRole === 'SUPER'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/dem-pro-tiers')
      const byPlan = Object.fromEntries((res.data.tiers ?? []).map(t => [t.plan, t]))
      setData(byPlan)
      setDraft(byPlan)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function updateField(plan, key, value) {
    setDraft(prev => ({ ...prev, [plan]: { ...prev[plan], [key]: value } }))
  }

  const hasChanges = draft && data && PLAN_ORDER.some(plan =>
    FIELDS.some(f => draft[plan]?.[f.key] !== data[plan]?.[f.key]),
  )

  async function save() {
    setSaving(true); setError('')
    try {
      const writes = PLAN_ORDER
        .map(plan => {
          const changes = {}
          for (const f of FIELDS) {
            if (draft[plan]?.[f.key] !== data[plan]?.[f.key]) changes[f.key] = draft[plan][f.key]
          }
          return { plan, changes }
        })
        .filter(({ changes }) => Object.keys(changes).length > 0)

      await Promise.all(writes.map(({ plan, changes }) => api.put(`/admin/dem-pro-tiers/${plan}`, changes)))
      await load()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur lors de la sauvegarde.') }
    finally { setSaving(false) }
  }

  if (loading || !data || !draft) {
    return <Section title="Paliers DEM Pro (Starter / Business / Premium)"><div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div></Section>
  }

  return (
    <>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>{error}</div>}

      <Section title="Paliers DEM Pro (Starter / Business / Premium)">
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>
          Nouveau système d'abonnement (remplacera Gratuit/Pro/Business une fois complet — l'ancien reste inchangé
          plus haut sur cette page). Sans effet en prod tant que l'interrupteur global n'est pas activé.
          {!isSuper && ' Lecture seule — seul un SUPER peut modifier ces valeurs.'}
        </p>

        <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...stickyThCol, padding: '6px 10px', fontSize: 10.5, textAlign: 'left', minWidth: 200 }}>Fonctionnalité</th>
                {PLAN_ORDER.map(plan => (
                  <th key={plan} style={{ ...stickyTh, padding: '6px 10px', fontSize: 11, fontWeight: 700, minWidth: 110 }}>{PLAN_LABELS[plan]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(field => (
                <tr key={field.key}>
                  <td style={{ ...stickyCol, padding: '5px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {field.label}{field.unit ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({field.unit})</span> : null}
                  </td>
                  {PLAN_ORDER.map(plan => (
                    <td key={plan} style={{ padding: '4px 10px', textAlign: 'center' }}>
                      <Cell
                        field={field}
                        value={draft[plan]?.[field.key]}
                        changed={draft[plan]?.[field.key] !== data[plan]?.[field.key]}
                        editable={isSuper}
                        onChange={v => updateField(plan, field.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isSuper && (
          <button onClick={save} disabled={saving || !hasChanges} style={btnPrimary(hasChanges)}>
            <Save size={13} /> {saved ? 'Enregistré ✓' : saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        )}
      </Section>
    </>
  )
}

const btnPrimary = (active) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none',
  background: active ? 'var(--primary)' : 'rgba(0,0,0,.15)', color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: active ? 'pointer' : 'default', opacity: active ? 1 : 0.6,
})
