import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Pencil, X } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'

// Chaque badge peut être atteint par plusieurs lignes de critères alternatives
// (OR entre les lignes, AND entre les critères d'une même ligne).
const DEFAULT_DRIVER_BADGES = [
  { tier: 'xarit',     name: 'DEM Xarit',      emoji: '🤝', advantage: 'Priorité sur les courses',
    criteria: [{ courses: 3, referrals: 0, rating: 0 }, { courses: 0, referrals: 3, rating: 0 }] },
  { tier: 'mbokk',     name: 'DEM Mbokk',      emoji: '👥', advantage: 'Tenue DEM offerte + badge vérifié',
    criteria: [{ courses: 30,  referrals: 12, rating: 3.5 }] },
  { tier: 'doorWarr',  name: 'DEM Door Warr',   emoji: '✅', advantage: '',
    criteria: [{ courses: 70,  referrals: 0,  rating: 3.5 }] },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', emoji: '⭐', advantage: '8 courses garanties/sem',
    criteria: [{ courses: 135, referrals: 0,  rating: 4.0 }] },
  { tier: 'buur',      name: 'DEM Buur',       emoji: '👑', advantage: '10 courses garanties/sem + casque DEM',
    criteria: [{ courses: 300, referrals: 0,  rating: 4.0 }] },
  { tier: 'gainde',    name: 'DEM Gainde',     emoji: '🏅', advantage: '12 courses garanties/sem + chef de flotte',
    criteria: [{ courses: 500, referrals: 0,  rating: 4.2 }] },
]

// Un badge est atteint si AU MOINS une ligne de critères est entièrement remplie.
function driverBadgeMatches(tier, courses, referrals, rating) {
  return (tier.criteria ?? []).some(c => {
    const okRating = !c.rating || rating >= c.rating
    return courses >= c.courses && referrals >= c.referrals && okRating
  })
}

// Ordre d'affichage imposé (Sans badge en premier, puis progression des tiers)
// — indépendant de l'ordre renvoyé par /admin/badges/config.
const DRIVER_TIER_ORDER = ['xarit', 'mbokk', 'doorWarr', 'domouNdey', 'buur', 'gainde']

// Chemins nommés fixes (commandeur/parrain/équilibre) — seuls leurs seuils numériques
// sont éditables depuis l'admin, la structure des paths ne change pas.
const DEFAULT_CLIENT_TIERS = [
  { id: 'vip', name: 'DEM VIP', paths: {
    commandeur: { courses: 200, referrals: 12, rating: 4.5 },
    parrain:    { courses: 55,  referrals: 65, rating: 4.5 },
    equilibre:  { courses: 130, referrals: 50, rating: 4.5 },
  } },
  { id: 'buur', name: 'DEM Buur', paths: {
    commandeur: { courses: 130, referrals: 8,  rating: 4.2 },
    parrain:    { courses: 38,  referrals: 40, rating: 4.2 },
    equilibre:  { courses: 85,  referrals: 28, rating: 4.2 },
  } },
  { id: 'djambar', name: 'DEM Djambar', paths: {
    commandeur: { courses: 85, referrals: 5,  rating: 4.0 },
    parrain:    { courses: 25, referrals: 25, rating: 4.0 },
    equilibre:  { courses: 50, referrals: 15, rating: 4.0 },
  } },
  { id: 'mbokk', name: 'DEM Mbokk', requiresValidation: true, paths: {
    commandeur: { courses: 50, referrals: 6,  profileComplete: true },
    parrain:    { courses: 18, referrals: 16, profileComplete: true },
    equilibre:  { courses: 25, referrals: 10, profileComplete: true },
  } },
  { id: 'xarit', name: 'DEM Xarit', paths: {
    commandeur: { courses: 12, referrals: 3 },
    parrain:    { courses: 5,  referrals: 4 },
    equilibre:  { courses: 7,  referrals: 4 },
  } },
  { id: 'classic', name: 'DEM Classic', paths: {
    commandeur: { courses: 1, referrals: 0 },
  } },
]

