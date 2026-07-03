import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Flag } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput, stickyTh } from '../../lib/glassStyles'

const SEVERITY_CFG = {
  critical: { bg: '#ef444420', color: '#ef4444', label: 'Critique' },
  high:     { bg: '#f9731620', color: '#f97316', label: 'Élevé'   },
  medium:   { bg: '#f59e0b20', color: '#f59e0b', label: 'Moyen'   },
  low:      { bg: '#6366f120', color: '#818cf8', label: 'Faible'  },
}
const STATUS_CFG = {
  OPEN:          { bg: '#ef444420', color: '#ef4444', label: 'Ouvert'   },
  INVESTIGATING: { bg: '#f59e0b20', color: '#f59e0b', label: 'En cours' },
  RESOLVED:      { bg: '#22c55e20', color: '#22c55e', label: 'Résolu'   },
}

function Chip({ cfg }) {
  return (
    <span style={{ background: cfg?.bg ?? '#7c849920', color: cfg?.color ?? '#7c8499', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg?.label ?? '—'}
    </span>
  )
}

export default function IncidentsTab() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/incidents', { params: filterStatus ? { status: filterStatus } : {} })
      setIncidents(res.data?.incidents ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { fetch() }, [fetch])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['', 'Tous'], ['OPEN', 'Ouverts'], ['INVESTIGATING', 'En cours'], ['RESOLVED', 'Résolus']].map(([s, label]) => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: filterStatus === s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: filterStatus === s ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
        <button onClick={fetch} style={{ ...btnOutline, marginLeft: 'auto' }}><RefreshCw size={13} /> Actualiser</button>
        <button onClick={() => setReportOpen(true)} style={{ ...btnOutline, color: '#dc2626', borderColor: '#dc2626' }}>
          <Flag size={13} /> Signaler un utilisateur
        </button>
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : incidents.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun incident.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Type', 'Sévérité', 'Statut', 'Livreur', 'Ouvert le'].map(h => (
                  <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <tr key={inc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <AlertTriangle size={13} style={{ marginRight: 6, color: SEVERITY_CFG[inc.severity]?.color ?? '#7c8499', verticalAlign: 'middle' }} />
                    {inc.label ?? inc.type}
                  </td>
                  <td style={tdStyle}><Chip cfg={SEVERITY_CFG[inc.severity]} /></td>
                  <td style={tdStyle}><Chip cfg={STATUS_CFG[inc.status]} /></td>
                  <td style={tdStyle}>{inc.driverName ?? '—'}{inc.driverPhone && <> · <a href={`tel:${inc.driverPhone}`} style={{ color: '#0077b6' }}>{inc.driverPhone}</a></>}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{new Date(inc.openedAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </div>
  )
}

function ReportModal({ onClose }) {
  const [userRole, setUserRole] = useState('CLIENT')
  const [phone, setPhone]       = useState('')
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function submit() {
    if (!phone.trim() || !reason.trim()) { setError('Téléphone et motif requis.'); return }
    setSaving(true); setError('')
    try {
      const listPath = userRole === 'CLIENT' ? '/admin/clients' : '/admin/drivers'
      const res = await api.get(listPath, { params: { search: phone.trim(), limit: 1 } })
      const found = (res.data?.clients ?? res.data?.drivers ?? [])[0]
      if (!found) { setError('Aucun utilisateur trouvé avec ce numéro.'); setSaving(false); return }
      await api.post('/admin/report-user', { userId: found.id, userRole, reason: reason.trim() })
      onClose()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ ...glass, width: 400, maxWidth: '94vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Signaler un utilisateur</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['CLIENT', 'Client'], ['DRIVER', 'Livreur']].map(([v, l]) => (
            <button key={v} onClick={() => setUserRole(v)} style={{
              flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)',
              background: userRole === v ? 'var(--primary)' : 'rgba(255,255,255,.5)',
              color: userRole === v ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        <input style={glassInput} placeholder="Numéro de téléphone" value={phone} onChange={e => setPhone(e.target.value)} />
        <textarea style={{ ...glassInput, marginTop: 10, resize: 'vertical' }} rows={3} placeholder="Motif du signalement" value={reason} onChange={e => setReason(e.target.value)} />
        {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            {saving ? 'Envoi…' : 'Signaler'}
          </button>
        </div>
      </div>
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle', fontSize: 13 }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
