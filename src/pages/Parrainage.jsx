import { useState, useEffect } from 'react'
import api from '../lib/api'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'

const Card = ({ children, style = {} }) => (
  <div style={{ ...glass, padding: '20px 24px', ...style }}>{children}</div>
)

const StatBox = ({ label, value, color }) => (
  <div style={{ ...glass, padding: '14px 16px', flex: '1 1 140px' }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
  </div>
)

export default function Parrainage() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/admin/acquisition/referrals')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const total    = data?.totalReferrals ?? 0
  const credits  = data?.totalCreditsDistributed ?? 0
  const referrers = (data?.referrers ?? []).filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  )

  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Parrainage</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Suivi des parrainages et credits MLM distribues.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <StatBox label="Total parrainages" value={total} />
        <StatBox label="Credits MLM distribues" value={`${credits.toLocaleString()} F`} color="var(--primary)" />
        <StatBox label="Parrains actifs" value={data?.referrers?.length ?? 0} color="#22c55e" />
      </div>

      <input
        placeholder="Rechercher un parrain..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...glassInput, maxWidth: 340, marginBottom: 20, flexShrink: 0 }}
      />

      <div style={pageScroll}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement...</div>
        ) : referrers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Aucun parrainage enregistre.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {referrers.map(r => {
              const isOpen = expanded === r.id
              const referred = r.referrals ?? []
              return (
                <Card key={r.id} style={{ padding: '14px 18px' }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: 'rgba(0,180,216,.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, color: 'var(--primary)', fontSize: 14,
                    }}>
                      {(r.name ?? '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name ?? '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.phone} · Code : {r.referralCode}</div>
                    </div>
                    <div style={{
                      padding: '4px 12px', borderRadius: 20,
                      background: 'rgba(0,180,216,.10)',
                      color: 'var(--primary)', fontWeight: 700, fontSize: 13,
                    }}>
                      {r.referralCount} filleul{r.referralCount !== 1 ? 's' : ''}
                    </div>
                    {r.referralCount > 8 && (
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠ Verifier</span>
                    )}
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {isOpen && referred.length > 0 && (
                    <div style={{ marginTop: 12, paddingLeft: 50, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {referred.map(f => (
                        <div key={f.id} style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>↳</span>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.name ?? '—'}</span>
                          <span>{f.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
