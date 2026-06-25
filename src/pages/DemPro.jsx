import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw, CheckCircle, XCircle, Pencil, Trash2, Ban, RotateCcw, X } from 'lucide-react'
import { glass, glassModal, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'

const STATUS_FILTERS = [
  ['all',       'Tous'],
  ['PENDING',   'En attente'],
  ['ACTIVE',    'Actifs'],
  ['REJECTED',  'Refusés'],
  ['SUSPENDED', 'Suspendus'],
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

// ── Modal Modifier ───────────────────────────────────────────────────────────
function EditModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:            initial?.name            ?? '',
    phone:           initial?.phone           ?? '',
    email:           initial?.email           ?? '',
    proBusinessName: initial?.proBusinessName ?? '',
    proSector:       initial?.proSector       ?? '',
    proWeeklyVolume: initial?.proWeeklyVolume ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setSaving(true); setError('')
    try {
      await api.patch(`/admin/dem-pro/${initial.id}`, form)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 460, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Modifier le compte DEM Pro</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        {[
          { key: 'name',            label: 'Nom complet',     type: 'text', placeholder: 'Ex : Ibrahima Sow' },
          { key: 'phone',           label: 'Téléphone',       type: 'tel',  placeholder: '+221 77 000 00 00' },
          { key: 'email',           label: 'Email',           type: 'email', placeholder: 'email@exemple.com' },
          { key: 'proBusinessName', label: 'Nom entreprise',  type: 'text', placeholder: 'Ex : Sow Commerce SARL' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              placeholder={placeholder}
              style={inputStyle}
            />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Secteur</label>
          <select value={form.proSector} onChange={e => set('proSector', e.target.value)} style={inputStyle}>
            <option value="">— Choisir —</option>
            {Object.entries(SECTOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Volume hebdomadaire</label>
          <select value={form.proWeeklyVolume} onChange={e => set('proWeeklyVolume', e.target.value)} style={inputStyle}>
            <option value="">— Choisir —</option>
            {Object.entries(VOLUME_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers statut ───────────────────────────────────────────────────────────
function proStatusInfo(a) {
  if (!a.isActive && a.proStatus === 'ACTIVE') return { text: '⚠ Suspendu', color: '#ef4444' }
  if (a.proStatus === 'PENDING')  return { text: '⏳ En attente', color: '#f59e0b' }
  if (a.proStatus === 'ACTIVE')   return { text: '✓ Actif', color: '#22c55e' }
  if (a.proStatus === 'REJECTED') return { text: '✗ Refusé', color: '#ef4444' }
  return { text: a.proStatus ?? '—', color: '#888' }
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function DemPro() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [modal, setModal]       = useState(null)   // { type: 'reject' | 'suspend', account }
  const [editTarget, setEditTarget] = useState(null)
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

  async function toggleSuspend(account, reason) {
    setSaving(true)
    try {
      await api.patch(`/admin/dem-pro/${account.id}/suspend`, { reason: reason || undefined })
      setModal(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount(account) {
    if (!confirm(`Supprimer définitivement ${account.name ?? account.phone} ? Cette action est irréversible.`)) return
    try {
      await api.delete(`/admin/dem-pro/${account.id}`)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {STATUS_FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: '1px solid var(--border)',
              background: filter === val ? 'var(--primary)' : 'transparent',
              color: filter === val ? '#fff' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
                  {['#', 'Nom', 'Téléphone', 'Entreprise', 'Secteur', 'Volume', 'Statut', 'Inscrit le', 'Actions'].map(h => (
                    <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, idx) => {
                  const status = proStatusInfo(a)
                  const isSuspended = !a.isActive && a.proStatus === 'ACTIVE'
                  return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{idx + 1}</td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{a.name ?? '—'}</span></td>
                    <td style={tdStyle}>{a.phone}</td>
                    <td style={tdStyle}>{a.proBusinessName ?? '—'}</td>
                    <td style={tdStyle}>{SECTOR_LABELS[a.proSector] ?? a.proSector ?? '—'}</td>
                    <td style={tdStyle}>{VOLUME_LABELS[a.proWeeklyVolume] ?? a.proWeeklyVolume ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {a.proStatus === 'PENDING' && (
                          <>
                            <button onClick={() => validate(a.id, true)} disabled={saving} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }} title="Valider">
                              <CheckCircle size={13} />
                            </button>
                            <button onClick={() => setModal({ type: 'reject', account: a })} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Refuser">
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                        {a.proStatus === 'ACTIVE' && !isSuspended && (
                          <button onClick={() => setModal({ type: 'suspend', account: a })} style={{ ...btnSmall, color: '#f59e0b', borderColor: '#f59e0b' }} title="Suspendre">
                            <Ban size={13} />
                          </button>
                        )}
                        {isSuspended && (
                          <button onClick={() => toggleSuspend(a)} disabled={saving} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }} title="Réactiver">
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button onClick={() => setEditTarget(a)} style={btnSmall} title="Modifier">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteAccount(a)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal refus */}
      {modal?.type === 'reject' && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20, fontSize: 16 }}>Refuser le compte DEM Pro</h2>
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              {modal.account.name ?? modal.account.phone} — {modal.account.proBusinessName ?? 'Sans entreprise'}
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
                  validate(modal.account.id, false, reason)
                }}
                style={btnDanger}
              >
                {saving ? 'Refus...' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suspension */}
      {modal?.type === 'suspend' && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20, fontSize: 16 }}>Suspendre le compte DEM Pro</h2>
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              {modal.account.name ?? modal.account.phone} — {modal.account.proBusinessName ?? 'Sans entreprise'}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Motif de la suspension</label>
              <textarea
                id="suspend-reason"
                rows={3}
                placeholder="Motif de la suspension..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={btnOutline}>Annuler</button>
              <button
                disabled={saving}
                onClick={() => {
                  const reason = document.getElementById('suspend-reason').value
                  toggleSuspend(modal.account, reason)
                }}
                style={{ ...btnDanger, background: '#f59e0b' }}
              >
                {saving ? 'Suspension...' : 'Confirmer la suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modifier */}
      {editTarget && (
        <EditModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetch() }}
        />
      )}
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnDanger  = { padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glassModal }
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }
const inputStyle = { ...glassInput }
const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
