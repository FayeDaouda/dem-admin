import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'

// Offre de lancement « 100 premiers clients » (GET /admin/acquisition/free-course,
// Super Admin seul côté serveur) — ancien onglet 100 Clients du Plan
// d'acquisition, affiché dans Marketing › Acquisition (plan de refonte, 3.4).
const Card = ({ children, style = {} }) => (
  <div style={{ ...glass, padding: '20px 24px', ...style }}>{children}</div>
)

const StatBox = ({ label, value, color }) => (
  <div style={{ ...glass, padding: '14px 16px', flex: '1 1 140px' }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
  </div>
)

export default function FreeCourseSection() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  const load = useCallback(() => {
    api.get('/admin/acquisition/free-course')
      .then(r => setData(r.data))
      .catch(() => { /* silencieux */ })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const slots     = data?.slots ?? 100
  const filled    = data?.filled ?? 0
  const remaining = data?.remaining ?? 100
  const used      = data?.usedCount ?? 0
  const clients   = (data?.clients ?? []).filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  const pct = Math.round(filled / slots * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Compteur */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatBox label="Places occupées" value={`${filled} / ${slots}`} />
        <StatBox label="Restantes" value={remaining} color={remaining > 10 ? '#22c55e' : '#ef4444'} />
        <StatBox label="Offre utilisée" value={used} color="var(--primary)" />
      </div>

      {/* Progress bar */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Remplissage des 100 places</span>
          <span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
        </div>
        <div style={{ height: 10, background: 'rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 10, transition: 'width .4s',
            width: `${pct}%`,
            background: filled >= slots ? '#ef4444' : 'var(--primary)',
          }} />
        </div>
      </Card>

      {/* Recherche */}
      <input
        placeholder="Rechercher par nom ou téléphone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...glassInput, maxWidth: 340 }}
      />

      {/* Liste */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.06)' }}>
              {['#', 'Nom', 'Téléphone', 'Commandes', 'Offre'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,.05)' }}>
                <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontWeight: 700 }}>{c.rank}</td>
                <td style={{ padding: '9px 14px', fontWeight: 600 }}>{c.name || '—'}</td>
                <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{c.phone}</td>
                <td style={{ padding: '9px 14px' }}>{c.totalOrders}</td>
                <td style={{ padding: '9px 14px' }}>
                  {c.usedOffer
                    ? <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 12 }}>🎁 Utilisée</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Non utilisée</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Aucun résultat</div>
        )}
      </Card>
    </div>
  )
}