const CLIENT_PATH_LABELS = {
  commandeur: 'Commandeur (via courses)',
  parrain:    'Parrain (via parrainages)',
  equilibre:  'Équilibre (mix courses/parrainages)',
}

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
  const { user } = useAuth()
  const isSuper = !user?.adminRole || user.adminRole === 'SUPER'
  const [clients, setClients] = useState([])
  const [tiers,   setTiers]   = useState(DEFAULT_CLIENT_TIERS)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // badge id sélectionné (ou 'none') pour la popup
  const [editing,  setEditing]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [clientsRes, tiersRes] = await Promise.all([
        api.get('/admin/clients', { params: { limit: 1000 } }),
        api.get('/admin/client-badges/config').catch(() => ({ data: { tiers: DEFAULT_CLIENT_TIERS } })),
      ])
      setClients(clientsRes.data.clients ?? [])
      setTiers(tiersRes.data.tiers ?? DEFAULT_CLIENT_TIERS)
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
      {isSuper && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => setEditing(true)} style={btnOutline}>
            <Pencil size={14} /> Modifier les seuils
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <BadgeCard v={NONE_VISUAL} count={none} onClick={() => setSelected('none')} />
        {Object.entries(CLIENT_VISUALS).map(([id, v]) => (
          <BadgeCard key={id} v={v} count={counts[id]} onClick={() => setSelected(id)} />
        ))}
      </div>

      {editing && (
        <EditClientBadgeTiersModal
          tiers={tiers}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load() }}
        />
      )}

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
  const { user } = useAuth()
  const isSuper = !user?.adminRole || user.adminRole === 'SUPER'
  const [driversList, setDriversList] = useState([])
  const [badgeTiers,  setBadgeTiers]  = useState(DEFAULT_DRIVER_BADGES)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null) // tier sélectionné (ou 'none') pour la popup
  const [editing,     setEditing]     = useState(false)

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
          if (driverBadgeMatches(tier, d.deliveredCourses ?? 0, d.referralCount ?? 0, d.avgRating ?? 0)) {
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

  const orderedBadgeTiers = [...badgeTiers].sort((a, b) => DRIVER_TIER_ORDER.indexOf(a.tier) - DRIVER_TIER_ORDER.indexOf(b.tier))

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
      {isSuper && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => setEditing(true)} style={btnOutline}>
            <Pencil size={14} /> Modifier les seuils
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <BadgeCard v={NONE_VISUAL} count={none} onClick={() => setSelected('none')} />
        {orderedBadgeTiers.map(tier => (
          <BadgeCard
            key={tier.tier}
            v={{ ...(DRIVER_VISUALS[tier.tier] ?? { color: '#888', bg: 'var(--surface2)', border: 'var(--border)' }), emoji: tier.emoji, name: tier.name }}
            count={counts[tier.tier] ?? 0}
            onClick={() => setSelected(tier.tier)}
          />
        ))}
      </div>

      {editing && (
        <EditBadgeTiersModal
          tiers={orderedBadgeTiers}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load() }}
        />
      )}

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
//  MODAL : édition des seuils de badges livreurs (SUPER uniquement)
// ══════════════════════════════════════════════════════════════════════════════
function EditBadgeTiersModal({ tiers, onClose, onSaved }) {
  const [rows, setRows]         = useState(tiers.map(t => ({ ...t, criteria: (t.criteria ?? []).map(c => ({ ...c })) })))
  const [selectedTier, setSelectedTier] = useState(tiers[0]?.tier ?? null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const selected = rows.find(r => r.tier === selectedTier) ?? null

  function setField(tier, key, value) {
    setRows(rs => rs.map(r => r.tier === tier ? { ...r, [key]: value } : r))
  }

  function setCriteriaField(tier, idx, key, value) {
    setRows(rs => rs.map(r => r.tier !== tier ? r : {
      ...r,
      criteria: r.criteria.map((c, i) => i === idx ? { ...c, [key]: value } : c),
    }))
  }

  function addCriteriaRow(tier) {
    setRows(rs => rs.map(r => r.tier !== tier ? r : {
      ...r,
      criteria: [...r.criteria, { courses: 0, referrals: 0, rating: 0 }],
    }))
  }

  function removeCriteriaRow(tier, idx) {
    setRows(rs => rs.map(r => r.tier !== tier ? r : {
      ...r,
      criteria: r.criteria.filter((_, i) => i !== idx),
    }))
  }

  async function save() {
    setError('')
    for (const r of rows) {
      if (!r.name?.trim()) { setError('Le nom de chaque palier est requis.'); return }
      if (r.criteria.length === 0) { setError(`${r.name} doit avoir au moins une ligne de critères.`); return }
      for (const c of r.criteria) {
        if (c.courses === '' || Number.isNaN(Number(c.courses)) || Number(c.courses) < 0) { setError(`Nombre de courses invalide pour ${r.name}.`); return }
        if (c.referrals === '' || Number.isNaN(Number(c.referrals)) || Number(c.referrals) < 0) { setError(`Nombre de parrainages invalide pour ${r.name}.`); return }
        if (c.rating === '' || Number.isNaN(Number(c.rating)) || Number(c.rating) < 0 || Number(c.rating) > 5) { setError(`Note minimale invalide pour ${r.name} (0 à 5).`); return }
      }
    }

    setSaving(true)
    try {
      const badges = rows.map(r => ({
        tier: r.tier, name: r.name.trim(), emoji: r.emoji, advantage: r.advantage ?? '',
        criteria: r.criteria.map(c => ({ courses: Number(c.courses), referrals: Number(c.referrals), rating: Number(c.rating) })),
      }))
      await api.put('/admin/badges/config', { badges })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 880, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Modifier les seuils de badges livreurs</h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Choisissez un badge, ajustez ses seuils, puis passez au suivant. Un badge est validé dès qu'UNE ligne de critères est entièrement remplie.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sélecteur de badge */}
          <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map(r => (
              <button
                key={r.tier}
                onClick={() => setSelectedTier(r.tier)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                  border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: r.tier === selectedTier ? 700 : 500,
                  background: r.tier === selectedTier ? 'rgba(0,119,182,.12)' : 'transparent',
                  color: r.tier === selectedTier ? 'var(--primary)' : 'var(--text)',
                }}
              >
                <span style={{ fontSize: 16 }}>{r.emoji}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || 'Sans nom'}</span>
              </button>
            ))}
          </div>

          {/* Formulaire du badge sélectionné */}
          <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
            {selected && (
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <input value={selected.emoji} onChange={e => setField(selected.tier, 'emoji', e.target.value)} style={{ ...rowInput, width: 48, textAlign: 'center', fontSize: 18, flex: 'none' }} />
                  <input value={selected.name} onChange={e => setField(selected.tier, 'name', e.target.value)} style={{ ...rowInput, width: 180, fontWeight: 700, flex: 'none' }} placeholder="Nom du badge" />
                  <input value={selected.advantage ?? ''} onChange={e => setField(selected.tier, 'advantage', e.target.value)} style={rowInput} placeholder="Avantage affiché (ex : Priorité sur les courses)" />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Courses min.', 'Parrainages min.', 'Note min.', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, borderBottom: '1px solid rgba(0,119,182,.12)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.criteria.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < selected.criteria.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '6px 8px', width: 130 }}>
                          <input type="number" min="0" value={c.courses} onChange={e => setCriteriaField(selected.tier, idx, 'courses', e.target.value)} style={rowInput} />
                        </td>
                        <td style={{ padding: '6px 8px', width: 150 }}>
                          <input type="number" min="0" value={c.referrals} onChange={e => setCriteriaField(selected.tier, idx, 'referrals', e.target.value)} style={rowInput} />
                        </td>
                        <td style={{ padding: '6px 8px', width: 110 }}>
                          <input type="number" min="0" max="5" step="0.1" value={c.rating} onChange={e => setCriteriaField(selected.tier, idx, 'rating', e.target.value)} style={rowInput} />
                        </td>
                        <td style={{ padding: '6px 8px', width: 36 }}>
                          {selected.criteria.length > 1 && (
                            <button onClick={() => removeCriteriaRow(selected.tier, idx)} title="Supprimer cette alternative" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}>
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button onClick={() => addCriteriaRow(selected.tier)} style={{ ...btnOutline, marginTop: 10, fontSize: 12, padding: '5px 10px' }}>
                  + Ajouter un chemin alternatif (OU)
                </button>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginTop: 16 }}>{error}</div>}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnOutline}>Annuler</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODAL : édition des seuils de badges clients (SUPER uniquement)
