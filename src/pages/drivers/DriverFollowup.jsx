import { useState, useEffect } from 'react'
import api from '../../lib/api'
import InternalNotes from '../../components/InternalNotes'

// ── Fiche coursier enrichie (Responsable de flottes, C7) ────────────────────
// Historique de connexion jour par jour (7 / 30 jours) et notes internes
// datées — visibles du Super Admin et du Responsable de flottes, jamais du
// coursier. `Section` : la section de la fiche (titre).

function fmtDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}
const fmtDay = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

export function ConnectionHistory(props) {
  const { driverId, Section } = props
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.get(`/admin/drivers/${driverId}/connection-history`, { params: { days } })
      .then(r => { if (alive) { setData(r.data); setError('') } })
      .catch(e => alive && setError(e.response?.data?.message ?? 'Historique indisponible.'))
    return () => { alive = false }
  }, [driverId, days])

  const max = Math.max(1, ...(data?.history ?? []).map(r => r.onlineSeconds))
  return (
    <Section title="Historique de connexion">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {[7, 30].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(0,119,182,.25)',
            background: days === d ? 'var(--primary)' : 'transparent', color: days === d ? '#fff' : 'var(--text-muted)',
          }}>{d} j</button>
        ))}
        {data && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtDuration(data.totals.onlineSeconds)} en ligne · {data.totals.accepted} acceptée{data.totals.accepted > 1 ? 's' : ''} · {data.totals.delivered} livrée{data.totals.delivered > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {[...data.history].reverse().map(r => (
            <div key={r.date} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 70px 64px', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{fmtDay(r.date)}</span>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,.06)' }}>
                <div style={{ width: `${Math.round(r.onlineSeconds / max * 100)}%`, height: '100%', borderRadius: 4, background: '#7c3aed' }} />
              </div>
              <span style={{ fontWeight: 600, textAlign: 'right' }}>{fmtDuration(r.onlineSeconds)}</span>
              <span style={{ color: r.accepted ? 'var(--text)' : 'var(--text-muted)', textAlign: 'right' }}>{r.accepted} course{r.accepted > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

export function DriverNotes(props) {
  const { driverId, Section } = props
  return <InternalNotes endpoint={`/admin/drivers/${driverId}/notes`} Section={Section}
    placeholder="Retard au shift, appel, avertissement… (jamais vu par le coursier)" />
}
