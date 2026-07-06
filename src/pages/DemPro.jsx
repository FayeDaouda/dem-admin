import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import Badge from '../components/Badge'
import { RefreshCw, CheckCircle, XCircle, Pencil, Trash2, Ban, RotateCcw, X, Search } from 'lucide-react'
import { glass, glassModal, glassInput, pageWrap, pageScroll, stickyTh, stickyThCol, stickyCol } from '../lib/glassStyles'

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
const SECTOR_COLORS = {
  commerce:     '#6366f1',
  restauration: '#f59e0b',
  services:     '#06b6d4',
  artisanat:    '#ec4899',
  autre:        '#8b5cf6',
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

// ── Stats cards ──────────────────────────────────────────────────────────────
function ProStats({ accounts }) {
  if (!accounts.length) return null
  const active    = accounts.filter(a => a.proStatus === 'ACTIVE' && a.isActive).length
  const pending   = accounts.filter(a => a.proStatus === 'PENDING').length
  const totalOrders = accounts.reduce((s, a) => s + (a._count?.ordersAsClient ?? 0), 0)

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        { label: 'Total comptes', value: accounts.length, color: 'var(--primary)' },
        { label: 'Actifs',        value: active,           color: 'var(--success)' },
        { label: 'En attente',    value: pending,          color: '#f59e0b' },
        { label: 'Commandes',     value: totalOrders,      color: '#6366f1' },
      ].map(s => (
        <div key={s.label} style={{ ...glass, padding: '14px 18px', flex: '1 1 140px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function DemPro() {
  const { user } = useAuth()
  // Actions (valider, suspendre, modifier, supprimer) : SUPER uniquement —
  // SC / MARKETING / AE consultent en lecture seule
  const isSuper = !user?.adminRole || user.adminRole === 'SUPER'
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving]     = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/dem-pro')
      setAccounts(res.data?.accounts ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

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

  const filtered = accounts
    .filter(a => {
      if (filter === 'all') return true
      if (filter === 'SUSPENDED') return !a.isActive
      return a.proStatus === filter
    })
    .filter(a => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (a.name ?? '').toLowerCase().includes(q)
        || (a.phone ?? '').includes(q)
        || (a.proBusinessName ?? '').toLowerCase().includes(q)
    })

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>DEM Pro</h1>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <ProStats accounts={accounts} />

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {STATUS_FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            style={{
              padding: '4px 14px', borderRadius: 20,
              border: '1px solid rgba(0,119,182,.25)',
              background: filter === val ? 'var(--primary)' : 'rgba(255,255,255,.5)',
              color: filter === val ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, téléphone ou entreprise…"
            style={{ ...glassInput, paddingLeft: 36, width: '100%' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={pageScroll}>
        <div style={card}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>
              Aucun compte DEM Pro{filter !== 'all' || search ? ' pour ce filtre' : ''}.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['#', 'Entreprise', 'Téléphone', 'Secteur', 'Volume', 'Commandes', 'Statut', 'Inscription', 'Actions'].map((h, i) => (
                    <th key={h} style={{ ...thStyle, ...(i === 1 ? stickyThCol : stickyTh) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => {
                  const status = proStatusInfo(a)
                  const isSuspended = !a.isActive && a.proStatus === 'ACTIVE'
                  const sectorColor = SECTOR_COLORS[a.proSector] ?? '#888'
                  return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', opacity: isSuspended ? 0.6 : 1 }}>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, ...stickyCol }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
                          background: 'linear-gradient(135deg,rgba(99,102,241,.15),rgba(6,113,186,.15))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: '#6366f1', fontSize: 13, flexShrink: 0,
                        }}>
                          {a.avatar
                            ? <img src={a.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                            : (a.proBusinessName?.trim() || a.name?.trim() || a.phone || '?')[0].toUpperCase()
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.proBusinessName?.trim() || '—'}</div>
                          {a.name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{a.phone}</td>
                    <td style={tdStyle}>
                      {a.proSector ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                          background: sectorColor + '18', color: sectorColor,
                        }}>
                          {SECTOR_LABELS[a.proSector] ?? a.proSector}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>{VOLUME_LABELS[a.proWeeklyVolume] ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                      {a._count?.ordersAsClient ?? 0}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={tdStyle}>
                      {isSuper ? (
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
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Lecture seule</span>
                      )}
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
const tableStyle = { width: '100%', minWidth: 900, borderCollapse: 'collapse' }
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
