import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw } from 'lucide-react'
import { glass } from '../lib/glassStyles'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/clients')
      setClients(Array.isArray(res.data?.clients) ? res.data.clients : (Array.isArray(res.data) ? res.data : []))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function toggleBan(client) {
    const action = client.isBanned ? 'unban' : 'ban'
    if (!confirm(`${action === 'ban' ? 'Bannir' : 'Débannir'} ${client.name ?? client.phone} ?`)) return
    try {
      await api.patch(`/admin/clients/${client.id}/${action}`, action === 'ban' ? { reason: 'Banni par admin' } : {})
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clients</h1>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun client.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Nom', 'Téléphone', 'Inscription', 'Banni', 'Action'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{c.name ?? '—'}</td>
                  <td style={tdStyle}>{c.phone}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={tdStyle}>
                    {c.isBanned
                      ? <span style={{ color: 'var(--danger)' }}>Banni</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => toggleBan(c)}
                      style={{ ...btnSmall, color: c.isBanned ? 'var(--success)' : 'var(--danger)', borderColor: c.isBanned ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {c.isBanned ? 'Débannir' : 'Bannir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px', overflowX: 'auto' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnSmall   = { padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }
