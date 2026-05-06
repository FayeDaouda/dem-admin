import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw, BarChart2, Phone, CheckCircle, XCircle } from 'lucide-react'
import { glass } from '../lib/glassStyles'

// Propriétés visuelles fixes par tier (couleurs/emojis non configurables)
const BADGE_VISUALS = {
  gainde:    { emoji: '🏅', color: '#B8860B', bg: '#FFF8E1' },
  buur:      { emoji: '👑', color: '#7B1FA2', bg: '#F3E5F5' },
  domouNdey: { emoji: '⭐', color: '#1565C0', bg: '#E3F2FD' },
  doorWarr:  { emoji: '✅', color: '#00838F', bg: '#E0F7FA' },
  mbokk:     { emoji: '👥', color: '#00695C', bg: '#E0F2F1' },
  xarit:     { emoji: '🤝', color: '#0288D1', bg: '#E1F5FE' },
}

const DEFAULT_BADGE_TIERS = [
  { tier: 'gainde',    name: 'DEM Gainde',     courses: 500, referrals: 0,  rating: 4.2 },
  { tier: 'buur',      name: 'DEM Buur',       courses: 300, referrals: 0,  rating: 4.0 },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', courses: 135, referrals: 0,  rating: 4.0 },
  { tier: 'doorWarr',  name: 'DEM Door Warr',  courses: 70,  referrals: 0,  rating: 3.5 },
  { tier: 'mbokk',     name: 'DEM Mbokk',      courses: 30,  referrals: 12, rating: 3.5 },
  { tier: 'xarit',     name: 'DEM Xarit',      courses: 3,   referrals: 3,  rating: 0   },
]

function computeBadge(courses, referrals, rating, tiers) {
  for (const tier of (tiers ?? DEFAULT_BADGE_TIERS)) {
    const okRating = tier.rating === 0 || rating >= tier.rating
    if (courses >= tier.courses && referrals >= tier.referrals && okRating) return tier
  }
  return null
}

