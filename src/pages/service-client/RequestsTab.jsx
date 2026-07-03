import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import StatusBadge from './components/StatusBadge'

const KIND_LABELS = {
  DEM_PRO_CREATE:   'Création compte DEM Pro',
  DEM_PRO_SUSPEND:  'Suspension compte DEM Pro',
  DEM_PRO_ACTIVATE: 'Réactivation compte DEM Pro',
  GESTE_FREE_RIDE:  'Course gratuite',
  GESTE_DISCOUNT:   'Remise',
}

export default function RequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/requests', { params: filter === 'all' ? {} : { status: filter } })
      setRequests(res.data?.requests ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { fetch() }, [fetch])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', 'Toutes'], ['PENDING', 'En attente'], ['APPROVED', 'Approuvées'], ['REJECTED', 'Refusées']].map(([s, label]) => (
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
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{KIND_LABELS[r.kind] ?? r.kind}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.targetUser && <>Concerne : {r.targetUser.proBusinessName ?? r.targetUser.name ?? r.targetUser.phone} · </>}
                      {new Date(r.createdAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.reason && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>« {r.reason} »</div>}
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
