import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { Search, Gift, Percent } from 'lucide-react'
import { glass, glassInput } from '../../lib/glassStyles'
import StatusBadge from './components/StatusBadge'
import SubmitRequestModal from './components/SubmitRequestModal'

const KIND_LABELS = { GESTE_FREE_RIDE: 'Course gratuite', GESTE_DISCOUNT: 'Remise' }

export default function GestesTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [results, setResults]   = useState([])
  const [modal, setModal]       = useState(null) // { kind, targetUser }

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/requests')
      setRequests((res.data?.requests ?? []).filter(r => r.kind === 'GESTE_FREE_RIDE' || r.kind === 'GESTE_DISCOUNT'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/admin/clients', { params: { search, limit: 5 } })
        setResults(res.data?.clients ?? [])
      } catch (e) { console.error(e) }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  function pickClient(client, kind) {
    setModal({ kind, targetUser: { id: client.id, label: client.name ?? client.phone } })
    setSearch(''); setResults([])
  }

  return (
    <div>
      <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Nouvelle demande de geste commercial</h2>
        <div style={{ position: 'relative', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un client (nom ou téléphone)…" style={{ ...glassInput, paddingLeft: 36 }} />
        </div>
        {results.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)' }}>
                <span style={{ fontSize: 13 }}>{c.name ?? 'Sans nom'} · {c.phone}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => pickClient(c, 'GESTE_FREE_RIDE')} style={{ ...btnSmall, color: '#15803d', borderColor: '#15803d' }}>
                    <Gift size={12} /> Course gratuite
                  </button>
                  <button onClick={() => pickClient(c, 'GESTE_DISCOUNT')} style={{ ...btnSmall, color: '#6366f1', borderColor: '#6366f1' }}>
                    <Percent size={12} /> Remise
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Historique</h2>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : requests.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucune demande soumise.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(r => (
              <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{KIND_LABELS[r.kind]} — {r.targetUser?.name ?? r.targetUser?.phone ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleString('fr-FR')}{r.reason && <> · « {r.reason} »</>}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <SubmitRequestModal
          kind={modal.kind}
          targetUser={modal.targetUser}
          onClose={() => setModal(null)}
          onSubmitted={() => { setModal(null); fetch() }}
        />
      )}
    </div>
  )
}

const btnSmall = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }
