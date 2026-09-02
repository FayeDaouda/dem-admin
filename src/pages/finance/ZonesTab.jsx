import { useState, useEffect, useCallback } from 'react'
import { Send, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput, stickyTh, stickyCol, stickyThCol } from '../../lib/glassStyles'

// RIDE (Thiak Thiak) retiré — plus d'actualité. Seul DELIVERY reste tarifé
// par zone ; si RIDE revient un jour, réintroduire un sélecteur ici (voir
// ORDER_TYPES côté zone-pricing.js backend).
const ORDER_TYPE = 'DELIVERY'

function Section({ title, children }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  )
}

function Toggle({ label, description, active, onToggle, toggling }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{label}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11.5, maxWidth: 460 }}>{description}</div>
      </div>
      <button
        onClick={onToggle}
        disabled={toggling}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: toggling ? 'wait' : 'pointer',
          background: active ? 'var(--primary)' : 'rgba(0,0,0,.15)',
          position: 'relative', transition: 'background .2s', opacity: toggling ? 0.6 : 1, flexShrink: 0,
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

// zoneA/zoneB triés alphabétiquement -> une seule ligne par paire non-ordonnée
// (tarif symétrique A->B = B->A, voir zone-pricing.js côté backend)
function sortedPair(idA, idB) {
  return idA <= idB ? [idA, idB] : [idB, idA]
}

function findPrice(fares, idA, idB, orderType) {
  const [zoneA, zoneB] = sortedPair(idA, idB)
  return fares.find(f => f.zoneA === zoneA && f.zoneB === zoneB && f.orderType === orderType)
}

export default function ZonesTab() {
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [togglingFlag, setTogglingFlag] = useState(null)
  const [previewedFromOsrm, setPreviewedFromOsrm] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/zone-fares/config')
      setData(res.data)
      setDraft(res.data.fares)
      setPreviewedFromOsrm(false)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleFlag(key) {
    setTogglingFlag(key); setError('')
    try {
      await api.patch('/admin/zone-fares/flags', { [key]: !data[key] })
      await load()
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setTogglingFlag(null) }
  }

  async function regeneratePreview() {
    setRegenerating(true); setError('')
    try {
      const res = await api.post('/admin/zone-fares/regenerate-preview')
      setDraft(res.data.fares)
      setPreviewedFromOsrm(true)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setRegenerating(false) }
  }

  async function submitProposal(reasonText) {
    setSubmitting(true); setError('')
    try {
      await api.post('/admin/requests', {
        kind: 'TARIFF_CHANGE', payload: { target: 'zone_fares', changes: { fares: draft } }, reason: reasonText || undefined,
      })
      await load()
      setReason('')
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setSubmitting(false) }
  }

  function updatePrice(idA, idB, value) {
    const [zoneA, zoneB] = sortedPair(idA, idB)
    const price = Number.parseInt(value, 10) || 0
    setDraft(prev => prev.map(f => (f.zoneA === zoneA && f.zoneB === zoneB && f.orderType === ORDER_TYPE) ? { ...f, price } : f))
  }

  if (loading || !data || !draft) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const zones = data.zones
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(data.fares)

  return (
    <div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>{error}</div>}

      <Section title="Interrupteurs">
        <Toggle
          label="Pricing par zone activé"
          description={data.enabled
            ? 'Actif — les courses entre deux zones couvertes utilisent le tarif fixe ci-dessous.'
            : 'Désactivé — comportement actuel inchangé (formule distance × prix/km pour toutes les courses).'}
          active={data.enabled}
          onToggle={() => toggleFlag('enabled')}
          toggling={togglingFlag === 'enabled'}
        />
        <Toggle
          label="Distance réelle OSRM pour le repli"
          description={data.usesOsrmDistance
            ? 'Actif — les courses hors zone (ou si le pricing par zone est désactivé) sont tarifées sur la distance routière réelle.'
            : 'Désactivé — les courses hors zone retombent sur la distance à vol d\'oiseau (comportement actuel).'}
          active={data.usesOsrmDistance}
          onToggle={() => toggleFlag('usesOsrmDistance')}
          toggling={togglingFlag === 'usesOsrmDistance'}
        />
      </Section>

      <Section title="Matrice tarifaire zone-à-zone (Dakar)">
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
          {zones.length} quartiers couvrant Dakar et sa proche banlieue. Tarif symétrique (A→B = B→A) : éditez une cellule au-dessus de la diagonale,
          la cellule symétrique en dessous suit automatiquement. Les quartiers hors de cette liste (Sébikotane, Yenne, Sangalkam…) retombent
          sur la formule de repli tant qu'ils n'ont pas été ajoutés.
        </p>
        {data.isDefault && !previewedFromOsrm && (
          <div style={{ fontSize: 11.5, color: 'var(--primary)', background: 'rgba(0,119,182,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
            Aucune matrice enregistrée — valeurs par défaut calculées à la formule vol d'oiseau actuelle (identiques au tarif d'aujourd'hui). Cliquez « Régénérer un aperçu » pour des tarifs basés sur la distance routière réelle (OSRM).
          </div>
        )}
        {previewedFromOsrm && (
          <div style={{ fontSize: 11.5, color: 'var(--primary)', background: 'rgba(0,119,182,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
            Aperçu calculé automatiquement via OSRM — pas encore enregistré. Ajustez si besoin puis soumettez pour validation.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={regeneratePreview} disabled={regenerating} style={btnOutline}>
            <RefreshCw size={13} /> {regenerating ? 'Calcul en cours…' : 'Régénérer un aperçu (OSRM)'}
          </button>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', marginBottom: 14, borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...stickyThCol, padding: '6px 10px', fontSize: 10.5, textAlign: 'left', minWidth: 120 }}>Zone</th>
                {zones.map(z => (
                  <th key={z.id} style={{ ...stickyTh, padding: '6px 8px', fontSize: 10.5, fontWeight: 700, minWidth: 84 }}>{z.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((rowZone, i) => (
                <tr key={rowZone.id}>
                  <td style={{ ...stickyCol, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{rowZone.name}</td>
                  {zones.map((colZone, j) => {
                    const entry = findPrice(draft, rowZone.id, colZone.id, ORDER_TYPE)
                    const original = findPrice(data.fares, rowZone.id, colZone.id, ORDER_TYPE)
                    const changed = entry?.price !== original?.price
                    const editable = i <= j
                    return (
                      <td key={colZone.id} style={{ padding: '4px 6px', textAlign: 'center' }}>
                        {editable ? (
                          <input
                            type="number" min={0} value={entry?.price ?? 0}
                            onChange={e => updatePrice(rowZone.id, colZone.id, e.target.value)}
                            style={{
                              ...glassInput, width: 76, padding: '5px 6px', fontSize: 12, textAlign: 'center',
                              fontWeight: changed ? 700 : 500,
                              border: `1px solid ${changed ? 'var(--primary)' : 'rgba(0,119,182,.2)'}`,
                              color: changed ? 'var(--primary)' : undefined,
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry?.price ?? '—'}</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Motif de la proposition (optionnel)…"
          rows={2}
          style={{ ...glassInput, resize: 'vertical', marginBottom: 10 }}
        />
        {!hasChanges && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Modifiez au moins une valeur (ou régénérez un aperçu) pour pouvoir soumettre.</div>
        )}
        <button onClick={() => submitProposal(reason)} disabled={submitting || !hasChanges} style={btnPrimary}>
          <Send size={13} /> {submitting ? 'Envoi…' : 'Soumettre pour validation'}
        </button>
      </Section>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
