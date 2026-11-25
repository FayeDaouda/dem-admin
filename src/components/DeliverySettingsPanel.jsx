import { useState, useEffect } from 'react'
import { PackageCheck, MessageSquareText, Save, AlertTriangle, Store } from 'lucide-react'
import api from '../lib/api'
import { glass } from '../lib/glassStyles'
import InlineConfirm from './InlineConfirm'

// ── Remise du colis (SUPER) ───────────────────────────────────────────────────
// Code de livraison (4 chiffres donnés par le destinataire au livreur) et SMS
// au destinataire avec le lien de suivi. Serveur : admin/delivery-settings.js.

const MODES = [
  {
    key: 'off',
    label: 'Éteint',
    help: 'Aucun code. La remise se fait comme avant.',
  },
  {
    key: 'show',
    label: 'Affiché',
    help: 'Le code est créé au départ du colis, envoyé au destinataire et visible par le client. Le livreur peut le saisir, mais la remise reste possible sans.',
  },
  {
    key: 'required',
    label: 'Obligatoire',
    help: 'La remise exige le bon code. Les livreurs dont l\'app est plus ancienne que 1.2.4 ne pourront plus terminer leurs courses.',
  },
]

// Code de retrait (commandes DEM Pro) : la boutique le donne au coursier.
// Réglé par le Super Admin ; l'admin valide toujours un retrait sans code
// pour régler une course (Commandes › Colis récupéré).
const PICKUP_MODES = [
  { key: 'off', label: 'Éteint', help: 'Aucun code au retrait.' },
  { key: 'show', label: 'Affiché', help: 'Le commerçant reçoit le code dès qu\'un coursier accepte (notification + suivi). L\'app du coursier le demande au retrait, avec « Continuer sans code » : jamais bloquant. Un retrait sans code est signalé sur la fiche de la course.' },
  { key: 'required', label: 'Obligatoire', help: 'Le retrait exige le bon code. À activer seulement quand les coursiers sont en 1.2.5 : les versions plus anciennes ne savent pas le demander. En cas de souci, « Colis récupéré » (Commandes) valide sans code.' },
]

