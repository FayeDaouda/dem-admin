import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Filter } from 'lucide-react'
import api from '../lib/api'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'

// ── Constantes ────────────────────────────────────────────────────────────────
const SEVERITY_CFG = {
  critical: { bg: '#ef444420', color: '#ef4444', label: 'Critique' },
  high:     { bg: '#f97316220', color: '#f97316', label: 'Élevé'   },
  medium:   { bg: '#f59e0b20', color: '#f59e0b', label: 'Moyen'   },
  low:      { bg: '#6366f120', color: '#818cf8', label: 'Faible'  },
}

const STATUS_CFG = {
  OPEN:          { bg: '#ef444420', color: '#ef4444', label: 'Ouvert'       },
  INVESTIGATING: { bg: '#f59e0b20', color: '#f59e0b', label: 'En cours'     },
  RESOLVED:      { bg: '#22c55e20', color: '#22c55e', label: 'Résolu'       },
}

const TYPE_LABELS = {
  DRIVER_ABANDONED:   '🏃 Driver disparu (ACCEPTED)',
  DRIVER_UNREACHABLE: '📵 Driver introuvable (colis en transit)',
  PAYMENT_DISPUTE:    '💸 Litige paiement',
  ORDER_STUCK:        '🔒 Commande bloquée',
}