function DriverBadgeChip({ driver, badgeTiers }) {
  const badge = computeBadge(driver.deliveredCourses ?? 0, driver.referralCount ?? 0, driver.avgRating ?? 0, badgeTiers)
  if (!badge) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nouveau</span>
  const v = BADGE_VISUALS[badge.tier] ?? { emoji: '🏅', color: '#888', bg: '#f5f5f5' }
  return (
    <span style={{ background: v.bg, color: v.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {v.emoji} {badge.name}
    </span>
  )
}

export default function Drivers() {
  const [drivers, setDrivers]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [badgeTiers, setBadgeTiers]     = useState(null)
  const [stats, setStats]         = useState(null)
  const [phoneReqs, setPhoneReqs] = useState([])
  const [phoneLoading, setPhoneLoading] = useState(true)
  const [resolving, setResolving]       = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/drivers')
      setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : (Array.isArray(res.data) ? res.data : []))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPhoneRequests = useCallback(async () => {
    setPhoneLoading(true)
    try {
      const res = await api.get('/admin/drivers', { params: { status: 'phone-change', limit: 50 } })
      setPhoneReqs(Array.isArray(res.data?.drivers) ? res.data.drivers : [])
    } catch (e) {
      console.error(e)
    } finally {
      setPhoneLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    fetchPhoneRequests()
    api.get('/admin/badges/config')
      .then(r => setBadgeTiers(r.data.badges))
      .catch(() => {})
  }, [fetch, fetchPhoneRequests])

  async function showStats(driverId) {
    setStats({ driverId, loading: true })
    try {
      const res = await api.get(`/admin/drivers/${driverId}/payment-stats`)
      setStats({ driverId, ...res.data })
    } catch (e) {
      setStats(null)
    }
  }

  async function toggleBan(driver) {
    const action = driver.isActive ? 'suspend' : 'activate'
    if (!confirm(`${action === 'suspend' ? 'Suspendre' : 'Réactiver'} ${driver.name ?? driver.phone} ?`)) return
    try {
      await api.patch(`/admin/drivers/${driver.id}/${action}`, action === 'suspend' ? { reason: 'Suspendu par admin' } : {})
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function resolvePhoneChange(driverId, approve) {
    setResolving(driverId)
    try {
      await api.patch(`/admin/drivers/${driverId}/phone-change`, { approve })
      await fetchPhoneRequests()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur')
    } finally {
      setResolving(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Drivers</h1>
        <button onClick={() => { fetch(); fetchPhoneRequests() }} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* ── Demandes changement de numéro ── */}
      {(phoneLoading || phoneReqs.length > 0) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Phone size={16} color="var(--warning)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              Demandes de changement de numéro
            </h2>
            {!phoneLoading && (
              <span style={{
                background: 'rgba(245,158,11,0.15)',
                color: '#F59E0B',
                fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {phoneReqs.length}
              </span>
            )}
          </div>

          <div style={card}>
            {phoneLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Driver', 'Véhicule', 'Numéro actuel', '', 'Nouveau numéro', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phoneReqs.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{d.name ?? '—'}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {d.vehicleType === 'MOTO' ? '🏍 Moto' : '🚗 Voiture'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.phone}</span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 18, textAlign: 'center' }}>→</td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                          {d.pendingPhone ?? '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {resolving === d.id ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>En cours…</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => resolvePhoneChange(d.id, true)}
                              style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}
                            >
                              <CheckCircle size={13} /> Approuver
                            </button>
                            <button
                              onClick={() => resolvePhoneChange(d.id, false)}
                              style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            >
                              <XCircle size={13} /> Refuser
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Liste complète drivers ── */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Tous les drivers</h2>
      </div>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Nom', 'Badge', 'Courses', 'Téléphone', 'Véhicule', 'Statut', 'Vérifié', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{d.name ?? '—'}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      <Badge status={d.isAvailable ? 'ONLINE' : 'OFFLINE'} />
                      {d.managedById && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                          background: d.managedBy?.ambassadorStatus === 'ACTIVE' ? 'rgba(124,58,237,.10)' : 'rgba(245,158,11,.12)',
                          color:      d.managedBy?.ambassadorStatus === 'ACTIVE' ? '#7c3aed' : '#b45309',
                        }}>
                          AM {d.managedBy?.ambassadorStatus === 'ACTIVE' ? '✓' : '⏳'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}><DriverBadgeChip driver={d} badgeTiers={badgeTiers} /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{d.deliveredCourses ?? 0}</div>
                    {d.avgRating > 0 && (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>★ {d.avgRating}</div>
                    )}
                  </td>
                  <td style={tdStyle}>{d.phone}</td>
                  <td style={tdStyle}>{d.vehicleType ?? '—'}</td>
                  <td style={tdStyle}>
                    {d.isActive
                      ? <span style={{ color: 'var(--success)' }}>✓ Actif</span>
                      : <span style={{ color: 'var(--danger)' }}>Suspendu</span>}
                  </td>
                  <td style={tdStyle}>
                    {d.isVerified
                      ? <span style={{ color: 'var(--success)' }}>✓</span>
                      : <span style={{ color: 'var(--warning)' }}>En attente</span>}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => showStats(d.id)} style={btnSmall} title="Statistiques paiement">
                        <BarChart2 size={13} /> Stats
                      </button>
                      <button
                        onClick={() => toggleBan(d)}
                        style={{ ...btnSmall, color: d.isActive ? 'var(--danger)' : 'var(--success)', borderColor: d.isActive ? 'var(--danger)' : 'var(--success)' }}
                      >
                        {d.isActive ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal stats */}
      {stats && (
        <div style={overlay} onClick={() => setStats(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20, fontSize: 16 }}>Statistiques paiement</h2>
            {stats.loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  ['Courses payées',   stats.paidOrders,    'var(--success)'],
                  ['Total gagné',      `${(stats.totalEarned ?? 0).toLocaleString()} F`, 'var(--primary)'],
                  ['En attente',       stats.pendingOrders, 'var(--warning)'],
                  ['Litiges',          stats.disputedOrders,'var(--danger)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{
                    background: 'var(--surface2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{val}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={() => setStats(null)} style={btnOutline}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px', overflowX: 'auto' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, padding: '28px 32px', width: 440, maxWidth: '90vw' }
