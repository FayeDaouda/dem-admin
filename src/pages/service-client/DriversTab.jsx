import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import Badge from '../../components/Badge'
import { Search, Phone, Flag, Star } from 'lucide-react'
import { glassInput, glass, stickyTh, stickyCol, stickyThCol } from '../../lib/glassStyles'

export default function DriversTab() {
  const LIMIT = 50
  const [drivers, setDrivers] = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [lowRatingIds, setLowRatingIds] = useState(new Set())
  const [flagsCache, setFlagsCache] = useState({})

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, lRes] = await Promise.all([
        api.get('/admin/drivers', { params: { page, limit: LIMIT } }),
        api.get('/admin/analytics/low-ratings', { params: { role: 'DRIVER' } }),
      ])
      setDrivers(Array.isArray(dRes.data?.drivers) ? dRes.data.drivers : [])
      setTotal(dRes.data?.total ?? 0)
      setLowRatingIds(new Set((lRes.data?.drivers ?? []).map(d => d.id)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetch() }, [fetch])

  async function loadFlags(id) {
    if (flagsCache[id]) return
    try {
      const res = await api.get(`/admin/drivers/${id}/flags`)
      setFlagsCache(f => ({ ...f, [id]: res.data }))
    } catch (e) { console.error(e) }
  }

  async function reportDriver(driver) {
    const reason = window.prompt(`Motif du signalement pour ${driver.name ?? driver.phone} :`)
    if (!reason?.trim()) return
    try {
      await api.post('/admin/report-user', { userId: driver.id, userRole: 'DRIVER', reason: reason.trim() })
      alert('Signalement envoyé.')
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  const visible = drivers.filter(d => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (d.name ?? '').toLowerCase().includes(q) || (d.phone ?? '').includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou téléphone…" style={{ ...glassInput, paddingLeft: 36 }} />
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                {['Livreur', 'Téléphone', 'Statut', 'Courses livrées', 'Note reçue', 'Incidents', 'Actions'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(d => {
                const flagged = lowRatingIds.has(d.id)
                const flags = flagsCache[d.id]
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }} onMouseEnter={() => loadFlags(d.id)}>
                    <td style={{ ...tdStyle, ...stickyCol }}>
                      <div style={{ fontWeight: 600 }}>{d.name?.trim() || d.phone}</div>
                      {flagged && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>
                          <Star size={10} /> Note basse
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {d.phone ? <a href={`tel:${d.phone}`} style={{ color: '#0077b6' }}>{d.phone}</a> : '—'}
                    </td>
                    <td style={tdStyle}><Badge status={d.isAvailable ? 'ONLINE' : 'OFFLINE'} /></td>
                    <td style={tdStyle}>{d.deliveredCourses ?? 0}</td>
                    <td style={tdStyle}>{d.avgRating > 0 ? `★ ${d.avgRating}` : '—'}</td>
                    <td style={tdStyle}>{flags?.incidentCount ?? '…'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {d.phone && (
                          <a href={`tel:${d.phone}`} style={btnSmall} title="Appeler"><Phone size={13} /></a>
                        )}
                        <button onClick={() => reportDriver(d)} style={{ ...btnSmall, color: '#dc2626', borderColor: '#dc2626' }} title="Signaler">
                          <Flag size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {totalPages} — {total} livreurs</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      )}
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
