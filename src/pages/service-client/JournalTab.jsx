import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

// ── Mon journal (CM / CRM Client, C11) ──────────────────────────────────────
// Les actions du CM, les plus récentes d'abord (GET /admin/cm/journal, même
// source que la page Audit, où le Super Admin filtre par membre).
const ACTION_LABELS = {
  GRANT_REWARD:          'Récompense attribuée',
  CANCEL_REWARD:         'Récompense annulée',
  SUBMIT_ADMIN_REQUEST:  'Demande envoyée au Super Admin',
  REPLY_ADMIN_REQUEST:   'Précision envoyée',
  UPDATE_INCIDENT:       'Incident mis à jour',
  TEST_BROADCAST:        'Notification de test',
  SEND_BROADCAST:        'Notification envoyée',
  SCHEDULE_BROADCAST:    'Notification programmée',
  CANCEL_SCHEDULED_BROADCAST: 'Notification programmée annulée',
  ADD_ORDER_NOTE:        'Note sur une course',
  UPDATE_CLIENT_FOLLOWUP: 'Suivi client mis à jour',
  CREATE_CLIENT_SEGMENT: 'Segment créé',
  CREATE_PROMO:          'Code de campagne créé',
}
const fmt = d => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function JournalTab() {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/cm/journal', { params: { limit: 100 } })
      .then(r => setEntries(r.data?.entries ?? []))
      .catch(e => setError(e.response?.data?.message ?? 'Journal indisponible.'))
  }, [])

  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>
  if (!entries) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  if (entries.length === 0) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucune action pour le moment.</div>

  return (
    <div style={{ ...glass, padding: 0, overflow: 'hidden' }}>
      {entries.map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,.05)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 110 }}>{fmt(e.createdAt)}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ACTION_LABELS[e.action] ?? e.action}</span>
          {e.target && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{e.target.name ?? '—'} · {e.target.phone}</span>}
        </div>
      ))}
    </div>
  )
}