export default function DeliverySettingsPanel() {
  const [data, setData]       = useState(null)
  const [mode, setMode]       = useState('off')
  const [tracking, setTracking] = useState(true)
  const [pickupMode, setPickupMode] = useState('off')
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    api.get('/admin/delivery-settings')
      .then(({ data }) => { setData(data); setMode(data.deliveryCodeMode); setTracking(data.receiverTrackingSms); setPickupMode(data.pickupCodeMode ?? 'off') })
      .catch(err => {
        if (err.response?.status === 404) setUnavailable(true) // serveur pas encore à jour
        else setError(err.response?.data?.message ?? 'Erreur de chargement.')
      })
  }, [])

  if (unavailable) return null

  const hasPickup = data?.pickupCodeMode !== undefined // serveur à jour
  const changed = data && (mode !== data.deliveryCodeMode || tracking !== data.receiverTrackingSms || (hasPickup && pickupMode !== data.pickupCodeMode))
  const r = data?.readiness
  const known = r ? r.ready + r.notReady : 0
  const readyPct = r && r.activeDrivers > 0 ? Math.round((r.ready / r.activeDrivers) * 100) : 0
  const risky = mode === 'required' && r && r.notReady + r.unknown > 0

  async function save() {
    setSaving(true); setError(''); setDone('')
    try {
      const body = {}
      if (mode !== data.deliveryCodeMode) body.deliveryCodeMode = mode
      if (tracking !== data.receiverTrackingSms) body.receiverTrackingSms = tracking
      if (hasPickup && pickupMode !== data.pickupCodeMode) body.pickupCodeMode = pickupMode
      const { data: next } = await api.put('/admin/delivery-settings', body)
      setData(next); setMode(next.deliveryCodeMode); setTracking(next.receiverTrackingSms); setPickupMode(next.pickupCodeMode ?? 'off')
      setDone('Réglages enregistrés.')
      setConfirming(false)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Enregistrement impossible.')
    } finally { setSaving(false) }
  }

  const summary = [
    mode !== data?.deliveryCodeMode && `Code de livraison : ${MODES.find(m => m.key === mode)?.label}`,
    tracking !== data?.receiverTrackingSms && `SMS de suivi au destinataire : ${tracking ? 'activé' : 'coupé'}`,
    hasPickup && pickupMode !== data?.pickupCodeMode && `Code de retrait DEM Pro : ${PICKUP_MODES.find(m => m.key === pickupMode)?.label}`,
    hasPickup && pickupMode === 'required' && pickupMode !== data?.pickupCodeMode && 'Les coursiers sans la 1.2.5 ne pourront plus valider un retrait DEM Pro sans passer par l\'admin.',
    risky && `Attention : ${r.notReady + r.unknown} livreur(s) actif(s) pas encore en ${r.minVersion} ou inconnu(s).`,
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* ── Code de livraison ── */}
      <div style={{ ...glass, padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <PackageCheck size={16} color="var(--primary)" />
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Code de livraison</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          4 chiffres que le destinataire donne au livreur à la remise : une protection contre les fausses
          confirmations de livraison.
        </p>

        {data && (
          <div role="radiogroup" aria-label="Mode du code de livraison" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODES.map(m => (
              <label key={m.key} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1.5px solid ${mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                background: mode === m.key ? 'rgba(0,180,216,0.06)' : 'transparent',
              }}>
                <input type="radio" name="delivery-code-mode" value={m.key} checked={mode === m.key}
                  onChange={() => { setMode(m.key); setDone('') }} style={{ marginTop: 3 }} />
                <span>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.label}</span>
                  {data.deliveryCodeMode === m.key && <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>(actuel)</span>}
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{m.help}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {r && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>Livreurs prêts pour le code obligatoire</span>
              <span>{r.ready} / {r.activeDrivers} actifs ({readyPct} %)</span>
            </div>
            <div aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ width: `${readyPct}%`, height: '100%', background: readyPct >= 90 ? '#16a34a' : '#f59e0b' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Livreurs ayant livré ces {r.days} derniers jours : {r.ready} en {r.minVersion} ou plus,
              {' '}{r.notReady} sur une version plus ancienne, {r.unknown} sans version connue (connexion par SMS).
              {known === 0 && ' Aucune version connue pour l\'instant.'} Passez en « Obligatoire » quand presque tous sont prêts.
            </p>
          </div>
        )}
      </div>

      {/* ── Code de retrait (DEM Pro) ── */}
      {data && hasPickup && (
        <div style={{ ...glass, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Store size={16} color="var(--primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Code de retrait (DEM Pro)</h3>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px' }}>
            4 chiffres que la boutique donne au coursier quand il récupère le colis : le bon coursier repart avec le bon colis.
            Une tournée a un seul code. Quel que soit le mode, « Colis récupéré » (Commandes) valide sans code pour régler une course.
          </p>
          <div role="radiogroup" aria-label="Mode du code de retrait" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PICKUP_MODES.map(m => (
              <label key={m.key} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1.5px solid ${pickupMode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                background: pickupMode === m.key ? 'rgba(0,180,216,0.06)' : 'transparent',
              }}>
                <input type="radio" name="pickup-code-mode" value={m.key} checked={pickupMode === m.key}
                  onChange={() => { setPickupMode(m.key); setDone('') }} style={{ marginTop: 3 }} />
                <span>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.label}</span>
                  {data.pickupCodeMode === m.key && <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>(actuel)</span>}
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{m.help}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── SMS de suivi ── */}
      {data && (
        <div style={{ ...glass, padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MessageSquareText size={16} color="var(--primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>SMS de suivi au destinataire</h3>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={tracking} onChange={e => { setTracking(e.target.checked); setDone('') }} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Au départ du colis, le destinataire reçoit un SMS avec le lien de suivi (et le code, s'il est actif), en un seul
              SMS. Pas de SMS quand le destinataire est le client lui-même. Coût : un SMS par course concernée.
            </span>
          </label>
        </div>
      )}

      {risky && (
        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.12)', color: '#92400e', fontSize: 12.5 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {r.notReady + r.unknown} livreur(s) actif(s) ne sont pas encore en {r.minVersion} (ou version inconnue) : en mode
            obligatoire, ils ne pourront plus valider leurs remises. Demandez-leur de mettre l'app à jour d'abord.
          </span>
        </div>
      )}

      {data && (
        <div>
          {confirming && (
            <InlineConfirm lines={summary} confirmLabel="Enregistrer" danger={!!risky} busy={saving}
              onCancel={() => setConfirming(false)} onConfirm={save} />
          )}
          <button onClick={() => { setDone(''); setError(''); setConfirming(true) }} disabled={!changed || saving || confirming} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none', marginTop: 4,
            background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            opacity: !changed || saving || confirming ? 0.5 : 1,
          }}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      {done && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>{done}</div>}
    </div>
  )
}
