import { useState } from 'react'
import { glassInput } from '../../lib/glassStyles'
import RequestModal from '../../components/RequestModal'

// Demandes du Responsable de flottes sur un coursier (niveau 2) : suspension
// de plus de 72 h ou définitive, réactivation d'un coursier qu'il n'a pas
// suspendu, suppression, pass offert. Appliquées à la validation du Super.
const SUSPEND_DURATIONS = [
  { hours: 24 * 7,  label: '7 jours' },
  { hours: 24 * 30, label: '30 jours' },
  { hours: null,    label: 'Définitive (jusqu’à réactivation)' },
]

const COPY = {
  'ask-suspend':  { kind: 'DRIVER_SUSPEND',   title: 'Demander une suspension longue', intro: 'Au-delà de 72 h, la suspension demande la validation du Super Admin. En urgence, suspendez d’abord 72 h vous-même.' },
  'ask-activate': { kind: 'DRIVER_ACTIVATE',  title: 'Demander la réactivation',        intro: 'Ce coursier a été suspendu par quelqu’un d’autre : sa réactivation demande la validation du Super Admin.' },
  'ask-delete':   { kind: 'DRIVER_DELETE',    title: 'Demander la suppression',         intro: 'Le coursier sera archivé (désarchivable par le Super Admin).' },
  'ask-pass':     { kind: 'DRIVER_GIFT_PASS', title: 'Demander un pass offert',         intro: 'Pass journalier offert au coursier.' },
}

export default function DriverRequestModal({ mode, driver, onClose, onDone }) {
  const [hours, setHours] = useState(SUSPEND_DURATIONS[0].hours)
  const [days, setDays] = useState('1')
  const copy = COPY[mode]
  const who = driver.name?.trim() || driver.phone

  const payload = mode === 'ask-suspend' ? { hours } : mode === 'ask-pass' ? { days: Number(days) } : {}
  const ready = mode !== 'ask-pass' || (Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 30)

  return (
    <RequestModal
      kind={copy.kind}
      title={`${copy.title} — ${who}`}
      intro={copy.intro}
      targetUserId={driver.id}
      payload={payload}
      ready={ready}
      onClose={onClose}
      onDone={onDone}
    >
      {mode === 'ask-suspend' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Durée *</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUSPEND_DURATIONS.map(d => (
              <button key={String(d.hours)} type="button" onClick={() => setHours(d.hours)} style={chip(hours === d.hours)}>{d.label}</button>
            ))}
          </div>
        </div>
      )}
      {mode === 'ask-pass' && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nombre de jours (1 à 30) *</label>
          <input type="number" min={1} max={30} value={days} onChange={e => setDays(e.target.value)} style={{ ...glassInput, padding: '8px 10px', fontSize: 13, width: 100 }} />
        </div>
      )}
    </RequestModal>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const chip = on => ({ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on ? '#dc2626' : 'rgba(0,0,0,.1)'}`, background: on ? 'rgba(239,68,68,.08)' : 'transparent', color: on ? '#dc2626' : 'var(--text)' })
