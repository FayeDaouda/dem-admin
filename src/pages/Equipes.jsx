import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, UserPlus, Trash2, Power, XCircle, Pencil, Search } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'

const ROLE_COLORS = {
  SUPER: '#f59e0b', DEV: '#6366f1', FINANCE: '#22c55e', MARKETING: '#ec4899', SERVICE_CLIENT: '#06b6d4', ASSISTANCE_EXECUTIVE: '#a855f7',
}
const ROLE_LABELS = {
  SUPER: 'Super Admin', DEV: 'Dev', FINANCE: 'Finance', MARKETING: 'Marketing', SERVICE_CLIENT: 'Service Client', ASSISTANCE_EXECUTIVE: 'Assistance Executive',
}

export default function Equipes() {
  const { user: currentUser } = useAuth()
  // ASSISTANCE_EXECUTIVE : lecture seule sur les comptes admin — pas d'actions
  const isSuper = !currentUser?.adminRole || currentUser.adminRole === 'SUPER'

  const [admins, setAdmins]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [roleFilter, setRoleFilter]       = useState('all')

  // Formulaire creation
  const [showCreate, setShowCreate]       = useState(false)
  const [createForm, setCreateForm]       = useState({ name: '', email: '', phone: '', password: '', adminRole: 'SERVICE_CLIENT' })
  const [createError, setCreateError]     = useState('')
  const [createSaving, setCreateSaving]   = useState(false)

  // Modal edition
  const [editTarget, setEditTarget]       = useState(null)
  const [editForm, setEditForm]           = useState({ name: '', email: '', phone: '', adminRole: '', resetPassword: '' })
  const [editError, setEditError]         = useState('')
  const [editSaving, setEditSaving]       = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/admins')
      setAdmins(res.data?.admins ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // ── Actions ──
  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    setCreateSaving(true)
    try {
      const payload = { ...createForm }
      if (!payload.email) delete payload.email
      if (!payload.phone) delete payload.phone
      await api.post('/admin/auth/create', payload)
      setShowCreate(false)
      setCreateForm({ name: '', email: '', phone: '', password: '', adminRole: 'SERVICE_CLIENT' })
      fetch()
    } catch (e) {
      setCreateError(e.response?.data?.message ?? 'Erreur.')
    } finally { setCreateSaving(false) }
  }

  function openEdit(admin) {
    setEditTarget(admin)
    setEditForm({ name: admin.name ?? '', email: admin.email ?? '', phone: admin.phone ?? '', adminRole: admin.adminRole ?? 'SUPER', resetPassword: '' })
    setEditError('')
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      const payload = { ...editForm }
      if (!payload.resetPassword) delete payload.resetPassword
      await api.patch(`/admin/admins/${editTarget.id}`, payload)
      setEditTarget(null)
      fetch()
    } catch (e) {
      setEditError(e.response?.data?.message ?? 'Erreur.')
    } finally { setEditSaving(false) }
  }

  async function handleToggle(admin) {
    try {
      await api.patch(`/admin/admins/${admin.id}/toggle`)
      fetch()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  async function handleDelete(admin) {
    if (!confirm(`Supprimer definitivement le compte de ${admin.name ?? admin.email ?? admin.phone} ?`)) return
    try {
      await api.delete(`/admin/admins/${admin.id}`)
      fetch()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
  }

  // ── Filtrage ──
  const HIDDEN_EMAILS = ['daoudafaye2017@gmail.com']

  const filtered = admins
    .filter(a => !HIDDEN_EMAILS.includes(a.email?.toLowerCase()))
    .filter(a => roleFilter === 'all' || a.adminRole === roleFilter)
    .filter(a => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (a.name ?? '').toLowerCase().includes(q)
        || (a.email ?? '').toLowerCase().includes(q)
        || (a.phone ?? '').includes(q)
    })

  const countByRole = {}
  for (const a of admins) {
    if (!HIDDEN_EMAILS.includes(a.email?.toLowerCase())) countByRole[a.adminRole] = (countByRole[a.adminRole] ?? 0) + 1
  }

  return (
    <div style={pageWrap}>
      {/* En-tete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Equipes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            {admins.length} compte{admins.length > 1 ? 's' : ''} administrateur{admins.length > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetch} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          {isSuper && (
            <button onClick={() => setShowCreate(v => !v)} style={showCreate ? btnOutline : btnPrimary}>
              {showCreate ? <><XCircle size={14} /> Annuler</> : <><UserPlus size={14} /> Nouveau compte</>}
            </button>
          )}
        </div>
      </div>

      {/* Stats par role */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {Object.entries(ROLE_LABELS).map(([key, label]) => {
          const count = countByRole[key] ?? 0
          const color = ROLE_COLORS[key]
          return (
            <div key={key} style={{
              ...glass, padding: '12px 18px', minWidth: 130,
              borderLeft: `3px solid ${color}`,
              cursor: 'pointer', transition: 'all .15s',
              outline: roleFilter === key ? `2px solid ${color}` : 'none',
            }} onClick={() => setRoleFilter(f => f === key ? 'all' : key)}>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
            </div>
          )
        })}
      </div>

      {/* Formulaire creation */}
      {showCreate && (
        <div style={{ ...glass, padding: '20px 24px', marginBottom: 16, flexShrink: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Creer un compte administrateur</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nom complet *</label>
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Awa Diallo" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Role *</label>
              <select value={createForm.adminRole} onChange={e => setCreateForm(f => ({ ...f, adminRole: e.target.value }))} style={inputStyle}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Telephone</label>
              <input type="tel" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+221 7X XXX XX XX" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="nom@dem.sn" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe par defaut *</label>
              <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="dem12345" required minLength={8} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" disabled={createSaving} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
                {createSaving ? 'Creation...' : 'Creer le compte'}
              </button>
            </div>
            {createError && (
              <div style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: 12, background: '#ef444410', padding: '8px 12px', borderRadius: 6 }}>
                {createError}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Recherche */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexShrink: 0, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, email ou telephone..." style={{ ...glassInput, paddingLeft: 36 }} />
        </div>
        {roleFilter !== 'all' && (
          <button onClick={() => setRoleFilter('all')} style={{ ...btnOutline, fontSize: 12 }}>
            <XCircle size={13} /> Filtre: {ROLE_LABELS[roleFilter]}
          </button>
        )}
      </div>

      {/* Tableau */}
      <div style={pageScroll}>
        <div style={{ ...glass, padding: '20px 24px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun compte trouve.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['#', 'Nom', 'Contact', 'Role', 'Statut', 'Cree le', 'Actions'].map(h => (
                    <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => {
                  const isMe = a.id === currentUser?.id
                  const roleColor = ROLE_COLORS[a.adminRole] ?? '#888'
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', opacity: a.isActive ? 1 : 0.5 }}>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{idx + 1}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${roleColor}44, ${roleColor}22)`,
                            border: `1px solid ${roleColor}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: roleColor, fontWeight: 700, fontSize: 13, flexShrink: 0,
                          }}>
                            {(a.name ?? '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{a.name ?? '—'}</div>
                            {isMe && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>VOUS</span>}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 12 }}>{a.email ?? '—'}</div>
                        {a.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.phone}</div>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 10,
                          background: roleColor + '18', color: roleColor,
                        }}>
                          {ROLE_LABELS[a.adminRole] ?? a.adminRole}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, fontWeight: 600,
                          color: a.isActive ? '#22c55e' : '#ef4444',
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.isActive ? '#22c55e' : '#ef4444' }} />
                          {a.isActive ? 'Actif' : 'Desactive'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={tdStyle}>
                        {isSuper && !isMe ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEdit(a)} title="Modifier" style={actionBtn('#0077b6')}>
                              <Pencil size={12} /> Modifier
                            </button>
                            <button onClick={() => handleToggle(a)} title={a.isActive ? 'Desactiver' : 'Activer'} style={actionBtn(a.isActive ? '#f59e0b' : '#22c55e')}>
                              <Power size={12} /> {a.isActive ? 'Desactiver' : 'Activer'}
                            </button>
                            <button onClick={() => handleDelete(a)} title="Supprimer" style={actionBtn('#ef4444')}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
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

      {/* Modal edition */}
      {editTarget && (
        <div style={overlay} onClick={() => setEditTarget(null)}>
          <div style={{ ...glass, padding: '28px 32px', width: 460, maxWidth: '94vw', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Modifier le compte</h2>
              <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Telephone</label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={editForm.adminRole} onChange={e => setEditForm(f => ({ ...f, adminRole: e.target.value }))} style={inputStyle}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <label style={labelStyle}>Reinitialiser le mot de passe (optionnel)</label>
                <input type="text" value={editForm.resetPassword} onChange={e => setEditForm(f => ({ ...f, resetPassword: e.target.value }))} placeholder="Laisser vide pour ne pas changer" style={inputStyle} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  L'utilisateur devra changer ce mot de passe a sa prochaine connexion.
                </div>
              </div>
              {editError && <div style={{ color: '#ef4444', fontSize: 12, background: '#ef444410', padding: '8px 12px', borderRadius: 6 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setEditTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={editSaving} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {editSaving ? 'Mise a jour...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const inputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13 }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const actionBtn  = (color) => ({ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}`, background: 'transparent', color })
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
