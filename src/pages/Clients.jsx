import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw, Eye, X, Plus, Pencil, Trash2, Search, Phone, CheckCircle, XCircle, Briefcase } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

// ── Modal Créer / Modifier ────────────────────────────────────────────────────
function ClientFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name:  initial?.name  ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.phone.trim()) { setError('Le numéro est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await api.patch(`/admin/clients/${initial.id}`, form)
      } else {
        await api.post('/admin/clients', form)
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 420, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Modifier le client' : 'Créer un client'}</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        {[
          { key: 'name',  label: 'Nom complet',         type: 'text',  placeholder: 'Ex : Amadou Diallo' },
          { key: 'phone', label: 'Téléphone *',          type: 'tel',   placeholder: '+221 77 000 00 00' },
          { key: 'email', label: 'Email (optionnel)',     type: 'email', placeholder: 'email@example.com' },
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
function ClientDetailModal({ client, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/admin/clients/${client.id}`)
      .then(r => { setDetail(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [client.id])

  const d = detail ?? client

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 460, maxWidth: '92vw', padding: '0', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg,#0CB8DE,#0671BA,#04317C)', padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={14} />
          </button>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid rgba(255,255,255,.5)', overflow: 'hidden', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {d.avatar
              ? <img src={d.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{(d.name ?? d.phone ?? '?')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{d.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{d.phone}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {d.isBanned && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(239,68,68,.25)', color: '#fca5a5' }}>Banni</span>}
            {!d.isBanned && d.isActive && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(34,197,94,.20)', color: '#86efac' }}>Actif</span>}
            {!d.isBanned && !d.isActive && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(245,158,11,.20)', color: '#fcd34d' }}>Inactif</span>}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Chargement…</div>
          ) : (<>
            <div style={infoBox}>
              <div style={sectionLabel}>Informations</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {[
                  ['Email',        d.email ?? '—'],
                  ['Inscrit le',   d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '—'],
                  ['Vérifié',      d.isVerified ? '✓ Oui' : 'Non'],
                  ['Code parrain', d.referralCode ?? '—'],
                  ['Adresses fav.', `${d._count?.favoriteAddresses ?? 0} / 6`],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            {detail?.ordersAsClient?.length > 0 && (
              <div style={{ ...infoBox, marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={sectionLabel}>Commandes récentes</div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Total dépensé : <strong>{(detail.totalSpent ?? 0).toLocaleString()} F</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.ordersAsClient.slice(0, 5).map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: o.status === 'DELIVERED' ? '#22c55e' : o.status === 'CANCELLED' ? '#ef4444' : '#f59e0b' }} />
                      <span style={{ flex: 1, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.deliveryAddress ?? o.pickupAddress ?? '—'}
                      </span>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{(o.price ?? 0).toLocaleString()} F</span>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
const LIMIT = 50

export default function Clients() {
  const [clients, setClients]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [formTarget, setFormTarget] = useState(null) // null=fermé, {}=créer, {id,...}=modifier
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [period, setPeriod]         = useState('')
  const [hasOrders, setHasOrders]   = useState('')
  const [sortByCourses, setSortByCourses] = useState(false)
  const [page, setPage]             = useState(1)
  const [phoneReqs, setPhoneReqs]   = useState([])
  const [phoneLoading, setPhoneLoading] = useState(true)
  const [resolving, setResolving]   = useState(null)

  const fetchPhoneRequests = useCallback(async () => {
    setPhoneLoading(true)
    try {
      const res = await api.get('/admin/clients/phone-requests')
      setPhoneReqs(res.data?.requests ?? [])
    } catch (e) { console.error(e) }
    finally { setPhoneLoading(false) }
  }, [])

  async function resolvePhoneChange(clientId, approve) {
    setResolving(clientId)
    try {
      await api.patch(`/admin/clients/${clientId}/phone-change`, { approve })
      await fetchPhoneRequests()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur')
    } finally { setResolving(null) }
  }

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT }
      if (search.trim()) params.search = search.trim()
      if (status)        params.status = status
      if (period)        params.period = period
      if (hasOrders)     params.hasOrders = hasOrders
      if (sortByCourses) params.sortBy = 'courses'
      const res = await api.get('/admin/clients', { params })
      setClients(Array.isArray(res.data?.clients) ? res.data.clients : (Array.isArray(res.data) ? res.data : []))
      setTotal(res.data?.total ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, period, hasOrders, sortByCourses])

  useEffect(() => { fetch(); fetchPhoneRequests() }, [fetch, fetchPhoneRequests])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const hasFilters = !!(search || status || period || hasOrders)

  function updateFilter(setter) {
    return (v) => { setter(v); setPage(1) }
  }

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

  async function deleteClient(client) {
    if (!confirm(`Supprimer définitivement ${client.name ?? client.phone} ? Cette action est irréversible.`)) return
    try {
      await api.delete(`/admin/clients/${client.id}`)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function upgradeToPro(client) {
    const businessName = prompt(`Nom de l'entreprise pour ${client.name ?? client.phone} :`)
    if (!businessName || !businessName.trim()) return
    try {
      await api.patch(`/admin/clients/${client.id}`, {
        role: 'DEM_PRO',
        proStatus: 'ACTIVE',
        proBusinessName: businessName.trim(),
      })
      alert(`${client.name ?? client.phone} est maintenant DEM Pro.`)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de la conversion.')
    }
  }

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Clients</h1>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
            {total.toLocaleString()} client{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetch} style={btnOutline}>
            <RefreshCw size={14} /> Actualiser
          </button>
          <button onClick={() => setFormTarget({})} style={btnPrimary}>
            <Plus size={14} /> Nouveau client
          </button>
        </div>
      </div>

      {/* ── Demandes changement de numéro ── */}
      {(phoneLoading || phoneReqs.length > 0) && (
        <div style={{ marginBottom: 24, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Phone size={16} color="var(--warning)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              Demandes de changement de numero
            </h2>
            {!phoneLoading && (
              <span style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {phoneReqs.length}
              </span>
            )}
          </div>
          <div style={card}>
            {phoneLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement...</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Client', 'Numero actuel', '', 'Nouveau numero', 'Date', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phoneReqs.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.name ?? '—'}</span></td>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.phone}</span></td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 18, textAlign: 'center' }}>→</td>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{r.pendingPhone ?? '—'}</span></td>
                      <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>
                        {r.phoneChangeRequestedAt ? new Date(r.phoneChangeRequestedAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={tdStyle}>
                        {resolving === r.id ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>En cours...</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => resolvePhoneChange(r.id, true)} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}>
                              <CheckCircle size={13} /> Approuver
                            </button>
                            <button onClick={() => resolvePhoneChange(r.id, false)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                              <XCircle size={13} /> Refuser
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Recherche & filtres ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => updateFilter(setSearch)(e.target.value)}
            placeholder="Nom ou téléphone…"
            style={{ ...glassInput, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <select value={status} onChange={e => updateFilter(setStatus)(e.target.value)} style={{ ...glassInput, width: 150 }}>
          <option value="">Statut : Tous</option>
          <option value="active">✓ Actif</option>
          <option value="inactive">Inactif</option>
          <option value="banned">🚫 Banni</option>
        </select>
        <select value={period} onChange={e => updateFilter(setPeriod)(e.target.value)} style={{ ...glassInput, width: 180 }}>
          <option value="">Inscription : Toujours</option>
          <option value="today">Aujourd'hui</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
        </select>
        <select value={hasOrders} onChange={e => updateFilter(setHasOrders)(e.target.value)} style={{ ...glassInput, width: 170 }}>
          <option value="">Courses : Tous</option>
          <option value="some">Avec courses</option>
          <option value="none">Sans course</option>
        </select>
      </div>

      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun client{hasFilters ? ' pour ce filtre' : ''}.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['#', 'Client', 'Téléphone', 'Courses', 'Inscription', 'Statut', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...thStyle, ...(i === 0 ? stickyThCol : stickyTh),
                      ...(h === 'Courses' ? { cursor: 'pointer', userSelect: 'none' } : {}),
                    }}
                    onClick={h === 'Courses' ? () => updateFilter(setSortByCourses)(s => !s) : undefined}
                    title={h === 'Courses' ? 'Trier par nombre de courses' : undefined}
                  >
                    {h}{h === 'Courses' && (sortByCourses ? ' ▼' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{(page - 1) * LIMIT + idx + 1}</td>
                  <td style={{ ...tdStyle, ...stickyCol }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,rgba(12,184,222,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {c.avatar
                          ? <img src={c.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontWeight: 700, color: '#0671BA', fontSize: 13 }}>{(c.name ?? c.phone ?? '?')[0].toUpperCase()}</span>
                        }
                      </div>
                      <span style={{ fontWeight: 600 }}>{c.name ?? '—'}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{c.phone}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{c._count?.ordersAsClient ?? 0}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={tdStyle}>
                    {c.isBanned
                      ? <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>🚫 Banni</span>
                      : c.isActive
                        ? <span style={{ color: 'var(--success)', fontSize: 12 }}>✓ Actif</span>
                        : <span style={{ color: 'var(--warning)', fontSize: 12 }}>Inactif</span>}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button onClick={() => setSelected(c)} style={btnSmall} title="Voir détail">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => setFormTarget(c)} style={btnSmall} title="Modifier">
                        <Pencil size={13} />
                      </button>
                      {c.role === 'CLIENT' && (
                        <button
                          onClick={() => upgradeToPro(c)}
                          style={{ ...btnSmall, color: '#7c3aed', borderColor: '#7c3aed' }}
                          title="Convertir en DEM Pro"
                        >
                          <Briefcase size={13} /> Pro
                        </button>
                      )}
                      <button
                        onClick={() => toggleBan(c)}
                        style={{ ...btnSmall, color: c.isBanned ? 'var(--success)' : 'var(--warning)', borderColor: c.isBanned ? 'var(--success)' : 'var(--warning)' }}
                      >
                        {c.isBanned ? 'Débannir' : 'Bannir'}
                      </button>
                      <button
                        onClick={() => deleteClient(c)}
                        style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 8px' }}>
            Page {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      )}
      </div>

      {selected && <ClientDetailModal client={selected} onClose={() => setSelected(null)} />}

      {formTarget !== null && (
        <ClientFormModal
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
const tableStyle   = { width: '100%', minWidth: 680, borderCollapse: 'collapse' }
const thStyle      = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle      = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle   = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle   = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle   = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall     = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnIcon      = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
