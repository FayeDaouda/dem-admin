import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import StatusBadge from '../../components/StatusBadge'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { REQUEST_KIND_LABELS as KIND_LABELS, requestDetails } from '../../lib/requestKinds'
import { glass, glassInput } from '../../lib/glassStyles'

export default function RequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [replies, setReplies]   = useState({}) // réponse à une précision demandée
  const [errors, setErrors]     = useState({})

  async function reply(r) {
    const text = (replies[r.id] ?? '').trim()
    if (!text) return
    setErrors(e => ({ ...e, [r.id]: null }))
    try {
      await api.patch(`/admin/requests/${r.id}/reply`, { reply: text })
      setReplies(x => ({ ...x, [r.id]: '' }))
      fetch(true)
    } catch (e) {
      setErrors(er => ({ ...er, [r.id]: e.response?.data?.message ?? 'Erreur.' }))
    }
  }

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/requests', { params: filter === 'all' ? {} : { status: filter } })
      setRequests(res.data?.requests ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [filter])

  useEffect(() => { fetch() }, [fetch])
  useAutoRefresh(() => fetch(true))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', 'Toutes'], ['PENDING', 'En attente'], ['NEEDS_INFO', 'Précision demandée'], ['APPROVED', 'Approuvées'], ['REJECTED', 'Refusées']].map(([s, label]) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: filter === s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: filter === s ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
        <button onClick={fetch} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : requests.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucune demande.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(r => (
              <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {KIND_LABELS[r.kind] ?? r.kind}
                      {r.urgent && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: '#fff', background: '#dc2626', padding: '1px 7px', borderRadius: 10 }}>URGENT</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.targetUser && <>Concerne : {r.targetUser.proBusinessName ?? r.targetUser.name ?? r.targetUser.phone} · </>}
                      {new Date(r.createdAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.reason && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>« {r.reason} »</div>}
                {requestDetails(r).length > 0 && <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)' }}>{requestDetails(r).join(' · ')}</div>}
                {r.infoQuestion && (
                  <div style={{ marginTop: 6, fontSize: 12.5 }}>
                    <strong>Question du Super Admin :</strong> {r.infoQuestion}
                    {r.infoReply && <div><strong>Votre réponse :</strong> {r.infoReply}</div>}
                  </div>
                )}
                {r.status === 'NEEDS_INFO' && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={replies[r.id] ?? ''} onChange={e => setReplies(x => ({ ...x, [r.id]: e.target.value }))} placeholder="Votre réponse" style={{ ...glassInput, flex: 1, maxWidth: 420, padding: '6px 10px', fontSize: 13 }} />
                    <button onClick={() => reply(r)} disabled={!(replies[r.id] ?? '').trim()} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Répondre</button>
                    {errors[r.id] && <div style={{ fontSize: 12, color: '#dc2626', width: '100%' }}>{errors[r.id]}</div>}
                  </div>
                )}
                {r.status !== 'PENDING' && r.reviewNotes && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}><strong>Réponse :</strong> {r.reviewNotes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
