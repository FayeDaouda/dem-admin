import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Pencil, Save, X, RotateCcw } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'

const DEFAULT_DRIVER_BADGES = [
  { tier: 'gainde',    name: 'DEM Gainde',     emoji: '🏅', courses: 500, referrals: 0,  rating: 4.2 },
  { tier: 'buur',      name: 'DEM Buur',       emoji: '👑', courses: 300, referrals: 0,  rating: 4.0 },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', emoji: '⭐', courses: 135, referrals: 0,  rating: 4.0 },
  { tier: 'doorWarr',  name: 'DEM Door Warr',  emoji: '✅', courses: 70,  referrals: 0,  rating: 3.5 },
  { tier: 'mbokk',     name: 'DEM Mbokk',      emoji: '👥', courses: 30,  referrals: 12, rating: 3.5 },
  { tier: 'xarit',     name: 'DEM Xarit',      emoji: '🤝', courses: 3,   referrals: 3,  rating: 0   },
]

const CLIENT_VISUALS = {
  vip:     { emoji: '💎', color: '#7c3aed', bg: 'rgba(124,58,237,.08)', border: 'rgba(124,58,237,.25)', name: 'DEM VIP' },
  buur:    { emoji: '👑', color: '#7B1FA2', bg: 'rgba(123,31,162,.08)', border: 'rgba(123,31,162,.25)', name: 'DEM Buur' },
  djambar: { emoji: '🏆', color: '#1565C0', bg: 'rgba(21,101,192,.08)', border: 'rgba(21,101,192,.25)', name: 'DEM Djambar' },
  mbokk:   { emoji: '⭐', color: '#00695C', bg: 'rgba(0,105,92,.08)',   border: 'rgba(0,105,92,.25)',   name: 'DEM Mbokk' },
  xarit:   { emoji: '🤝', color: '#0288D1', bg: 'rgba(2,136,209,.08)', border: 'rgba(2,136,209,.25)',  name: 'DEM Xarit' },
  classic: { emoji: '✅', color: '#00838F', bg: 'rgba(0,131,143,.08)', border: 'rgba(0,131,143,.25)',  name: 'DEM Classic' },
}

const DRIVER_VISUALS = {
  gainde:    { emoji: '🏅', color: '#B8860B', bg: 'rgba(184,134,11,.08)',  border: 'rgba(184,134,11,.25)' },
  buur:      { emoji: '👑', color: '#7B1FA2', bg: 'rgba(123,31,162,.08)',  border: 'rgba(123,31,162,.25)' },
  domouNdey: { emoji: '⭐', color: '#1565C0', bg: 'rgba(21,101,192,.08)',  border: 'rgba(21,101,192,.25)' },
  doorWarr:  { emoji: '✅', color: '#00838F', bg: 'rgba(0,131,143,.08)',   border: 'rgba(0,131,143,.25)' },
  mbokk:     { emoji: '👥', color: '#00695C', bg: 'rgba(0,105,92,.08)',    border: 'rgba(0,105,92,.25)' },
  xarit:     { emoji: '🤝', color: '#0288D1', bg: 'rgba(2,136,209,.08)',   border: 'rgba(2,136,209,.25)' },
}

const TAB = (active) => ({
  padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  fontWeight: active ? 700 : 500, fontSize: 13, transition: 'all .15s',
})

