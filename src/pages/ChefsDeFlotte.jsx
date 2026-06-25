import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { RefreshCw, Plus, Pencil, Trash2, X, Search, CheckCircle } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

// ── Modal Créer / Modifier ────────────────────────────────────────────────────
function ChefFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    phone:        initial?.phone        ?? '',
    companyName:  initial?.companyName  ?? '',
    fleetMaxSize: initial?.fleetMaxSize ?? 10,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.phone.trim()) { setError('Le numéro est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await api.patch(`/admin/chefs-de-flotte/${initial.id}`, form)
      } else {
        await api.post('/admin/chefs-de-flotte', form)
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 420, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Modifier le chef de flotte' : 'Créer un chef de flotte'}</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        {[
          { key: 'name',        label: 'Nom complet',        type: 'text', placeholder: 'Ex : Ibrahima Sow' },
          { key: 'phone',       label: 'Téléphone *',         type: 'tel',  placeholder: '+221 77 000 00 00' },
          { key: 'companyName', label: 'Nom de la société',   type: 'text', placeholder: 'Ex : Transport Sow SARL' },
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
          <label style={labelStyle}>Taille max. de la flotte</label>
          <input
            type="number"
            min={1}
            max={200}
            value={form.fleetMaxSize}
            onChange={e => set('fleetMaxSize', e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers statut ────────────────────────────────────────────────────────────
function statusLabel(s) {
  return { PENDING: '⏳ En attente', ACTIVE: '✓ Actif', REJECTED: '✗ Refusé' }[s] ?? s ?? '—'
}
function statusColor(s) {
  return { PENDING: '#f59e0b', ACTIVE: '#22c55e', REJECTED: '#ef4444' }[s] ?? '#888'
}
function chefStatusInfo(c) {
  if (!c.isActive) return { text: '⚠ Suspendu', color: '#ef4444' }
  return { text: statusLabel(c.chefDeFlotteStatus), color: statusColor(c.chefDeFlotteStatus) }
}

// ── Page principale ───────────────────────────────────────────────────────────
function NetworkStats({ chefs }) {
  if (!chefs.length) return null

  const activeCount  = chefs.filter(c => c.chefDeFlotteStatus === 'ACTIVE' && c.isActive).length
  const totalDrivers = chefs.reduce((s, c) => s + (c._count?.managedDrivers ?? 0), 0)

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        { label: 'Chefs actifs', value: activeCount, color: '#B8860B' },
        { label: 'Livreurs gérés', value: totalDrivers, color: 'var(--primary)' },
        { label: 'Total chefs', value: chefs.length, color: 'var(--success)' },
      ].map(s => (
        <div key={s.label} style={{ ...glass, padding: '14px 18px', flex: '1 1 160px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function ChefsDeFlotte() {
  const navigate = useNavigate()
  const [chefs, setChefs]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [formTarget, setFormTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [sortDate, setSortDate]   = useState(null)
  const [acting, setActing]       = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/chefs-de-flotte', { params: { status: 'all' } })
      setChefs(Array.isArray(res.data?.chefs) ? res.data.chefs : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function deleteChef(chef) {
    if (!confirm(`Supprimer définitivement ${chef.name ?? chef.phone} ? Cette action est irréversible.`)) return
    try {
      await api.delete(`/admin/chefs-de-flotte/${chef.id}`)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function approveChef(chef) {
    if (!confirm(`Approuver ${chef.name?.trim() || chef.phone} comme chef de flotte ?`)) return
    setActing(chef.id)
    try {
      await api.patch(`/admin/chefs-de-flotte/${chef.id}/validate`, { approve: true })
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActing(null)
    }
  }

  const filtered = chefs
    .filter(c => statusFilter === 'all'
      ? true
      : statusFilter === 'SUSPENDED' ? !c.isActive
      : c.chefDeFlotteStatus === statusFilter)
    .filter(c => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    })

  const sorted = sortDate
    ? [...filtered].sort((a, b) => {
        const diff = new Date(a.createdAt) - new Date(b.createdAt)
        return sortDate === 'asc' ? diff : -diff
      })
    : filtered

  const hasFilters = !!(search || statusFilter !== 'all')

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Chefs de flotte</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={fetch} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          <button onClick={() => setFormTarget({})} style={btnPrimary}><Plus size={14} /> Nouveau</button>
        </div>
      </div>

      <NetworkStats chefs={chefs} />

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {[['all', 'Tous'], ['PENDING', '⏳ En attente'], ['ACTIVE', '✓ Actifs'], ['SUSPENDED', '⚠ Suspendus']].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} style={{
            padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: statusFilter === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: statusFilter === key ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou téléphone…" style={{ ...glassInput, paddingLeft: 36, width: '100%' }} />
        </div>
      </div>

      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : sorted.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun chef de flotte{hasFilters ? ' pour ce filtre' : ''}.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Chef de flotte', 'Téléphone', 'Société', 'Flotte', 'Statut', 'Inscription', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh), ...(h === 'Inscription' ? { cursor: 'pointer', userSelect: 'none' } : {}) }}
                    onClick={h === 'Inscription' ? () => setSortDate(s => s === 'desc' ? 'asc' : s === 'asc' ? null : 'desc') : undefined}
                    title={h === 'Inscription' ? 'Trier par date d\'inscription' : undefined}
                  >
                    {h}{h === 'Inscription' && (sortDate === 'desc' ? ' ▼' : sortDate === 'asc' ? ' ▲' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const status = chefStatusInfo(c)
                return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/chefs-de-flotte/${c.id}`)}>
                  <td style={{ ...tdStyle, ...stickyCol, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 13, flexShrink: 0 }}>
                        {c.avatar ? <img src={c.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} /> : (c.name?.trim() || c.phone || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.name?.trim() || c.phone}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{c.phone}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{c.companyName ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                    {c._count?.managedDrivers ?? 0}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {c.fleetMaxSize}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>
                      {status.text}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={tdStyle} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {c.chefDeFlotteStatus !== 'ACTIVE' && (
                        <button onClick={() => approveChef(c)} disabled={acting === c.id} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }} title="Activer">
                          <CheckCircle size={13} />
                        </button>
                      )}
                      <button onClick={() => setFormTarget(c)} style={btnSmall} title="Modifier"><Pencil size={13} /></button>
                      <button onClick={() => deleteChef(c)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Supprimer"><Trash2 size={13} /></button>
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

      {formTarget !== null && (
        <ChefFormModal
          initial={formTarget.id ? formTarget : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); fetch() }}
        />
      )}
    </div>
  )
}

const overlay      = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const card         = { ...glass, padding: '20px 24px' }
const tableStyle   = { width: '100%', minWidth: 760, borderCollapse: 'collapse' }
const thStyle      = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle      = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle   = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle   = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle   = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall     = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnIcon      = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
