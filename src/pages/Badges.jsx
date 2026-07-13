import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'

const DEFAULT_DRIVER_BADGES = [
  { tier: 'xarit',     name: 'DEM Xarit',      emoji: '🤝', courses: 3,   referrals: 3,  rating: 0   },
  { tier: 'mbokk',     name: 'DEM Mbokk',      emoji: '👥', courses: 30,  referrals: 12, rating: 3.5 },
  { tier: 'doorWarr',  name: 'DEM Door Warr',   emoji: '✅', courses: 70,  referrals: 0,  rating: 3.5 },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', emoji: '⭐', courses: 135, referrals: 0,  rating: 4.0 },
  { tier: 'buur',      name: 'DEM Buur',       emoji: '👑', courses: 300, referrals: 0,  rating: 4.0 },
  { tier: 'gainde',    name: 'DEM Gainde',     emoji: '🏅', courses: 500, referrals: 0,  rating: 4.2 },
]

const CLIENT_VISUALS = {
  classic: { emoji: '✅', color: '#00838F', bg: 'rgba(0,131,143,.08)', border: 'rgba(0,131,143,.25)',  name: 'DEM Classic' },
  xarit:   { emoji: '🤝', color: '#0288D1', bg: 'rgba(2,136,209,.08)', border: 'rgba(2,136,209,.25)',  name: 'DEM Xarit' },
  mbokk:   { emoji: '⭐', color: '#00695C', bg: 'rgba(0,105,92,.08)',   border: 'rgba(0,105,92,.25)',   name: 'DEM Mbokk' },
  djambar: { emoji: '🏆', color: '#1565C0', bg: 'rgba(21,101,192,.08)', border: 'rgba(21,101,192,.25)', name: 'DEM Djambar' },
  buur:    { emoji: '👑', color: '#7B1FA2', bg: 'rgba(123,31,162,.08)', border: 'rgba(123,31,162,.25)', name: 'DEM Buur' },
  vip:     { emoji: '💎', color: '#7c3aed', bg: 'rgba(124,58,237,.08)', border: 'rgba(124,58,237,.25)', name: 'DEM VIP' },
}

const DRIVER_VISUALS = {
  xarit:     { emoji: '🤝', color: '#0288D1', bg: 'rgba(2,136,209,.08)',   border: 'rgba(2,136,209,.25)' },
  mbokk:     { emoji: '👥', color: '#00695C', bg: 'rgba(0,105,92,.08)',    border: 'rgba(0,105,92,.25)' },
  doorWarr:  { emoji: '✅', color: '#00838F', bg: 'rgba(0,131,143,.08)',   border: 'rgba(0,131,143,.25)' },
  domouNdey: { emoji: '⭐', color: '#1565C0', bg: 'rgba(21,101,192,.08)',  border: 'rgba(21,101,192,.25)' },
  buur:      { emoji: '👑', color: '#7B1FA2', bg: 'rgba(123,31,162,.08)',  border: 'rgba(123,31,162,.25)' },
  gainde:    { emoji: '🏅', color: '#B8860B', bg: 'rgba(184,134,11,.08)',  border: 'rgba(184,134,11,.25)' },
}

export function ClientBadgesPage() {
  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Badge client</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Consultation des badges clients.</p>
      </div>
      <div style={pageScroll}>
        <ClientBadgesTab />
      </div>
    </div>
  )
}

export function DriverBadgesPage() {
  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Badge livreur</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Consultation des badges livreurs.</p>
      </div>
      <div style={pageScroll}>
        <DriverBadgesTab />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGES CLIENTS
// ══════════════════════════════════════════════════════════════════════════════
function ClientBadgesTab() {
  const [clients, setClients] = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/clients', { params: { limit: 1000 } })
      setClients(res.data.clients ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement...</div>

  const q = search.trim().toLowerCase()
  const filteredClients = q
    ? clients.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
    : clients

  return (
    <div style={{ ...glass, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Liste des clients ({filteredClients.length})</div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone…"
          style={{ ...glassInput, width: 240 }}
        />
      </div>
      {filteredClients.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucun client trouvé.</div>
      ) : (
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Client', 'Téléphone', 'Badge actuel', 'Inscrit le'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,.10)', position: 'sticky', top: 0, background: 'var(--surface)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filteredClients.map(c => {
                const v = CLIENT_VISUALS[c.clientBadge] ?? null
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13 }}>{c.name ?? '—'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{c.phone}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {v ? (
                        <span style={{ background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          {v.emoji} {v.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sans badge</span>
                      )}
                      {c.clientBadge && !c.clientBadgeValidated && ['mbokk','djambar','buur','vip'].includes(c.clientBadge) && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#b45309' }}>⏳ non validé</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGES LIVREURS
// ══════════════════════════════════════════════════════════════════════════════
function DriverBadgesTab() {
  const [driversList, setDriversList] = useState([])
  const [badgeTiers,  setBadgeTiers]  = useState(DEFAULT_DRIVER_BADGES)
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [badgeRes, driversRes] = await Promise.all([
        api.get('/admin/badges/config'),
        api.get('/admin/drivers', { params: { limit: 1000 } }).catch(() => ({ data: { drivers: [] } })),
      ])
      const b = badgeRes.data.badges ?? DEFAULT_DRIVER_BADGES
      setBadgeTiers(b)

      const drivers = driversRes.data?.drivers ?? []
      const withBadge = drivers.map(d => {
        let matchedTier = null
        for (const tier of b) {
          const okRating = tier.rating === 0 || (d.avgRating ?? 0) >= tier.rating
          if ((d.deliveredCourses ?? 0) >= tier.courses && (d.referralCount ?? 0) >= tier.referrals && okRating) {
            matchedTier = tier.tier
            break
          }
        }
        return { ...d, badgeTier: matchedTier }
      })
      setDriversList(withBadge)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement...</div>

  const q = search.trim().toLowerCase()
  const filteredDrivers = q
    ? driversList.filter(d => d.name?.toLowerCase().includes(q) || d.phone?.includes(q))
    : driversList

  return (
    <div style={{ ...glass, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Liste des livreurs ({filteredDrivers.length})</div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone…"
          style={{ ...glassInput, width: 240 }}
        />
      </div>
      {filteredDrivers.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucun livreur trouvé.</div>
      ) : (
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Livreur', 'Téléphone', 'Véhicule', 'Courses', 'Parrainages', 'Note', 'Badge actuel'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,.10)', position: 'sticky', top: 0, background: 'var(--surface)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filteredDrivers.map(d => {
                const v = DRIVER_VISUALS[d.badgeTier] ?? null
                const badgeName = badgeTiers.find(b => b.tier === d.badgeTier)?.name
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13 }}>{d.name ?? '—'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.phone}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.vehicleType ?? '—'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.deliveredCourses ?? 0}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.referralCount ?? 0}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.avgRating ? d.avgRating.toFixed(1) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {v ? (
                        <span style={{ background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          {v.emoji} {badgeName}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sans badge</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
