import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { Search, Phone, Flag, Star } from 'lucide-react'
import { glassInput, glass, stickyTh, stickyCol, stickyThCol } from '../../lib/glassStyles'

export default function ClientsTab() {
  const LIMIT = 50
  const [clients, setClients] = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [lowRatingIds, setLowRatingIds] = useState(new Set())
  const [flagsCache, setFlagsCache] = useState({})

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, lRes] = await Promise.all([
        api.get('/admin/clients', { params: { page, limit: LIMIT, search: search || undefined } }),
        api.get('/admin/analytics/low-ratings', { params: { role: 'CLIENT' } }),
      ])
      setClients(cRes.data?.clients ?? [])
      setTotal(cRes.data?.total ?? 0)
      setLowRatingIds(new Set((lRes.data?.clients ?? []).map(c => c.id)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { const t = setTimeout(fetch, 300); return () => clearTimeout(t) }, [fetch])

  async function loadFlags(id) {
    if (flagsCache[id]) return
    try {
      const res = await api.get(`/admin/clients/${id}/flags`)
      setFlagsCache(f => ({ ...f, [id]: res.data }))
    } catch (e) { console.error(e) }
  }

  async function reportClient(client) {
    const reason = window.prompt(`Motif du signalement pour ${client.name ?? client.phone} :`)
    if (!reason?.trim()) return
    try {
      await api.post('/admin/report-user', { userId: client.id, userRole: 'CLIENT', reason: reason.trim() })
      alert('Signalement envoyé.')
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => { setPage(1); setSearch(e.target.value) }} placeholder="Nom ou téléphone…" style={{ ...glassInput, paddingLeft: 36 }} />
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {['Client', 'Téléphone', 'Courses', 'Note donnée', 'Inscription', 'Actions'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const flagged = lowRatingIds.has(c.id)
                const flags = flagsCache[c.id]
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }} onMouseEnter={() => loadFlags(c.id)}>
                    <td style={{ ...tdStyle, ...stickyCol }}>
                      <div style={{ fontWeight: 600 }}>{c.name ?? 'Sans nom'}</div>
                      {flagged && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>
                          <Star size={10} /> Note basse
                        </span>
                      )}
                      {flags?.recentCancellations >= 3 && (
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#b45309', marginLeft: flagged ? 8 : 0, marginTop: 2 }}>
                          ⚠ {flags.recentCancellations} annulations (30j)
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {c.phone ? <a href={`tel:${c.phone}`} style={{ color: '#0077b6' }}>{c.phone}</a> : '—'}
                    </td>
                    <td style={tdStyle}>{c._count?.ordersAsClient ?? 0}</td>
                    <td style={tdStyle}>{flags?.avgRatingGiven != null ? `★ ${flags.avgRatingGiven}` : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} style={btnSmall} title="Appeler"><Phone size={13} /></a>
                        )}
                        <button onClick={() => reportClient(c)} style={{ ...btnSmall, color: '#dc2626', borderColor: '#dc2626' }} title="Signaler">
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
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {totalPages} — {total} clients</span>
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
