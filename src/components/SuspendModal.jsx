import { useState } from 'react'
import { glassModal, glassInput } from '../lib/glassStyles'

const DRIVER_REASONS = [
  {
    label: 'Documents manquants ou expirés',
    fix: 'Mettez à jour vos documents (permis, assurance, carte grise) dans votre profil.',
  },
  {
    label: 'Photo de véhicule non conforme',
    fix: 'Prenez une nouvelle photo de votre véhicule avec la plaque d\'immatriculation bien visible.',
  },
  {
    label: 'Comportement signalé par un client',
    fix: 'Contactez le support DEM pour régulariser votre situation avant de reprendre.',
  },
  {
    label: 'Non-respect du code de conduite',
    fix: 'Relisez les conditions d\'utilisation DEM et le code de conduite livreur.',
  },
  {
    label: 'Casque non conforme ou absent',
    fix: 'Équipez-vous d\'un casque homologué avant de reprendre votre activité.',
  },
  {
    label: 'Inactivité prolongée (+ 30 jours)',
    fix: 'Reconnectez-vous à l\'application et confirmez votre disponibilité.',
  },
]

const AMBASSADOR_REASONS = [
  {
    label: 'Documents d\'entreprise manquants ou invalides',
    fix: 'Mettez à jour vos documents (NINEA, RCCM, CNI) dans votre profil chef de flotte.',
  },
  {
    label: 'Flotte non opérationnelle (< 3 livreurs actifs)',
    fix: 'Activez au minimum 3 livreurs dans votre flotte pour être opérationnel.',
  },
  {
    label: 'Comportement signalé',
    fix: 'Contactez le support DEM pour régulariser votre situation.',
  },
  {
    label: 'Non-respect des règles de gestion de flotte',
    fix: 'Relisez les conditions d\'utilisation de l\'espace chef de flotte DEM.',
  },
  {
    label: 'Informations de profil incorrectes',
    fix: 'Corrigez vos informations personnelles et d\'entreprise dans votre profil.',
  },
]

export default function SuspendModal({
  target, onConfirm, onClose, loading,
  title = 'Motif de suspension',
  description = 'Cochez les raisons applicables — elles seront envoyées par notification.',
  confirmLabel = 'Confirmer la suspension',
  loadingLabel = 'Suspension…',
}) {
  const reasons = target === 'ambassador' ? AMBASSADOR_REASONS : DRIVER_REASONS
  const [checked, setChecked]   = useState([])
  const [custom, setCustom]     = useState('')

  function toggle(label) {
    setChecked(prev =>
      prev.includes(label) ? prev.filter(r => r !== label) : [...prev, label]
    )
  }

  function buildReason() {
    const parts = checked.slice()
    if (custom.trim()) parts.push(custom.trim())
    return parts.join(' · ')
  }

  function buildFix() {
    return checked
      .map(label => reasons.find(r => r.label === label)?.fix)
      .filter(Boolean)
      .join(' ')
  }

  const canSubmit = checked.length > 0 || custom.trim().length > 0

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glassModal, width: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {description}
            </div>
          </div>
        </div>

        {/* Raisons cochables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {reasons.map(r => {
            const selected = checked.includes(r.label)
            return (
              <label key={r.label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: selected ? 'rgba(239,68,68,.06)' : 'rgba(0,0,0,.02)',
                border: `1.5px solid ${selected ? 'rgba(239,68,68,.35)' : 'rgba(0,0,0,.07)'}`,
                transition: 'all .15s',
              }}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(r.label)}
                  style={{ marginTop: 2, accentColor: '#dc2626', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selected ? '#dc2626' : 'var(--text)' }}>
                    {r.label}
                  </div>
                  {selected && (
                    <div style={{ fontSize: 11, color: '#15803d', marginTop: 3, lineHeight: 1.4 }}>
                      ✅ Correction : {r.fix}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        {/* Note libre */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Note complémentaire (optionnel)
          </label>
          <textarea
            value={custom}
            onChange={e => setCustom(e.target.value)}
            placeholder="Précisions supplémentaires…"
            rows={3}
            style={{ ...glassInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        {/* Aperçu */}
        {canSubmit && (
          <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>📱 Notification envoyée :</div>
            <div style={{ color: 'var(--text)', marginBottom: 4 }}><strong>Motif :</strong> {buildReason()}</div>
            {buildFix() && <div style={{ color: '#15803d' }}><strong>À corriger :</strong> {buildFix()}</div>}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={btnCancel} disabled={loading}>Annuler</button>
          <button
            onClick={() => onConfirm(buildReason(), buildFix())}
            disabled={!canSubmit || loading}
            style={{ ...btnDanger, opacity: (!canSubmit || loading) ? 0.5 : 1 }}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay   = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const btnCancel = { padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', background: 'rgba(255,255,255,.6)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const btnDanger = { padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700 }
