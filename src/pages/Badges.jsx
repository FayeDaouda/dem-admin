import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Save, RotateCcw } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'

const DEFAULT_DRIVER_BADGES = [
  { tier: 'gainde',    name: 'DEM Gainde',     emoji: '🏅', courses: 500, referrals: 0,  rating: 4.2 },
  { tier: 'buur',      name: 'DEM Buur',       emoji: '👑', courses: 300, referrals: 0,  rating: 4.0 },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', emoji: '⭐', courses: 135, referrals: 0,  rating: 4.0 },
  { tier: 'doorWarr',  name: 'DEM Door Warr',  emoji: '✅', courses: 70,  referrals: 0,  rating: 3.5 },
  { tier: 'mbokk',     name: 'DEM Mbokk',      emoji: '👥', courses: 30,  referrals: 12, rating: 3.5 },
  { tier: 'xarit',     name: 'DEM Xarit',      emoji: '🤝', courses: 3,   referrals: 3,  rating: 0   },
]

const BADGE_VISUALS = {
  vip:     { emoji: '💎', color: '#7c3aed', bg: 'rgba(124,58,237,.10)',  name: 'DEM VIP' },
  buur:    { emoji: '👑', color: '#7B1FA2', bg: 'rgba(123,31,162,.10)',  name: 'DEM Buur' },
  djambar: { emoji: '🏆', color: '#1565C0', bg: 'rgba(21,101,192,.10)',  name: 'DEM Djambar' },
  mbokk:   { emoji: '⭐', color: '#00695C', bg: 'rgba(0,105,92,.10)',    name: 'DEM Mbokk' },
  xarit:   { emoji: '🤝', color: '#0288D1', bg: 'rgba(2,136,209,.10)',   name: 'DEM Xarit' },
  classic: { emoji: '✅', color: '#00838F', bg: 'rgba(0,131,143,.10)',   name: 'DEM Classic' },
}

const Card = ({ children, style = {} }) => (
  <div style={{ ...glass, padding: '20px 24px', ...style }}>{children}</div>
)

const TAB = (active) => ({
  padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  fontWeight: active ? 700 : 500, fontSize: 13, transition: 'all .15s',
})

const btnSave = (has) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
  borderRadius: 'var(--radius-sm)', border: 'none',
  background: has ? 'var(--primary)' : 'var(--surface2)',
  color: has ? '#fff' : 'var(--text-muted)',
  fontWeight: 600, fontSize: 13, cursor: has ? 'pointer' : 'default',
})

const btnOutline = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)',
  background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
}

