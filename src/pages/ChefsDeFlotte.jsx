import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw, Eye, Plus, Pencil, Trash2, X } from 'lucide-react'
import { glass } from '../lib/glassStyles'

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

// ── Modal Détail ──────────────────────────────────────────────────────────────
function ChefDetailModal({ chef, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/admin/chefs-de-flotte/${chef.id}`)
      .then(r => { setDetail(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [chef.id])

  const d = detail ?? chef

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 500, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header gradient */}
        <div style={{ background: 'linear-gradient(135deg,#0CB8DE,#0671BA,#04317C)', padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={14} />
          </button>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff' }}>
            {d.avatar ? <img src={d.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (d.name ?? '?')[0].toUpperCase()}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{d.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{d.phone}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: statusBg(d.chefDeFlotteStatus), color: statusColor(d.chefDeFlotteStatus) }}>
              {statusLabel(d.chefDeFlotteStatus)}
            </span>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: 20 }}>
          {loading ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Chargement…</div> : (
            <>
              <div style={infoBox}>
                <div style={sectionLabel}>Informations</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  {[
                    ['Société',       d.companyName ?? '—'],
                    ['NINEA',         d.ninea ?? '—'],
                    ['Flotte max.',   d.fleetMaxSize ?? '—'],
                    ['Livreurs',      d._count?.managedDrivers ?? 0],
                    ['Inscrit le',    d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '—'],
                    ['Actif',         d.isActive ? '✓ Oui' : 'Non'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {detail?.managedDrivers?.length > 0 && (
                <div style={{ ...infoBox, marginTop: 14 }}>
                  <div style={sectionLabel}>Livreurs gérés ({detail.managedDrivers.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.managedDrivers.slice(0, 8).map(dr => (
                      <div key={dr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dr.isActive ? '#22c55e' : '#f59e0b' }} />
                        <span style={{ flex: 1, fontWeight: 600 }}>{dr.name ?? '—'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{dr.phone}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{dr.vehicleType}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers statut ────────────────────────────────────────────────────────────
function statusLabel(s) {
  return { PENDING: '⏳ En attente', APPROVED: '✓ Approuvé', REJECTED: '✗ Refusé', SUSPENDED: '⚠ Suspendu' }[s] ?? s ?? '—'
}
function statusColor(s) {
  return { PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444', SUSPENDED: '#ef4444' }[s] ?? '#888'
}
function statusBg(s) {
  return { PENDING: 'rgba(245,158,11,.2)', APPROVED: 'rgba(34,197,94,.2)', REJECTED: 'rgba(239,68,68,.2)', SUSPENDED: 'rgba(239,68,68,.2)' }[s] ?? 'rgba(0,0,0,.1)'
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ChefsDeFlotte() {
  const [chefs, setChefs]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [formTarget, setFormTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filtered = chefs.filter(c => statusFilter === 'all' || c.chefDeFlotteStatus === statusFilter)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Chefs de flotte</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetch} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          <button onClick={() => setFormTarget({})} style={btnPrimary}><Plus size={14} /> Nouveau</button>
        </div>
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'Tous'], ['PENDING', '⏳ En attente'], ['APPROVED', '✓ Approuvés'], ['SUSPENDED', '⚠ Suspendus']].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} style={{
            padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: statusFilter === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: statusFilter === key ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun chef de flotte.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Chef de flotte', 'Téléphone', 'Société', 'Flotte', 'Statut', 'Inscription', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 13, flexShrink: 0 }}>
                        {c.avatar ? <img src={c.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} /> : (c.name ?? '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.name ?? '—'}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{c.phone}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{c.companyName ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                    {c._count?.managedDrivers ?? 0}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {c.fleetMaxSize}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(c.chefDeFlotteStatus) }}>
                      {statusLabel(c.chefDeFlotteStatus)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => setSelected(c)} style={btnSmall} title="Voir détail"><Eye size={13} /></button>
                      <button onClick={() => setFormTarget(c)} style={btnSmall} title="Modifier"><Pencil size={13} /></button>
                      <button onClick={() => deleteChef(c)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Supprimer"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <ChefDetailModal chef={selected} onClose={() => setSelected(null)} />}

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
const infoBox      = { background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }
const sectionLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }
const card         = { ...glass, padding: '20px 24px', overflowX: 'auto' }
const tableStyle   = { width: '100%', borderCollapse: 'collapse' }
const thStyle      = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle      = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle   = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle   = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle   = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall     = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnIcon      = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
