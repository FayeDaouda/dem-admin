import { useState, useEffect, useCallback } from 'react'
import fleetApi from '../../lib/fleetApi'
import { RefreshCw } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll } from '../../lib/glassStyles'

function statusLabel(s) {
  return { PENDING: '⏳ En attente', APPROVED: '✓ Approuvée', REJECTED: '✗ Refusée' }[s] ?? s
}
function statusColor(s) {
  return { PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444' }[s] ?? '#888'
}

export default function FleetExtension() {
  const [fleetMax, setFleetMax]   = useState(null)
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)

  const [requestedSize, setRequestedSize] = useState('')
  const [justification, setJustification] = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving]   = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, reqRes] = await Promise.all([
        fleetApi.get('/chefs-de-flotte/me/stats'),
        fleetApi.get('/chefs-de-flotte/me/fleet-extension'),
      ])
      setFleetMax(statsRes.data?.fleetMax ?? null)
      setRequests(Array.isArray(reqRes.data?.requests) ? reqRes.data.requests : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const hasPending = requests.some(r => r.status === 'PENDING')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    setSaving(true)
    try {
      await fleetApi.post('/chefs-de-flotte/me/fleet-extension', {
        requestedSize: Number(requestedSize),
        justification,
      })
      setSuccess('Demande envoyée à l\'administrateur.')
      setRequestedSize(''); setJustification('')
      fetchAll()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de l\'envoi de la demande.')
    } finally { setSaving(false) }
  }

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Extension de flotte</h1>
        <button onClick={fetchAll} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
      </div>

      <div style={pageScroll}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <>
            <div style={{ ...glass, padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Limite actuelle de votre flotte</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{fleetMax ?? '—'} livreurs</div>
            </div>

            <div style={{ ...glass, padding: '20px 24px', marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Demander une extension</h2>

              {hasPending ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Vous avez déjà une demande en attente de réponse. Vous pourrez en soumettre une nouvelle une fois celle-ci traitée.
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Nouvelle taille souhaitée</label>
                    <input
                      type="number"
                      min={(fleetMax ?? 0) + 1}
                      value={requestedSize}
                      onChange={e => setRequestedSize(e.target.value)}
                      placeholder={`Supérieur à ${fleetMax ?? 0}`}
                      required
                      style={{ ...glassInput, maxWidth: 200 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Justification</label>
                    <textarea
                      value={justification}
                      onChange={e => setJustification(e.target.value)}
                      placeholder="Expliquez pourquoi vous avez besoin de plus de livreurs…"
                      required
                      rows={3}
                      style={{ ...glassInput, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>

                  {error && <div style={errorStyle}>{error}</div>}
                  {success && <div style={successStyle}>{success}</div>}

                  <button type="submit" disabled={saving} style={{ ...btnPrimary, alignSelf: 'flex-start' }}>
                    {saving ? 'Envoi…' : 'Envoyer la demande'}
                  </button>
                </form>
              )}
            </div>

            <div style={{ ...glass, padding: '20px 24px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Historique des demandes</h2>
              {requests.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune demande envoyée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {requests.map(r => (
                    <div key={r.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{r.requestedSize} livreurs</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(r.status) }}>{statusLabel(r.status)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{r.justification}</div>
                      {r.adminNotes && (
                        <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, fontStyle: 'italic' }}>
                          Réponse admin : {r.adminNotes}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle  = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const errorStyle  = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px' }
const successStyle= { fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,.08)', borderRadius: 6, padding: '7px 10px' }
const btnOutline  = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary  = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
