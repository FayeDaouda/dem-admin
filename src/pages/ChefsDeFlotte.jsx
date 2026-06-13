import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw, Eye, Plus, Pencil, Trash2, X, Search, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'
import SuspendModal from '../components/SuspendModal'

const DOC_LIST = [
  { key: 'idCardFront',    label: 'CNI recto' },
  { key: 'idCardBack',     label: 'CNI verso' },
  { key: 'licenseFront',   label: 'Permis recto' },
  { key: 'licenseBack',    label: 'Permis verso' },
  { key: 'vehiclePhoto',   label: 'Photo véhicule' },
  { key: 'carteGrise',     label: 'Carte grise recto' },
  { key: 'carteGriseBack', label: 'Carte grise verso' },
  { key: 'assurance',      label: 'Assurance' },
  { key: 'casquePhoto',    label: 'Casque' },
]

// ── Vignette document (zoomable) ───────────────────────────────────────────────
function DocThumb({ url, label }) {
  const [zoomed, setZoomed] = useState(false)
  if (!url) return (
    <div style={{ width: 70, height: 56, borderRadius: 8, background: 'rgba(0,119,182,.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <span style={{ fontSize: 16 }}>📄</span>
      <span style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', padding: '0 4px' }}>{label}</span>
    </div>
  )
  return (
    <>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setZoomed(true)} title={label}>
        <img src={url} alt={label} style={{ width: 70, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,119,182,.15)', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.45)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, padding: '2px 4px', textAlign: 'center' }}>
          <span style={{ fontSize: 8, color: '#fff' }}>{label}</span>
        </div>
      </div>
      {zoomed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setZoomed(false)}>
          <img src={url} alt={label} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12 }} />
        </div>
      )}
    </>
  )
}