//  Les 3 chemins (commandeur/parrain/équilibre) sont fixes — seuls les seuils
//  numériques (courses/parrainages/note) sont éditables.
// ══════════════════════════════════════════════════════════════════════════════
function EditClientBadgeTiersModal({ tiers, onClose, onSaved }) {
  const [rows, setRows]     = useState(tiers.map(t => ({
    ...t,
    paths: Object.fromEntries(Object.entries(t.paths).map(([k, c]) => [k, { ...c }])),
  })))
  const [selectedTier, setSelectedTier] = useState(tiers[0]?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const selected = rows.find(r => r.id === selectedTier) ?? null

  function setPathField(tierId, pathKey, field, value) {
    setRows(rs => rs.map(r => r.id !== tierId ? r : {
      ...r,
      paths: { ...r.paths, [pathKey]: { ...r.paths[pathKey], [field]: value } },
    }))
  }

  async function save() {
    setError('')
    for (const r of rows) {
      for (const [pathKey, c] of Object.entries(r.paths)) {
        if (c.courses === '' || Number.isNaN(Number(c.courses)) || Number(c.courses) < 0) { setError(`Nombre de courses invalide pour ${r.name} (${CLIENT_PATH_LABELS[pathKey] ?? pathKey}).`); return }
        if (c.referrals === '' || Number.isNaN(Number(c.referrals)) || Number(c.referrals) < 0) { setError(`Nombre de parrainages invalide pour ${r.name} (${CLIENT_PATH_LABELS[pathKey] ?? pathKey}).`); return }
        if (c.rating !== undefined && (Number.isNaN(Number(c.rating)) || Number(c.rating) < 0 || Number(c.rating) > 5)) { setError(`Note minimale invalide pour ${r.name} (${CLIENT_PATH_LABELS[pathKey] ?? pathKey}).`); return }
      }
    }

    setSaving(true)
    try {
      const payload = rows.map(r => ({
        id: r.id,
        name: r.name,
        paths: Object.fromEntries(Object.entries(r.paths).map(([k, c]) => [k, {
          courses: Number(c.courses), referrals: Number(c.referrals),
          ...(c.rating !== undefined ? { rating: Number(c.rating) } : {}),
        }])),
      }))
      await api.put('/admin/client-badges/config', { tiers: payload })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 880, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Modifier les seuils de badges clients</h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>Choisissez un badge, ajustez les 3 chemins (commandeur/parrain/équilibre), puis passez au suivant. Un badge est validé dès qu'UN chemin est entièrement rempli.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedTier(r.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                  border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: r.id === selectedTier ? 700 : 500,
                  background: r.id === selectedTier ? 'rgba(0,119,182,.12)' : 'transparent',
                  color: r.id === selectedTier ? 'var(--primary)' : 'var(--text)',
                }}
              >
                <span style={{ fontSize: 16 }}>{CLIENT_VISUALS[r.id]?.emoji ?? '🏅'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: '16px 24px', overflowY: 'auto' }}>
            {selected && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 20 }}>{CLIENT_VISUALS[selected.id]?.emoji ?? '🏅'}</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</span>
                  {selected.requiresValidation && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,.15)', color: '#b45309' }}>
                      validation admin requise
                    </span>
                  )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Chemin', 'Courses min.', 'Parrainages min.', 'Note min.'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, borderBottom: '1px solid rgba(0,119,182,.12)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selected.paths).map(([pathKey, c], idx, arr) => (
                      <tr key={pathKey} style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
                          {CLIENT_PATH_LABELS[pathKey] ?? pathKey}
                          {c.profileComplete && <div style={{ fontSize: 10, marginTop: 2 }}>+ profil complet</div>}
                        </td>
                        <td style={{ padding: '6px 8px', width: 120 }}>
                          <input type="number" min="0" value={c.courses} onChange={e => setPathField(selected.id, pathKey, 'courses', e.target.value)} style={rowInput} />
                        </td>
                        <td style={{ padding: '6px 8px', width: 140 }}>
                          <input type="number" min="0" value={c.referrals} onChange={e => setPathField(selected.id, pathKey, 'referrals', e.target.value)} style={rowInput} />
                        </td>
                        <td style={{ padding: '6px 8px', width: 100 }}>
                          {c.rating !== undefined ? (
                            <input type="number" min="0" max="5" step="0.1" value={c.rating} onChange={e => setPathField(selected.id, pathKey, 'rating', e.target.value)} style={rowInput} />
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginTop: 16 }}>{error}</div>}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnOutline}>Annuler</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
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

        {/* Recherche — hors zone de scroll, toujours visible */}
        <div style={{ padding: '16px 24px 0' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone…"
            style={{ ...glassInput, width: '100%' }}
          />
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
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
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const rowInput   = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
