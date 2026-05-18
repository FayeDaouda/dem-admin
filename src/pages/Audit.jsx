import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search, Shield } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// ── Couleurs par catégorie d'action ──────────────────────────────────────────
function actionColor(action = '') {
  if (action.includes('CANCEL') || action.includes('BAN') || action.includes('SUSPEND'))
    return { bg: '#ef444418', color: '#ef4444' }
  if (action.includes('VALIDATE') || action.includes('ACTIVATE') || action.includes('APPROVE'))
    return { bg: '#22c55e18', color: '#22c55e' }
  if (action.includes('REASSIGN') || action.includes('REDISPATCH') || action.includes('FORCE'))
    return { bg: '#f9731618', color: '#f97316' }
  if (action.includes('PAYMENT') || action.includes('BILLING') || action.includes('FEES'))
    return { bg: '#f59e0b18', color: '#f59e0b' }
  if (action.includes('CONFIG') || action.includes('BADGE') || action.includes('UPDATE'))
    return { bg: '#6366f118', color: '#818cf8' }
  return { bg: '#0077b618', color: '#0077b6' }
}

function ActionBadge({ action }) {
  const { bg, color } = actionColor(action)
  return (
    <span style={{
      background: bg, color, padding: '2px 9px',
      borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {action}
    </span>
  )
}

export default function Audit() {
  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [detail, setDetail]     = useState(null)
  const LIMIT = 50

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (search.trim()) params.action = search.trim()
      const res = await api.get('/admin/audit', { params })
      setLogs(res.data?.logs ?? [])
      setTotal(res.data?.total ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetch() }, [fetch])

  // Reset page quand la recherche change
  const handleSearch = (v) => { setSearch(v); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function parseDetails(raw) {
    if (!raw) return null
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return raw }
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={20} color="var(--primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Journal d'audit</h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
            {total.toLocaleString()} entrée{total !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* ── Filtres ── */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Filtrer par action (ex: CANCEL, DRIVER…)"
          style={{ ...glassInput, paddingLeft: 36 }}
        />
      </div>

      {/* ── Table ── */}
      <div style={{ ...glass, padding: '0 0 4px', overflowX: 'auto', marginBottom: 16 }}>
        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Chargement…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Shield size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
            Aucun log{search ? ' pour ce filtre' : ''}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date & heure', 'Action', 'Admin', 'Type cible', 'Cible', 'Détails'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const details = parseDetails(log.details)
                return (
                  <tr
                    key={log.id}
                    onClick={() => setDetail(log)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: details ? 'pointer' : 'default' }}
                  >
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                      {new Date(log.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td style={tdStyle}><ActionBadge action={log.action} /></td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>
                      <code style={{ color: 'var(--text-muted)' }}>{log.adminId?.slice(0, 8) ?? '—'}</code>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{log.targetType ?? '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>
                      {log.targetId ? <code style={{ color: 'var(--text-muted)' }}>{log.targetId.slice(0, 8)}</code> : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {details ? JSON.stringify(details) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 8px' }}>
            Page {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      )}

      {/* ── Modal détail ── */}
      {detail && (
        <div style={overlayStyle} onClick={() => setDetail(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Shield size={16} color="var(--primary)" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Détail du log</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <Row label="Action"      value={<ActionBadge action={detail.action} />} />
              <Row label="Date"        value={new Date(detail.createdAt).toLocaleString('fr-FR')} />
              <Row label="Admin ID"    value={<code style={{ fontSize: 11 }}>{detail.adminId}</code>} />
              <Row label="Type cible"  value={detail.targetType ?? '—'} />
              <Row label="Cible ID"    value={detail.targetId ? <code style={{ fontSize: 11 }}>{detail.targetId}</code> : '—'} />
              {detail.details && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginBottom: 6 }}>Détails</span>
                  <pre style={{
                    background: 'rgba(0,119,182,0.06)', border: '1px solid rgba(0,119,182,0.12)',
                    borderRadius: 8, padding: '10px 14px', fontSize: 12, overflowX: 'auto',
                    margin: 0, color: 'var(--text)',
                  }}>
                    {JSON.stringify(
                      typeof detail.details === 'string' ? JSON.parse(detail.details) : detail.details,
                      null, 2
                    )}
                  </pre>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={() => setDetail(null)} style={btnOutline}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 90, fontSize: 12 }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const thStyle     = { textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)', whiteSpace: 'nowrap' }
const tdStyle     = { padding: '10px 14px', verticalAlign: 'middle' }
const btnOutline  = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const modalStyle  = { background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 'var(--radius)', padding: '28px 32px', width: 540, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,40,80,0.25)' }
