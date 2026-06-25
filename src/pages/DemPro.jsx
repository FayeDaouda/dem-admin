import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { glass, glassModal, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'

const STATUS_FILTERS = [
  ['all',      'Tous'],
  ['PENDING',  'En attente'],
  ['ACTIVE',   'Actifs'],
  ['REJECTED', 'Refusés'],
]

const SECTOR_LABELS = {
  commerce:     'Commerce',
  restauration: 'Restauration',
  services:     'Services',
  artisanat:    'Artisanat',
  autre:        'Autre',
}

const VOLUME_LABELS = {
  low:    '1–4 / sem.',
  medium: '5–8 / sem.',
  high:   '9+ / sem.',
}

export default function DemPro() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [modal, setModal]       = useState(null)
  const [saving, setSaving]     = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const res = await api.get('/admin/dem-pro', { params })
      setAccounts(res.data?.accounts ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetch() }, [fetch])

  async function validate(id, approve, reason) {
    setSaving(true)
    try {
      await api.patch(`/admin/dem-pro/${id}/validate`, { approve, reason: reason || undefined })
      setModal(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>DEM Pro</h1>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexShrink: 0 }}>
        {STATUS_FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: '1px solid var(--border)',
              background: filter === val ? 'var(--primary)' : 'transparent',
              color: filter === val ? '#fff' : 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={pageScroll}>
        <div style={card}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement...</div>
          ) : accounts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun compte DEM Pro.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['#', 'Nom', 'Telephone', 'Entreprise', 'Secteur', 'Volume', 'Statut', 'Inscrit le', 'Actions'].map(h => (
                    <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, idx) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{idx + 1}</td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{a.name ?? '—'}</span></td>
                    <td style={tdStyle}>{a.phone}</td>
                    <td style={tdStyle}>{a.proBusinessName ?? '—'}</td>
                    <td style={tdStyle}>{SECTOR_LABELS[a.proSector] ?? a.proSector ?? '—'}</td>
                    <td style={tdStyle}>{VOLUME_LABELS[a.proWeeklyVolume] ?? a.proWeeklyVolume ?? '—'}</td>
                    <td style={tdStyle}>
                      {a.proStatus === 'PENDING'  && <Badge status="PENDING" />}
                      {a.proStatus === 'ACTIVE'   && <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>Actif</span>}
                      {a.proStatus === 'REJECTED' && <span style={{ color: 'var(--danger)', fontSize: 13 }}>Refuse</span>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={tdStyle}>
                      {a.proStatus === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => validate(a.id, true)} disabled={saving} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}>
                            <CheckCircle size={13} /> Valider
                          </button>
                          <button onClick={() => setModal(a)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                            <XCircle size={13} /> Refuser
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal refus */}
      {modal && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20, fontSize: 16 }}>Refuser le compte DEM Pro</h2>
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              {modal.name ?? modal.phone} — {modal.proBusinessName ?? 'Sans entreprise'}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Motif du refus</label>
              <textarea
                id="reject-reason"
                rows={3}
                placeholder="Expliquez le motif du refus..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={btnOutline}>Annuler</button>
              <button
                disabled={saving}
                onClick={() => {
                  const reason = document.getElementById('reject-reason').value
                  validate(modal.id, false, reason)
                }}
                style={btnDanger}
              >
                {saving ? 'Refus...' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnDanger  = { padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glassModal }
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }
const inputStyle = { ...glassInput }