// ── Statut d'un livreur géré ─────────────────────────────────────────────────
function driverStatusInfo(d) {
  if (d.chefDeFlotteStatus === 'PENDING')  return { text: '⏳ En attente', color: '#f59e0b' }
  if (d.chefDeFlotteStatus === 'REJECTED') return { text: '✗ Refusé',     color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE' && !d.isActive) return { text: '⚠ Suspendu', color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE')   return { text: '✓ Actif',       color: '#22c55e' }
  return { text: d.chefDeFlotteStatus ?? '—', color: '#888' }
}

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
  const [expandedDriver, setExpandedDriver] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [rejectDriver, setRejectDriver] = useState(null)
  const [rejecting, setRejecting] = useState(false)

  const refetch = useCallback(() => {
    return api.get(`/admin/chefs-de-flotte/${chef.id}`)
      .then(r => setDetail(r.data))
      .catch(() => {})
  }, [chef.id])

  useEffect(() => {
    refetch().finally(() => setLoading(false))
  }, [refetch])

  const d = detail ?? chef

  async function validateDriver(driver, approve) {
    setActingId(driver.id)
    try {
      await api.patch(`/admin/drivers/${driver.id}/validate`, { approve })
      await refetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActingId(null)
    }
  }

  async function handleRejectConfirm(reason, fix) {
    if (!rejectDriver) return
    setRejecting(true)
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    try {
      await api.patch(`/admin/drivers/${rejectDriver.id}/validate`, { approve: false, reason: fullReason })
      setRejectDriver(null)
      await refetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <>
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 560, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header gradient */}
        <div style={{ background: 'linear-gradient(135deg,#0CB8DE,#0671BA,#04317C)', padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={14} />
          </button>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.5)', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff' }}>
            {d.avatar ? <img src={d.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (d.name?.trim() || d.phone || '?')[0].toUpperCase()}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{d.name?.trim() || d.phone}</div>
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
                    ['RCCM',          d.rccm ?? '—'],
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
                {d.chefDeFlotteStatus === 'REJECTED' && d.rejectionReason && (
                  <div style={{ ...errorStyle, marginTop: 10 }}>Motif de refus : {d.rejectionReason}</div>
                )}
                {!d.isActive && d.suspensionReason && (
                  <div style={{ ...errorStyle, marginTop: 10 }}>Motif de suspension : {d.suspensionReason}</div>
                )}
              </div>

              <div style={{ ...infoBox, marginTop: 14 }}>
                <div style={sectionLabel}>Livreurs ajoutés ({detail?.managedDrivers?.length ?? 0})</div>
                {!detail?.managedDrivers?.length ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun livreur ajouté pour le moment.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detail.managedDrivers.map(dr => {
                      const status = driverStatusInfo(dr)
                      const scores = dr.ratingsReceived?.map(r => r.score) ?? []
                      const avgRating = scores.length > 0 ? Math.round((scores.reduce((s, r) => s + r, 0) / scores.length) * 10) / 10 : null
                      const expanded = expandedDriver === dr.id
                      return (
                        <div key={dr.id} style={{ border: '1px solid rgba(0,119,182,.12)', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: status.color }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{dr.name?.trim() || '—'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                {dr.phone} · {dr.vehicleType}{dr.vehiclePlate ? ` · ${dr.vehiclePlate}` : ''} · {dr._count?.ordersAsDriver ?? 0} courses{avgRating != null ? ` · ★ ${avgRating}` : ''}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: status.color, whiteSpace: 'nowrap' }}>{status.text}</span>
                            {dr.chefDeFlotteStatus === 'PENDING' && (
                              <>
                                <button onClick={() => validateDriver(dr, true)} disabled={actingId === dr.id} style={{ ...btnIcon, color: 'var(--success)' }} title="Valider">
                                  <CheckCircle size={15} />
                                </button>
                                <button onClick={() => setRejectDriver(dr)} disabled={actingId === dr.id} style={{ ...btnIcon, color: 'var(--danger)' }} title="Refuser">
                                  <XCircle size={15} />
                                </button>
                              </>
                            )}
                            <button onClick={() => setExpandedDriver(expanded ? null : dr.id)} style={btnIcon} title="Documents">
                              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </div>

                          {expanded && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,119,182,.08)' }}>
                              {dr.chefDeFlotteStatus === 'REJECTED' && dr.rejectionReason && (
                                <div style={{ ...errorStyle, marginBottom: 10 }}>Motif de refus : {dr.rejectionReason}</div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {DOC_LIST.map(({ key, label }) => (
                                  <DocThumb key={key} url={dr[key]} label={label} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    {rejectDriver && (
      <SuspendModal
        target="driver"
        title="Motif de refus"
        confirmLabel="Confirmer le refus"
        loadingLabel="Refus…"
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectDriver(null)}
        loading={rejecting}
      />
    )}
    </>
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
    .filter(c => statusFilter === 'all' || c.chefDeFlotteStatus === statusFilter)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Chefs de flotte</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetch} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          <button onClick={() => setFormTarget({})} style={btnPrimary}><Plus size={14} /> Nouveau</button>
        </div>
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {[['all', 'Tous'], ['PENDING', '⏳ En attente'], ['APPROVED', '✓ Approuvés'], ['SUSPENDED', '⚠ Suspendus']].map(([key, label]) => (
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
                {['Chef de flotte', 'Téléphone', 'Société', 'Flotte', 'Statut', 'Inscription', 'Actions'].map(h => (
                  <th
                    key={h}
                    style={{ ...thStyle, ...stickyTh, ...(h === 'Inscription' ? { cursor: 'pointer', userSelect: 'none' } : {}) }}
                    onClick={h === 'Inscription' ? () => setSortDate(s => s === 'desc' ? 'asc' : s === 'asc' ? null : 'desc') : undefined}
                    title={h === 'Inscription' ? 'Trier par date d\'inscription' : undefined}
                  >
                    {h}{h === 'Inscription' && (sortDate === 'desc' ? ' ▼' : sortDate === 'asc' ? ' ▲' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(c.chefDeFlotteStatus) }}>
                      {statusLabel(c.chefDeFlotteStatus)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {c.chefDeFlotteStatus === 'PENDING' && (
                        <button onClick={() => approveChef(c)} disabled={acting === c.id} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }} title="Approuver">
                          <CheckCircle size={13} />
                        </button>
                      )}
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
const card         = { ...glass, padding: '20px 24px' }
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
