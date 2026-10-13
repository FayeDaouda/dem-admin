import { Fragment, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, UserPlus, Trash2, Power, XCircle, Pencil, Search, KeyRound, Check } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'
import { PASSWORD_PATTERN, PASSWORD_HINT } from '../lib/passwordPolicy'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import PageHeader from '../components/PageHeader'
import InlineConfirm from '../components/InlineConfirm'
import TempPassword from '../components/TempPassword'
import InfoTip from '../components/InfoTip'

const ROLE_COLORS = {
  SUPER: '#f59e0b', DEV: '#6366f1', FINANCE: '#22c55e', MARKETING: '#ec4899', SERVICE_CLIENT: '#06b6d4', ASSISTANCE_EXECUTIVE: '#a855f7',
}
const ROLE_LABELS = {
  SUPER: 'Super Admin', DEV: 'Dev', FINANCE: 'Finance', MARKETING: 'Marketing', SERVICE_CLIENT: 'Service Client', ASSISTANCE_EXECUTIVE: 'Assistance exécutive',
}
const EMPTY_CREATE = { name: '', email: '', phone: '', password: '', adminRole: 'SERVICE_CLIENT' }

export default function Equipes() {
  const { user: currentUser } = useAuth()
  const isSuper = !currentUser?.adminRole || currentUser.adminRole === 'SUPER'

  const [admins, setAdmins]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [roleFilter, setRoleFilter]       = useState('all')

  // Formulaire de création
  const [showCreate, setShowCreate]       = useState(false)
  const [createForm, setCreateForm]       = useState(EMPTY_CREATE)
  const [createError, setCreateError]     = useState('')
  const [createSaving, setCreateSaving]   = useState(false)

  // Fenêtre de modification
  const [editTarget, setEditTarget]       = useState(null)
  const [editForm, setEditForm]           = useState({ name: '', email: '', phone: '', adminRole: '', resetPassword: '' })
  const [editError, setEditError]         = useState('')
  const [editSaving, setEditSaving]       = useState(false)

  // Demandes de réinitialisation de mot de passe (Super Admin)
  const [resetRequests, setResetRequests] = useState([])

  // Action confirmée dans la ligne : { id, kind: 'password'|'disable'|'delete'|'approve' }
  const [confirm, setConfirm]   = useState(null)
  const [busy, setBusy]         = useState(false)
  const [rowError, setRowError] = useState(null) // { id, message }
  const [notice, setNotice]     = useState('')
  const [tempPassword, setTempPassword] = useState(null) // { who, password, note? }

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/admins')
      setAdmins(res.data?.admins ?? [])
      if (isSuper) {
        const rr = await api.get('/admin/password-resets')
        setResetRequests(rr.data?.requests ?? [])
      }
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [isSuper])

  useEffect(() => { fetch() }, [fetch])
  useAutoRefresh(() => fetch(true))

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const whoOf = a => a?.name ?? a?.email ?? a?.phone ?? 'ce compte'

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
      setCreateForm(EMPTY_CREATE)
      setNotice(`Compte de ${payload.name} créé.`)
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
      setNotice(`Compte de ${whoOf(editTarget)} mis à jour.`)
      setEditTarget(null)
      fetch()
    } catch (e) {
      setEditError(e.response?.data?.message ?? 'Erreur.')
    } finally { setEditSaving(false) }
  }

  function ask(id, kind) {
    setConfirm(c => (c?.id === id && c.kind === kind ? null : { id, kind }))
    setRowError(null)
  }

  // Lance l'action confirmée ; les erreurs restent dans la ligne.
  async function run(id, request) {
    setBusy(true); setRowError(null)
    try {
      await request()
      setConfirm(null)
      fetch()
    } catch (e) {
      setRowError({ id, message: e.response?.data?.message ?? 'Erreur.' })
    } finally { setBusy(false) }
  }

  // Activer : immédiat ; désactiver : confirmé dans la ligne.
  function toggle(admin) {
    return run(admin.id, async () => {
      await api.patch(`/admin/admins/${admin.id}/toggle`)
      setNotice(`${whoOf(admin)} ${admin.isActive ? 'désactivé' : 'activé'}.`)
    })
  }

  function resetPassword(admin) {
    return run(admin.id, async () => {
      const res = await api.patch(`/admin/admins/${admin.id}/reset-default-password`)
      setTempPassword({ who: whoOf(admin), password: res.data?.temporaryPassword ?? res.data?.defaultPassword })
    })
  }

  function remove(admin) {
    return run(admin.id, async () => {
      await api.delete(`/admin/admins/${admin.id}`)
      setNotice(`Compte de ${whoOf(admin)} supprimé.`)
    })
  }

  function approveReset(req) {
    return run(req.id, async () => {
      const res = await api.patch(`/admin/password-resets/${req.id}/approve`)
      setTempPassword({ who: whoOf(req.targetUser), password: res.data?.temporaryPassword ?? res.data?.defaultPassword, note: res.data?.message ? `${res.data.message} Il ne sera plus affiché : notez-le avant de fermer.` : undefined })
    })
  }

  function rejectReset(req) {
    return run(req.id, async () => {
      await api.patch(`/admin/password-resets/${req.id}/reject`)
      setNotice('Demande refusée.')
    })
  }

  // ── Filtrage ──
  const HIDDEN_EMAILS = ['daoudafaye2017@gmail.com']
  const visibleAdmins = admins.filter(a => !HIDDEN_EMAILS.includes(a.email?.toLowerCase()))

  const filtered = visibleAdmins
    .filter(a => roleFilter === 'all' || a.adminRole === roleFilter)
    .filter(a => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (a.name ?? '').toLowerCase().includes(q)
        || (a.email ?? '').toLowerCase().includes(q)
        || (a.phone ?? '').includes(q)
    })

  const countByRole = {}
  for (const a of visibleAdmins) countByRole[a.adminRole] = (countByRole[a.adminRole] ?? 0) + 1

  const confirmTexts = {
    password: a => ({ lines: [`Réinitialiser le mot de passe de ${whoOf(a)} ?`, 'Un mot de passe provisoire sera généré ; il devra le changer à sa première connexion.'], label: 'Générer', danger: false, go: () => resetPassword(a) }),
    disable:  a => ({ lines: [`Désactiver le compte de ${whoOf(a)} ?`, 'Il ne pourra plus se connecter à l’admin tant qu’il n’est pas réactivé.'], label: 'Désactiver', danger: true, go: () => toggle(a) }),
    delete:   a => ({ lines: [`Supprimer définitivement le compte de ${whoOf(a)} ?`], label: 'Supprimer', danger: true, go: () => remove(a) }),
  }

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Équipes"
        subtitle={`${visibleAdmins.length} compte${visibleAdmins.length > 1 ? 's' : ''} administrateur${visibleAdmins.length > 1 ? 's' : ''}`}
        actions={<>
          <button onClick={() => fetch()} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          {isSuper && (
            <button onClick={() => setShowCreate(v => !v)} style={showCreate ? btnOutline : btnPrimary}>
              {showCreate ? <><XCircle size={14} /> Annuler</> : <><UserPlus size={14} /> Nouveau compte</>}
            </button>
          )}
        </>}
      />

      {/* Demandes de réinitialisation de mot de passe (Super Admin) */}
      {isSuper && resetRequests.length > 0 && (
        <div style={{ ...glass, padding: '14px 18px', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <KeyRound size={15} color="#f59e0b" />
            <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>
              Demandes de réinitialisation de mot de passe ({resetRequests.length})
              <InfoTip k="Demandes de réinitialisation de mot de passe" size={13} />
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resetRequests.map(req => (
              <div key={req.id} style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{req.targetUser?.name ?? '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {req.targetUser?.email ?? req.targetUser?.phone} · demande du {new Date(req.createdAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={busy} onClick={() => ask(req.id, 'approve')} style={actionBtn('#16a34a')}>
                      <Check size={12} /> Réinitialiser (mot de passe provisoire)
                    </button>
                    <button disabled={busy} onClick={() => rejectReset(req)} style={actionBtn('#ef4444')}>
                      <XCircle size={12} /> Refuser
                    </button>
                  </div>
                </div>
                {confirm?.id === req.id && confirm.kind === 'approve' && (
                  <InlineConfirm
                    lines={[`Réinitialiser le mot de passe de ${whoOf(req.targetUser)} ?`, 'Un mot de passe provisoire sera généré ; il devra le changer à sa première connexion.']}
                    confirmLabel="Générer" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => approveReset(req)}
                  />
                )}
                {rowError?.id === req.id && <div style={errorLine}>{rowError.message}</div>}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '10px 0 0' }}>
            La réinitialisation génère un mot de passe provisoire aléatoire, affiché une seule fois. L'utilisateur devra choisir un nouveau mot de passe à sa première connexion.
          </p>
        </div>
      )}

      {tempPassword && (
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <TempPassword who={tempPassword.who} password={tempPassword.password} note={tempPassword.note} onClose={() => setTempPassword(null)} />
        </div>
      )}
      {notice && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 14, flexShrink: 0 }}>{notice}</div>
      )}

      {/* Formulaire de création */}
      {showCreate && (
        <div style={{ ...glass, padding: '20px 24px', marginBottom: 14, flexShrink: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Créer un compte administrateur</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nom complet *</label>
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Awa Diallo" required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Rôle *</label>
              <select value={createForm.adminRole} onChange={e => setCreateForm(f => ({ ...f, adminRole: e.target.value }))} style={inputStyle}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input type="tel" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+221 7X XXX XX XX" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="nom@dem.sn" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe provisoire *</label>
              <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Dem@2026!" required pattern={PASSWORD_PATTERN.source} title={PASSWORD_HINT} style={inputStyle} />
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                {PASSWORD_HINT} L'utilisateur devra le changer à sa première connexion.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" disabled={createSaving} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
                {createSaving ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
            {createError && (
              <div style={{ gridColumn: '1 / -1', ...errorLine, marginTop: 0 }}>{createError}</div>
            )}
          </form>
        </div>
      )}

      {/* Recherche + rôles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, email ou téléphone…" style={{ ...glassInput, paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {[['all', 'Tous', visibleAdmins.length], ...Object.entries(ROLE_LABELS).map(([k, l]) => [k, l, countByRole[k] ?? 0])].map(([key, label, n]) => {
            const active = roleFilter === key
            return (
              <button key={key} onClick={() => setRoleFilter(key)} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: active ? (key === 'all' ? 'var(--primary)' : ROLE_COLORS[key]) : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
              }}>
                {label}<span style={{ marginLeft: 5, opacity: 0.8 }}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tableau */}
      <div style={pageScroll}>
        <div style={{ ...glass, padding: '12px 16px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun compte trouvé.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Nom', 'Contact', 'Rôle', 'Statut', 'Créé le', 'Actions'].map(h => (
                    <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const isMe = a.id === currentUser?.id
                  const roleColor = ROLE_COLORS[a.adminRole] ?? '#888'
                  const pending = confirm?.id === a.id && confirmTexts[confirm.kind] ? confirmTexts[confirm.kind](a) : null
                  return (
                    <Fragment key={a.id}>
                      <tr style={{ borderBottom: pending || rowError?.id === a.id ? 'none' : '1px solid var(--border)', opacity: a.isActive ? 1 : 0.55 }}>
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
                          <div style={{ fontSize: 12.5 }}>{a.email ?? '—'}</div>
                          {a.phone && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.phone}</div>}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 10, background: roleColor + '18', color: roleColor, whiteSpace: 'nowrap' }}>
                            {ROLE_LABELS[a.adminRole] ?? a.adminRole}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: a.isActive ? '#16a34a' : '#ef4444' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.isActive ? '#22c55e' : '#ef4444' }} />
                            {a.isActive ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={tdStyle}>
                          {isSuper && !isMe ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button onClick={() => openEdit(a)} style={actionBtn('#0077b6')}><Pencil size={12} /> Modifier</button>
                              <button onClick={() => ask(a.id, 'password')} title="Réinitialiser avec un mot de passe provisoire (compte oublié)" style={actionBtn('#d97706')}>
                                <KeyRound size={12} /> Mot de passe provisoire
                              </button>
                              <button onClick={() => (a.isActive ? ask(a.id, 'disable') : toggle(a))} disabled={busy} style={actionBtn(a.isActive ? '#d97706' : '#16a34a')}>
                                <Power size={12} /> {a.isActive ? 'Désactiver' : 'Activer'}
                              </button>
                              <button onClick={() => ask(a.id, 'delete')} title="Supprimer" style={actionBtn('#ef4444')}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                          )}
                        </td>
                      </tr>
                      {(pending || rowError?.id === a.id) && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={6} style={{ padding: '0 10px 10px' }}>
                            {pending && (
                              <InlineConfirm lines={pending.lines} confirmLabel={pending.label} danger={pending.danger} busy={busy}
                                onCancel={() => setConfirm(null)} onConfirm={pending.go} />
                            )}
                            {rowError?.id === a.id && <div style={errorLine}>{rowError.message}</div>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Fenêtre de modification */}
      {editTarget && (
        <div style={overlay} onClick={() => setEditTarget(null)}>
          <div style={{ ...glass, background: 'rgba(255,255,255,0.97)', padding: '28px 32px', width: 460, maxWidth: '94vw', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
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
                <label style={labelStyle}>Téléphone</label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Rôle</label>
                <select value={editForm.adminRole} onChange={e => setEditForm(f => ({ ...f, adminRole: e.target.value }))} style={inputStyle}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <label style={labelStyle}>Réinitialiser le mot de passe (facultatif)</label>
                <input type="text" value={editForm.resetPassword} onChange={e => setEditForm(f => ({ ...f, resetPassword: e.target.value }))} placeholder="Laisser vide pour ne pas changer" pattern={PASSWORD_PATTERN.source} title={PASSWORD_HINT} style={inputStyle} />
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  {PASSWORD_HINT} L'utilisateur devra le changer à sa prochaine connexion.
                </div>
              </div>
              {editError && <div style={{ ...errorLine, marginTop: 0 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setEditTarget(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={editSaving} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {editSaving ? 'Mise à jour…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const tableStyle = { width: '100%', minWidth: 760, borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const inputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13 }
const errorLine  = { fontSize: 12, color: '#ef4444', background: '#ef444410', padding: '8px 12px', borderRadius: 6, marginTop: 8 }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const actionBtn  = (color) => ({ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}`, background: 'transparent', color, whiteSpace: 'nowrap' })
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