export default function Badges() {
  const [tab, setTab] = useState('clients')

  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Badges</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Gestion des badges clients et livreurs.</p>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content', flexShrink: 0 }}>
        <button style={TAB(tab === 'clients')} onClick={() => setTab('clients')}>Badges clients</button>
        <button style={TAB(tab === 'drivers')} onClick={() => setTab('drivers')}>Badges livreurs</button>
      </div>
      <div style={pageScroll}>
        {tab === 'clients' && <ClientBadgesTab />}
        {tab === 'drivers' && <DriverBadgesTab />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGES CLIENTS
// ══════════════════════════════════════════════════════════════════════════════
function ClientBadgesTab() {
  const [stats,      setStats]      = useState(null)
  const [referrers,  setReferrers]  = useState([])
  const [tiers,      setTiers]      = useState([])
  const [pending,    setPending]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [validating, setValidating] = useState(null)
  const [editModal,  setEditModal]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r, t, p] = await Promise.all([
        api.get('/admin/client-badges/stats'),
        api.get('/admin/client-badges/top-referrers'),
        api.get('/admin/client-badges/tiers'),
        api.get('/admin/clients', { params: { needsBadgeValidation: true } }).catch(() => ({ data: { clients: [] } })),
      ])
      setStats(s.data)
      setReferrers(r.data.referrers ?? [])
      setTiers(t.data.tiers ?? [])
      const allClients = p.data.clients ?? []
      setPending(allClients.filter(c => ['mbokk','djambar','buur','vip'].includes(c.clientBadge) && !c.clientBadgeValidated))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function validate(clientId) {
    setValidating(clientId)
    try {
      await api.patch(`/admin/clients/${clientId}/badge/validate`)
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur') }
    finally { setValidating(null) }
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement...</div>

  const total = stats?.total ?? 0
  const dist  = stats?.distribution ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + bouton Modifier */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total} clients inscrits</div>
        <button onClick={() => setEditModal('open')} style={btnEdit}>
          <Pencil size={14} /> Modifier les badges
        </button>
      </div>

      {/* Cartes badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.entries(CLIENT_VISUALS).map(([id, v]) => {
          const count = dist.find(d => d.badge === id)?._count ?? dist.find(d => d.badge === id)?.count ?? 0
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0
          const tier  = tiers.find(t => t.id === id)
          return (
            <div key={id} style={{ ...glass, padding: 0, overflow: 'hidden', border: `1px solid ${v.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: v.bg }}>
                <span style={{ fontSize: 28, marginRight: 14 }}>{v.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: v.color }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{count} client{count !== 1 ? 's' : ''} ({pct}%)</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: v.color }}>{count}</div>
              </div>
              <div style={{ height: 4, background: 'rgba(0,0,0,.06)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: v.color, transition: 'width .4s' }} />
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {tier?.paths && Object.entries(tier.paths).map(([path, conds]) => (
                  <div key={path} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', minWidth: 130, flex: '1 1 130px' }}>
                    <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: v.color, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      {path === 'commandeur' ? 'Commandeur' : path === 'parrain' ? 'Parrain' : 'Equilibre'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {conds.courses   > 0 && <span>🏍 {conds.courses} courses</span>}
                      {conds.referrals > 0 && <span>👥 {conds.referrals} filleuls</span>}
                      {conds.rating    > 0 && <span>⭐ note ≥ {conds.rating}</span>}
                      {conds.profileComplete && <span>📍 profil complet</span>}
                    </div>
                  </div>
                ))}
                {tier?.requiresValidation && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: 'rgba(245,158,11,.10)', padding: '6px 12px', borderRadius: 8, alignSelf: 'center' }}>⏳ Validation admin</span>
                )}
              </div>
            </div>
          )
        })}
        <div style={{ ...glass, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>🆕</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-muted)' }}>Sans badge</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nouveau ou 0 course</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-muted)' }}>
            {total - dist.reduce((s, d) => s + (d.count ?? d._count ?? 0), 0)}
          </div>
        </div>
      </div>

      {/* Validations en attente */}
      {pending.length > 0 && (
        <div style={{ ...glass, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span>⏳</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Validations en attente</div>
            <span style={{ background: 'rgba(245,158,11,.15)', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pending.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(c => {
              const v = CLIENT_VISUALS[c.clientBadge] ?? {}
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{v.emoji ?? '🎯'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>
                  </div>
                  <button onClick={() => validate(c.id)} disabled={validating === c.id}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: validating === c.id ? 0.5 : 1 }}>
                    {validating === c.id ? '...' : 'Valider'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top parrains */}
      {referrers.length > 0 && (
        <div style={{ ...glass, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Top parrains</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['#', 'Client', 'Badge', 'Code', 'Filleuls'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,.10)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {referrers.slice(0, 10).map((r, i) => {
                const v = CLIENT_VISUALS[r.clientBadge] ?? {}
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--text-muted)', fontSize: 13 }}>#{i + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.phone}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {v.color ? <span style={{ background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{v.emoji}</span> : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{r.referralCode}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{r.validReferralCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal modification badges clients */}
      {editModal && (
        <div style={overlay} onClick={() => setEditModal(null)}>
          <div style={{ ...glass, width: 560, maxWidth: '95vw', padding: '24px 28px', borderRadius: 16, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Modifier les badges clients</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tiers.map(tier => {
                const v = CLIENT_VISUALS[tier.id] ?? {}
                return (
                  <div key={tier.id} style={{ background: v.bg ?? 'var(--surface2)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${v.border ?? 'var(--border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 20 }}>{v.emoji ?? '🎯'}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: v.color }}>{tier.name}</span>
                      {tier.requiresValidation && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,.20)', color: '#b45309' }}>validation admin</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {Object.entries(tier.paths).map(([path, conds]) => (
                        <div key={path} style={{ flex: '1 1 150px', background: 'rgba(255,255,255,.7)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, fontSize: 11, color: v.color, marginBottom: 8, textTransform: 'uppercase' }}>
                            {path === 'commandeur' ? 'Commandeur' : path === 'parrain' ? 'Parrain' : 'Equilibre'}
                          </div>
                          {conds.courses != null && (
                            <div style={{ marginBottom: 6 }}>
                              <label style={editLabel}>Courses min</label>
                              <input type="number" defaultValue={conds.courses} style={editInput} />
                            </div>
                          )}
                          {conds.referrals != null && (
                            <div style={{ marginBottom: 6 }}>
                              <label style={editLabel}>Filleuls min</label>
                              <input type="number" defaultValue={conds.referrals} style={editInput} />
                            </div>
                          )}
                          {conds.rating != null && conds.rating > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <label style={editLabel}>Note min</label>
                              <input type="number" step="0.1" defaultValue={conds.rating} style={editInput} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditModal(null)} style={btnOutline}>Fermer</button>
              <button style={btnPrimary}><Save size={14} /> Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGES LIVREURS
// ══════════════════════════════════════════════════════════════════════════════
function DriverBadgesTab() {
  const [badges,      setBadges]      = useState(null)
  const [draft,       setDraft]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [driverStats, setDriverStats] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [badgeRes, driversRes] = await Promise.all([
        api.get('/admin/badges/config'),
        api.get('/admin/drivers').catch(() => ({ data: { drivers: [] } })),
      ])
      const b = badgeRes.data.badges ?? DEFAULT_DRIVER_BADGES
      setBadges(b)
      setDraft(b.map(x => ({ ...x })))

      const drivers = driversRes.data?.drivers ?? []
      const counts = {}
      for (const tier of b) counts[tier.tier] = 0
      counts._none = 0
      for (const d of drivers) {
        let matched = false
        for (const tier of b) {
          const okRating = tier.rating === 0 || (d.avgRating ?? 0) >= tier.rating
          if ((d.deliveredCourses ?? 0) >= tier.courses && (d.referralCount ?? 0) >= tier.referrals && okRating) {
            counts[tier.tier]++
            matched = true
            break
          }
        }
        if (!matched) counts._none++
      }
      counts._total = drivers.length
      setDriverStats(counts)
    } catch {
      setBadges(DEFAULT_DRIVER_BADGES)
      setDraft(DEFAULT_DRIVER_BADGES.map(x => ({ ...x })))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function update(tier, field, val) {
    setDraft(prev => prev.map(b =>
      b.tier === tier ? { ...b, [field]: field === 'rating' ? parseFloat(val) || 0 : parseInt(val, 10) || 0 } : b
    ))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/admin/badges/config', { badges: draft })
      setBadges(draft.map(b => ({ ...b })))
      setSaved(true)
      setEditModal(null)
      load()
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setSaving(false) }
  }

  function handleResetAll() {
    if (!confirm('Remettre tous les seuils par defaut ?')) return
    setDraft(DEFAULT_DRIVER_BADGES.map(b => ({ ...b })))
  }

  if (loading || !draft) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement...</div>

  const totalDrivers = driverStats._total ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + bouton Modifier */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{totalDrivers} livreurs inscrits</div>
        <button onClick={() => setEditModal('open')} style={btnEdit}>
          <Pencil size={14} /> Modifier les badges
        </button>
      </div>

      {/* Cartes badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {draft.map(b => {
          const v = DRIVER_VISUALS[b.tier] ?? { emoji: '🏅', color: '#888', bg: 'var(--surface2)', border: 'var(--border)' }
          const count = driverStats[b.tier] ?? 0
          const pct = totalDrivers > 0 ? Math.round((count / totalDrivers) * 100) : 0
          return (
            <div key={b.tier} style={{ ...glass, padding: 0, overflow: 'hidden', border: `1px solid ${v.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: v.bg }}>
                <span style={{ fontSize: 28, marginRight: 14 }}>{b.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: v.color }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{count} livreur{count !== 1 ? 's' : ''} ({pct}%)</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: v.color }}>{count}</div>
              </div>
              <div style={{ height: 4, background: 'rgba(0,0,0,.06)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: v.color, transition: 'width .4s' }} />
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
                <span>🏍 <strong style={{ color: 'var(--text)' }}>{b.courses}</strong> courses min</span>
                {b.referrals > 0 && <span>👥 <strong style={{ color: 'var(--text)' }}>{b.referrals}</strong> parrainages min</span>}
                {b.rating > 0 && <span>⭐ note ≥ <strong style={{ color: 'var(--text)' }}>{b.rating}</strong></span>}
              </div>
            </div>
          )
        })}
        <div style={{ ...glass, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>🆕</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-muted)' }}>Nouveau</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pas encore de badge</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-muted)' }}>{driverStats._none ?? 0}</div>
        </div>
      </div>

      {/* Modal modification badges livreurs */}
      {editModal && (
        <div style={overlay} onClick={() => setEditModal(null)}>
          <div style={{ ...glass, width: 560, maxWidth: '95vw', padding: '24px 28px', borderRadius: 16, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Modifier les badges livreurs</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {draft.map(b => {
                const v = DRIVER_VISUALS[b.tier] ?? {}
                return (
                  <div key={b.tier} style={{ background: v.bg ?? 'var(--surface2)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${v.border ?? 'var(--border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 20 }}>{b.emoji}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: v.color }}>{b.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <label style={editLabel}>Courses min</label>
                        <input type="number" min={0} value={b.courses} onChange={e => update(b.tier, 'courses', e.target.value)} style={editInput} />
                      </div>
                      <div>
                        <label style={editLabel}>Parrainages min</label>
                        <input type="number" min={0} value={b.referrals} onChange={e => update(b.tier, 'referrals', e.target.value)} style={editInput} />
                      </div>
                      <div>
                        <label style={editLabel}>Note min (/5)</label>
                        <input type="number" min={0} max={5} step={0.1} value={b.rating} onChange={e => update(b.tier, 'rating', e.target.value)} style={editInput} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={handleResetAll} style={btnOutline}><RotateCcw size={13} /> Defaut</button>
              <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                <Save size={14} /> {saved ? 'Sauvegarde !' : saving ? 'Enregistrement...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const editLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.5px' }
const editInput = { ...glassInput, width: 100, textAlign: 'center', fontWeight: 700, padding: '7px 8px', fontSize: 14 }
const btnEdit = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