function Chip({ cfg, text }) {
  return (
    <span style={{
      background: cfg?.bg ?? '#7c849920',
      color: cfg?.color ?? '#7c8499',
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {text ?? cfg?.label}
    </span>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Incidents() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading]     = useState(true)
  const [detail, setDetail]       = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')

  // ── Chargement ──────────────────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterType)   params.type   = filterType
      const res = await api.get('/admin/incidents', { params })
      setIncidents(res.data?.incidents ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType])

  useEffect(() => { fetch() }, [fetch])

  // ── Temps réel : nouveaux incidents via socket ──────────────────────────────
  useEffect(() => {
    const s = connectSocket()
    const refresh = () => fetch()
    s.on('admin:incident:driver_redispatched', refresh)
    s.on('admin:incident:driver_unreachable',  refresh)
    s.on('admin:incident:user_report',         refresh)
    s.on('admin:payment:disputed',             refresh)
    return () => {
      s.off('admin:incident:driver_redispatched', refresh)
      s.off('admin:incident:driver_unreachable',  refresh)
      s.off('admin:incident:user_report',         refresh)
      s.off('admin:payment:disputed',             refresh)
    }
  }, [fetch])

  // ── Ouvrir détail ──────────────────────────────────────────────────────────
  function openDetail(inc) {
    setDetail(inc)
    setEditStatus(inc.status)
    setEditNotes(inc.notes ?? '')
  }

  // ── Sauvegarder ───────────────────────────────────────────────────────────
  async function save() {
    if (!detail) return
    setSaving(true)
    try {
      const res = await api.patch(`/admin/incidents/${detail.id}`, {
        status: editStatus,
        notes:  editNotes || null,
      })
      setDetail(res.data)
      setIncidents(prev => prev.map(i => i.id === res.data.id ? res.data : i))
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // ── Compteurs pour le header ───────────────────────────────────────────────
  const openCount   = incidents.filter(i => i.status === 'OPEN').length
  const critCount   = incidents.filter(i => i.severity === 'critical' && i.status !== 'RESOLVED').length
  const resolveRate = incidents.length
    ? Math.round(incidents.filter(i => i.status === 'RESOLVED').length / incidents.length * 100)
    : 0

  return (
    <div style={pageWrap}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={22} color="#ef4444" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Incidents opérationnels</h1>
          {openCount > 0 && (
            <span style={{ background: '#ef444420', color: '#ef4444', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
              {openCount} ouvert{openCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        {[
          { label: 'Ouverts',   value: openCount,                                         color: '#ef4444' },
          { label: 'Critiques', value: critCount,                                          color: '#f97316' },
          { label: 'En cours',  value: incidents.filter(i => i.status === 'INVESTIGATING').length, color: '#f59e0b' },
          { label: 'Résolus %', value: resolveRate + '%',                                  color: '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...glass, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...glassInput, width: 160 }}>
          <option value="">Tous les statuts</option>
          <option value="OPEN">Ouvert</option>
          <option value="INVESTIGATING">En cours</option>
          <option value="RESOLVED">Résolu</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...glassInput, width: 220 }}>
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* ── Liste ── */}
      <div style={pageScroll}>
      <div style={{ ...glass, padding: '0 0 4px' }}>
        {loading ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Chargement…</div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertTriangle size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Aucun incident{filterStatus || filterType ? ' pour ce filtre' : ''}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Sévérité', 'Type', 'Statut', 'Order ID', 'Livreur', 'Hors-ligne', 'Ouvert le', 'Notes'].map(h => (
                  <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, idx) => (
                <tr
                  key={inc.id}
                  onClick={() => openDetail(inc)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: inc.status === 'RESOLVED' ? 'transparent' : inc.severity === 'critical' ? '#ef444408' : 'transparent',
                  }}
                >
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{idx + 1}</td>
                  <td style={tdStyle}><Chip cfg={SEVERITY_CFG[inc.severity]} /></td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{TYPE_LABELS[inc.type] ?? inc.type}</td>
                  <td style={tdStyle}><Chip cfg={STATUS_CFG[inc.status]} /></td>
                  <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.orderId?.slice(0, 8) ?? '—'}</code></td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{inc.driverName ?? '—'}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{inc.offlineMin != null ? `${inc.offlineMin} min` : '—'}</td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(inc.openedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>

      {/* ── Modal détail + workflow ── */}
      {detail && (
        <div style={overlayStyle} onClick={() => setDetail(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <AlertTriangle size={18} color={SEVERITY_CFG[detail.severity]?.color ?? '#ef4444'} />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{TYPE_LABELS[detail.type] ?? detail.type}</h2>
              <Chip cfg={SEVERITY_CFG[detail.severity]} />
            </div>

            {/* Infos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 20 }}>
              <Row label="Commande"   value={<code>{detail.orderId ?? '—'}</code>} />
              <Row label="Livreur"    value={detail.driverName  ?? '—'} />
              <Row label="Téléphone"  value={detail.driverPhone ? <a href={`tel:${detail.driverPhone}`} style={{ color: '#0077b6' }}>{detail.driverPhone}</a> : '—'} />
              <Row label="Hors-ligne" value={detail.offlineMin != null ? `${detail.offlineMin} min` : '—'} />
              <Row label="Ouvert le"  value={new Date(detail.openedAt).toLocaleString('fr-FR')} />
              {detail.resolvedAt && <Row label="Résolu le" value={new Date(detail.resolvedAt).toLocaleString('fr-FR')} />}
            </div>

            {/* Workflow */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>STATUT</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {['OPEN', 'INVESTIGATING', 'RESOLVED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${editStatus === s ? STATUS_CFG[s].color : 'rgba(0,0,0,0.1)'}`,
                      background: editStatus === s ? STATUS_CFG[s].bg : 'transparent',
                      color: editStatus === s ? STATUS_CFG[s].color : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {STATUS_CFG[s].label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>NOTES INTERNES</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Ex : Contacté le driver par WhatsApp, en attente de confirmation…"
                style={{ ...glassInput, marginTop: 6, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Enregistrement…' : '✓ Enregistrer'}
              </button>
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
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 100, fontSize: 12 }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)', whiteSpace: 'nowrap' }
const tdStyle    = { padding: '10px 12px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'linear-gradient(135deg,#00b4d8,#0077b6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const modalStyle   = { background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 'var(--radius)', padding: '28px 32px', width: 520, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,40,80,0.25)' }
