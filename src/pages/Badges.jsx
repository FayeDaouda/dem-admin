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

const NONE_VISUAL = { emoji: '🆕', color: '#7c849c', bg: 'rgba(124,132,156,.08)', border: 'rgba(124,132,156,.25)', name: 'Sans badge' }

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

function BadgeCard({ v, count, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...glass, padding: '16px 18px', border: `1px solid ${v.border}`, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: v.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {v.emoji}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: v.color }}>{v.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count} utilisateur{count !== 1 ? 's' : ''}</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGES CLIENTS
// ══════════════════════════════════════════════════════════════════════════════
function ClientBadgesTab() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // badge id sélectionné (ou 'none') pour la popup

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

  const counts = {}
  for (const id of Object.keys(CLIENT_VISUALS)) counts[id] = 0
  let none = 0
  for (const c of clients) {
    if (c.clientBadge && counts[c.clientBadge] !== undefined) counts[c.clientBadge]++
    else none++
  }

  const selectedClients = selected
    ? (selected === 'none' ? clients.filter(c => !c.clientBadge) : clients.filter(c => c.clientBadge === selected))
    : []
  const selectedVisual = selected === 'none' ? NONE_VISUAL : CLIENT_VISUALS[selected]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {Object.entries(CLIENT_VISUALS).map(([id, v]) => (
          <BadgeCard key={id} v={v} count={counts[id]} onClick={() => setSelected(id)} />
        ))}
        <BadgeCard v={NONE_VISUAL} count={none} onClick={() => setSelected('none')} />
      </div>

      {selected && (
        <BadgeUserListModal
          visual={selectedVisual}
          onClose={() => setSelected(null)}
          users={selectedClients}
          columns={['Client', 'Téléphone', 'Inscrit le']}
          renderRow={c => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13 }}>
                {c.name ?? '—'}
                {c.clientBadge && !c.clientBadgeValidated && ['mbokk','djambar','buur','vip'].includes(c.clientBadge) && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#b45309' }}>⏳ non validé</span>
                )}
              </td>
              <td style={{ padding: '8px 10px', fontSize: 13 }}>{c.phone}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12 }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
          )}
          matchesSearch={(c, q) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)}
        />
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGES LIVREURS
// ══════════════════════════════════════════════════════════════════════════════
function DriverBadgesTab() {
  const [driversList, setDriversList] = useState([])
  const [badgeTiers,  setBadgeTiers]  = useState(DEFAULT_DRIVER_BADGES)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null) // tier sélectionné (ou 'none') pour la popup

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [badgeRes, driversRes] = await Promise.all([
        api.get('/admin/badges/config').catch(() => ({ data: { badges: DEFAULT_DRIVER_BADGES } })),
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

  const counts = {}
  for (const tier of badgeTiers) counts[tier.tier] = 0
  let none = 0
  for (const d of driversList) {
    if (d.badgeTier) counts[d.badgeTier]++
    else none++
  }

  const selectedDrivers = selected
    ? (selected === 'none' ? driversList.filter(d => !d.badgeTier) : driversList.filter(d => d.badgeTier === selected))
    : []
  const selectedTierName = badgeTiers.find(b => b.tier === selected)?.name
  const selectedVisual = selected === 'none' ? NONE_VISUAL : { ...(DRIVER_VISUALS[selected] ?? {}), name: selectedTierName }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {badgeTiers.map(tier => (
          <BadgeCard
            key={tier.tier}
            v={{ ...(DRIVER_VISUALS[tier.tier] ?? { color: '#888', bg: 'var(--surface2)', border: 'var(--border)' }), emoji: tier.emoji, name: tier.name }}
            count={counts[tier.tier] ?? 0}
            onClick={() => setSelected(tier.tier)}
          />
        ))}
        <BadgeCard v={NONE_VISUAL} count={none} onClick={() => setSelected('none')} />
      </div>

      {selected && (
        <BadgeUserListModal
          visual={selectedVisual}
          onClose={() => setSelected(null)}
          users={selectedDrivers}
          columns={['Livreur', 'Téléphone', 'Véhicule', 'Courses', 'Parrainages', 'Note']}
          renderRow={d => (
            <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13 }}>{d.name ?? '—'}</td>
              <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.phone}</td>
              <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.vehicleType ?? '—'}</td>
              <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.deliveredCourses ?? 0}</td>
              <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.referralCount ?? 0}</td>
              <td style={{ padding: '8px 10px', fontSize: 13 }}>{d.avgRating ? d.avgRating.toFixed(1) : '—'}</td>
            </tr>
          )}
          matchesSearch={(d, q) => d.name?.toLowerCase().includes(q) || d.phone?.includes(q)}
        />
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  POPUP : liste des utilisateurs pour un badge donné, avec recherche
// ══════════════════════════════════════════════════════════════════════════════
function BadgeUserListModal({ visual, onClose, users, columns, renderRow, matchesSearch }) {
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const filtered = q ? users.filter(u => matchesSearch(u, q)) : users

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 720, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: visual.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {visual.emoji}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: visual.color }}>{visual.name} ({filtered.length})</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone…"
            style={{ ...glassInput, width: '100%', marginBottom: 14 }}
          />
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucun utilisateur trouvé.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{columns.map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,.10)', position: 'sticky', top: 0, background: '#ffffff' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(renderRow)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
