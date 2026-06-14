import { useState, useEffect, useCallback } from 'react'
import fleetApi from '../../lib/fleetApi'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { glass, pageWrap, pageScroll } from '../../lib/glassStyles'

const SEVERITY_LABEL = { critical: 'Critique', high: 'Élevée', medium: 'Moyenne', low: 'Faible' }
const SEVERITY_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#94a3b8' }

const STATUS_LABEL = { OPEN: 'Ouverte', INVESTIGATING: 'En cours', RESOLVED: 'Résolue' }
const STATUS_COLOR = { OPEN: '#ef4444', INVESTIGATING: '#0077b6', RESOLVED: '#22c55e' }

function timeAgo(dateStr) {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} j`
}

export default function FleetAlerts() {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [error, setError] = useState('')

  const fetchAlerts = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fleetApi.get('/chefs-de-flotte/me/incidents')
      setAlerts(Array.isArray(data.incidents) ? data.incidents : [])
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur de chargement.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function setStatus(id, status) {
    setActingId(id); setError('')
    try {
      await fleetApi.patch(`/chefs-de-flotte/me/incidents/${id}`, { status })
      await fetchAlerts()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setActingId(null) }
  }

  const openCount = alerts.filter(a => a.status !== 'RESOLVED').length

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Alertes</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {openCount} alerte{openCount === 1 ? '' : 's'} en cours sur votre flotte
          </div>
        </div>
        <button onClick={fetchAlerts} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
      </div>

      <div style={pageScroll}>
        {error && <div style={{ ...errorStyle, marginBottom: 14 }}>{error}</div>}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : alerts.length === 0 ? (
          <div style={{ ...glass, padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Aucune alerte pour le moment. Tout va bien 👍
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map(a => (
              <div key={a.id} style={{ ...glass, padding: '14px 18px', borderLeft: `4px solid ${SEVERITY_COLOR[a.severity] ?? '#94a3b8'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertTriangle size={18} color={SEVERITY_COLOR[a.severity] ?? '#94a3b8'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {a.driverName?.trim() || a.driverPhone || 'Livreur inconnu'}
                        {a.orderId && ` · Commande #${a.orderId.slice(-6)}`}
                      </div>
                      {a.notes && (
                        <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6, fontStyle: 'italic' }}>
                          Note : {a.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: (SEVERITY_COLOR[a.severity] ?? '#94a3b8') + '22', color: SEVERITY_COLOR[a.severity] ?? '#94a3b8' }}>
                      {SEVERITY_LABEL[a.severity] ?? a.severity}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[a.status] ?? '#888' }}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(a.openedAt)}</span>
                  </div>
                </div>

                {!a.id.startsWith('inactive-') && a.status !== 'RESOLVED' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {a.status === 'OPEN' && (
                      <button onClick={() => setStatus(a.id, 'INVESTIGATING')} disabled={actingId === a.id} style={btnOutline}>
                        Marquer en cours
                      </button>
                    )}
                    <button onClick={() => setStatus(a.id, 'RESOLVED')} disabled={actingId === a.id} style={btnPrimary}>
                      Marquer résolue
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