export default function Badges() {
  const [tab, setTab] = useState('clients')

  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Badges</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Gestion des badges clients et livreurs.
        </p>
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

// ── Badges Clients ───────────────────────────────────────────────────────────
function ClientBadgesTab() {
  const [stats,    setStats]    = useState(null)
  const [referrers, setReferrers] = useState([])
  const [tiers,    setTiers]    = useState([])
  const [pending,  setPending]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [validating, setValidating] = useState(null)

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
      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Distribution des badges</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(BADGE_VISUALS).map(([id, v]) => {
            const count = dist.find(d => d.badge === id)?._count ?? dist.find(d => d.badge === id)?.count ?? 0
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={id} style={{ flex: '1 1 140px', background: v.bg, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{v.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: v.color }}>{v.name}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: v.color }}>{count}</div>
                <div style={{ height: 4, borderRadius: 4, background: 'rgba(0,0,0,.08)', marginTop: 6 }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: v.color, transition: 'width .4s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pct}% des clients</div>
              </div>
            )
          })}
        </div>
      </Card>

      {pending.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Validations en attente</div>
            <span style={{ background: 'rgba(245,158,11,.15)', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pending.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(c => {
              const v = BADGE_VISUALS[c.clientBadge] ?? {}
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{v.emoji ?? '🎯'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone} · <span style={{ color: v.color, fontWeight: 700 }}>{v.name}</span></div>
                  </div>
                  <button onClick={() => validate(c.id)} disabled={validating === c.id}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: validating === c.id ? 0.5 : 1 }}>
                    {validating === c.id ? '...' : 'Valider'}
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Top parrains (filleuls actifs)</div>
        {referrers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun parrainage valide.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['#', 'Client', 'Badge', 'Code parrain', 'Filleuls actifs'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,.10)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {referrers.slice(0, 20).map((r, i) => {
                const v = BADGE_VISUALS[r.clientBadge] ?? {}
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--text-muted)', fontSize: 13 }}>#{i + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.phone}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {v.name
                        ? <span style={{ background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{v.emoji} {v.name}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sans badge</span>}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{r.referralCode}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{r.validReferralCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Conditions des tiers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiers.map(tier => {
            const v = BADGE_VISUALS[tier.id] ?? {}
            return (
              <div key={tier.id} style={{ background: v.bg ?? 'var(--surface2)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{v.emoji ?? '🎯'}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: v.color }}>{tier.name}</span>
                  {tier.requiresValidation && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,.20)', color: '#b45309' }}>validation admin</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                  {Object.entries(tier.paths).map(([path, conds]) => (
                    <div key={path} style={{ background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '6px 10px', minWidth: 150 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, textTransform: 'capitalize', color: 'var(--text)' }}>
                        {path === 'commandeur' ? 'Commandeur' : path === 'parrain' ? 'Parrain' : 'Equilibre'}
                      </div>
                      {conds.courses   > 0 && <div>🏍 {conds.courses} courses</div>}
                      {conds.referrals > 0 && <div>👥 {conds.referrals} filleuls</div>}
                      {conds.rating    > 0 && <div>⭐ note ≥ {conds.rating}</div>}
                      {conds.profileComplete && <div title="nom + email + ≥1 adresse favorite">📍 profil complet</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ── Badges Livreurs ──────────────────────────────────────────────────────────
function DriverBadgesTab() {
  const [badges,  setBadges]  = useState(null)
  const [draft,   setDraft]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/badges/config')
      setBadges(res.data.badges)
      setDraft(res.data.badges.map(b => ({ ...b })))
    } catch {
      setBadges(DEFAULT_DRIVER_BADGES)
      setDraft(DEFAULT_DRIVER_BADGES.map(b => ({ ...b })))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function update(i, field, val) {
    setDraft(prev => prev.map((b, idx) =>
      idx === i ? { ...b, [field]: field === 'rating' ? parseFloat(val) || 0 : parseInt(val, 10) || 0 } : b
    ))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/admin/badges/config', { badges: draft })
      setBadges(draft.map(b => ({ ...b })))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setSaving(false) }
  }

  function handleReset() {
    if (!confirm('Remettre les valeurs par defaut ?')) return
    setDraft(DEFAULT_DRIVER_BADGES.map(b => ({ ...b })))
  }

  const hasChanges = draft && badges && JSON.stringify(draft) !== JSON.stringify(badges)
  if (loading || !draft) return <div style={{ color: 'var(--text-muted)' }}>Chargement...</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Seuils de chaque niveau livreur. Recalcules en temps reel dans l'app.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={btnOutline}><RotateCcw size={13} /> Defaut</button>
          <button onClick={handleSave} disabled={!hasChanges || saving} style={btnSave(hasChanges)}>
            <Save size={14} />
            {saved ? 'Sauvegarde' : saving ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
      <div style={{ ...glass, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.05)' }}>
              {['Niveau', 'Courses min', 'Parrainages min', 'Note min (/5)', 'Apercu'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.map((b, i) => (
              <tr key={b.tier} style={{ borderBottom: i < draft.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{b.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <input type="number" min={0} value={b.courses} onChange={e => update(i, 'courses', e.target.value)}
                    style={{ ...glassInput, width: 90, textAlign: 'center', fontWeight: 700, border: `1px solid ${b.courses !== badges[i]?.courses ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }} />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <input type="number" min={0} value={b.referrals} onChange={e => update(i, 'referrals', e.target.value)}
                    style={{ ...glassInput, width: 90, textAlign: 'center', fontWeight: 700, border: `1px solid ${b.referrals !== badges[i]?.referrals ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }} />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <input type="number" min={0} max={5} step={0.1} value={b.rating} onChange={e => update(i, 'rating', e.target.value)}
                    style={{ ...glassInput, width: 90, textAlign: 'center', fontWeight: 700, border: `1px solid ${b.rating !== badges[i]?.rating ? 'var(--primary)' : 'rgba(0,119,182,.25)'}` }} />
                </td>
                <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {b.courses} courses{b.referrals > 0 ? ` + ${b.referrals} parr.` : ''}{b.rating > 0 ? ` + ${b.rating}★` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
        Les champs en bleu indiquent une modification non sauvegardee.
      </p>
    </div>
  )
}
