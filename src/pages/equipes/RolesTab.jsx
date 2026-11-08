import { useState } from 'react'
import api from '../../lib/api'
import { Pencil, Trash2, XCircle, Lock, Check, Plus, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { homeRouteForRole } from '../../lib/roleHome'
import { glass, glassInput } from '../../lib/glassStyles'
import { ACCESS, accessLine, pageEntriesFor, pagesFor } from '../../lib/roleAccess'
import { GROUPS } from '../../lib/menu'
import { PAGE_TABS, tabId, tabsFor } from '../../lib/pageTabs'
import InlineConfirm from '../../components/InlineConfirm'

// ── Rôles de l'équipe (onglet Rôles de la page Équipes) ──
// Un rôle = un nom, une couleur et des accès. Chaque accès ouvre les pages du
// menu qui le citent (lib/menu.js) et les actions qui vont avec, comme
// côté serveur (requireAdminRole). Le Super Admin peut ensuite décocher des
// pages pour ce rôle (hiddenPages) : elles disparaissent du menu et ne
// s'ouvrent plus par leur adresse — et, dans une page, des onglets
// (« /marketing#promotions », lib/pageTabs.js). Super Admin : accès total, verrouillé.

const PALETTE = ['#6366f1', '#22c55e', '#ec4899', '#06b6d4', '#a855f7', '#0ea5e9', '#14b8a6', '#84cc16', '#f97316', '#ef4444', '#64748b', '#0f766e']

const EMPTY_FORM = { label: '', color: PALETTE[5], access: [], hiddenPages: [] }
const LABEL_MAX = 60

export default function RolesTab({ roles, countByRole, onChanged, onNotice }) {
  const { startPreview } = useAuth()
  const navigate = useNavigate()

  // « Voir en tant que » : l'admin s'affiche comme pour ce rôle (lecture seule)
  function preview(role) {
    startPreview({ key: role.key, label: role.label, color: role.color, access: role.access, hiddenPages: role.hiddenPages ?? [] })
    navigate(homeRouteForRole(role.key))
  }

  const [editing, setEditing] = useState(null) // null | 'new' | rôle
  const [form, setForm]       = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving]   = useState(false)

  const [deleting, setDeleting]   = useState(null) // clé du rôle
  const [reassignTo, setReassignTo] = useState('')
  const [busy, setBusy]           = useState(false)
  const [rowError, setRowError]   = useState(null) // { key, message }

  function openNew() {
    setEditing('new'); setForm(EMPTY_FORM); setFormError('')
  }
  function openEdit(role) {
    setEditing(role); setForm({ label: role.label, color: role.color, access: role.access, hiddenPages: role.hiddenPages ?? [] }); setFormError('')
  }
  // Nouveau rôle : tant que le nom n'a pas été tapé, il reprend les accès
  // cochés séparés par « / » (« Finance / Marketing »).
  function toggleAccess(key) {
    setForm(f => {
      const access = f.access.includes(key) ? f.access.filter(k => k !== key) : [...f.access, key]
      const auto = accessLine(access)
      const followsAccess = editing === 'new' && (f.label.trim() === '' || f.label === accessLine(f.access))
      return { ...f, access, label: followsAccess && auto.length <= LABEL_MAX ? auto : f.label }
    })
  }
  // Page ou onglet (« /marketing#promotions ») : coché = visible
  function toggleHidden(id) {
    setForm(f => ({ ...f, hiddenPages: f.hiddenPages.includes(id) ? f.hiddenPages.filter(p => p !== id) : [...f.hiddenPages, id] }))
  }
  function setAllPages(on) {
    setForm(f => ({ ...f, hiddenPages: on ? [] : pageEntriesFor(f.access).map(n => n.to) }))
  }

  // Pages qu'ouvrent les accès cochés, celles laissées visibles, et les
  // onglets proposés (au moins deux dans la page pour ces accès)
  const formPages   = pageEntriesFor(form.access)
  const formVisible = formPages.filter(n => !form.hiddenPages.includes(n.to))
  const formTabs    = Object.fromEntries(formPages.map(n => [n.to, tabsFor(n.to, form.access)]))
  // Identifiants gardés à l'enregistrement : pages et onglets encore proposés
  const offeredIds  = new Set(formPages.flatMap(n => [n.to, ...formTabs[n.to].map(x => tabId(n.to, x.key))]))

  async function save(e) {
    e.preventDefault()
    if (form.access.length === 0) { setFormError('Cochez au moins un accès.'); return }
    if (formVisible.length === 0) { setFormError('Laissez au moins une page active.'); return }
    const emptyPage = formVisible.find(n => formTabs[n.to].length > 0 && formTabs[n.to].every(x => form.hiddenPages.includes(tabId(n.to, x.key))))
    if (emptyPage) { setFormError(`${emptyPage.label} : laissez au moins un onglet, ou désactivez la page.`); return }
    // Pages et onglets décochés : seulement parmi ceux qu'ouvrent les accès gardés
    const payload = { ...form, hiddenPages: form.hiddenPages.filter(id => offeredIds.has(id)) }
    setSaving(true); setFormError('')
    try {
      const res = editing === 'new'
        ? await api.post('/admin/roles', payload)
        : await api.patch(`/admin/roles/${editing.key}`, payload)
      onNotice(res.data?.message ?? 'Rôle enregistré.')
      setEditing(null)
      onChanged()
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  function askDelete(role) {
    setDeleting(d => (d === role.key ? null : role.key))
    setReassignTo('')
    setRowError(null)
  }

  async function remove(role) {
    const members = countByRole[role.key] ?? 0
    if (members > 0 && !reassignTo) {
      setRowError({ key: role.key, message: 'Choisissez le rôle que prendront ses membres.' })
      return
    }
    setBusy(true); setRowError(null)
    try {
      const res = await api.delete(`/admin/roles/${role.key}`, { params: members > 0 ? { reassignTo } : {} })
      onNotice(res.data?.message ?? 'Rôle supprimé.')
      setDeleting(null)
      onChanged()
    } catch (err) {
      setRowError({ key: role.key, message: err.response?.data?.message ?? 'Erreur.' })
    } finally { setBusy(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={openNew} style={btnPrimary}><Plus size={14} /> Nouveau rôle</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
        {roles.map(role => {
          const members = countByRole[role.key] ?? 0
          const pages = pagesFor(role.access, role.locked, role.hiddenPages ?? [])
          const hidden = role.locked ? [] : hiddenLabels(role)
          const others = roles.filter(r => r.key !== role.key)
          return (
            <div key={role.key} style={{ ...glass, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{role.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {members} membre{members > 1 ? 's' : ''}
                    {role.locked ? ' · accès total' : role.isSystem ? " · rôle d'origine" : ' · rôle créé'}
                  </div>
                </div>
                {role.locked ? (
                  <span title="Le Super Admin ne se modifie pas" style={{ color: 'var(--text-muted)', display: 'flex' }}><Lock size={14} /></span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => preview(role)} title="Voir l'admin comme ce rôle (lecture seule)" style={actionBtn('#7c3aed')}><Eye size={12} /> Voir en tant que</button>
                    <button onClick={() => openEdit(role)} style={actionBtn('#0077b6')}><Pencil size={12} /> Modifier</button>
                    {!role.isSystem && (
                      <button onClick={() => askDelete(role)} title="Supprimer le rôle" style={actionBtn('#ef4444')}><Trash2 size={12} /></button>
                    )}
                  </div>
                )}
              </div>

              {!role.locked && (
                <div>
                  <span style={chip(role.color)}>{accessLine(role.access)}</span>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>Pages : </span>
                {role.locked ? 'toutes, y compris Équipes et Maintenance' : (pages.join(', ') || 'aucune')}
                {hidden.length > 0 && (
                  <div><span style={{ fontWeight: 600 }}>Désactivées : </span>{hidden.join(', ')}</div>
                )}
              </div>

              {deleting === role.key && (
                <div>
                  {members > 0 && (
                    <>
                      <label style={labelStyle}>{members} membre{members > 1 ? 's ont' : ' a'} ce rôle : il{members > 1 ? 's passeront' : ' passera'} en</label>
                      <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} style={inputStyle}>
                        <option value="">Choisir un rôle…</option>
                        {others.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    </>
                  )}
                  <InlineConfirm
                    lines={[`Supprimer le rôle ${role.label} ?`, members > 0 ? 'Leur accès change tout de suite.' : 'Aucun membre n’a ce rôle.']}
                    confirmLabel="Supprimer" danger busy={busy}
                    onCancel={() => setDeleting(null)} onConfirm={() => remove(role)}
                  />
                </div>
              )}
              {rowError?.key === role.key && <div style={errorLine}>{rowError.message}</div>}
            </div>
          )
        })}
      </div>

      {/* Fenêtre de création / modification */}
      {editing && (
        <div style={overlay} onClick={() => setEditing(null)}>
          <div style={{ ...glass, background: 'rgba(255,255,255,0.97)', padding: '24px 28px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editing === 'new' ? 'Nouveau rôle' : `Modifier le rôle ${editing.label}`}</h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom du rôle *</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Finance / Marketing" required minLength={2} maxLength={LABEL_MAX} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Couleur</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {PALETTE.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} title={c} style={{
                      width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
                      border: form.color === c ? '2px solid var(--text)' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {form.color === c && <Check size={12} color="#fff" />}
                    </button>
                  ))}
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} title="Autre couleur" style={{ width: 30, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Accès * (au moins un)
                  {form.access.length > 0 && <span style={{ color: form.color, marginLeft: 6 }}>· {accessLine(form.access)}</span>}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ACCESS.map(a => {
                    const on = form.access.includes(a.key)
                    return (
                      <label key={a.key} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${on ? form.color : 'var(--border)'}`, background: on ? form.color + '12' : 'transparent',
                      }}>
                        <input type="checkbox" checked={on} onChange={() => toggleAccess(a.key)} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pagesFor([a.key]).join(', ')}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Pages du rôle : le Super Admin décoche celles à désactiver */}
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: formPages.length ? 8 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    Pages de ce rôle
                    {formPages.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {formVisible.length} / {formPages.length} activées</span>}
                  </div>
                  {formPages.length > 1 && (
                    <button type="button" onClick={() => setAllPages(formVisible.length < formPages.length)} style={linkBtn}>
                      {formVisible.length < formPages.length ? 'Tout activer' : 'Tout désactiver'}
                    </button>
                  )}
                </div>
                {formPages.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cochez un accès pour voir ses pages.</div>
                ) : (
                  GROUPS.map(g => {
                    const items = formPages.filter(n => n.group === g.key)
                    if (items.length === 0) return null
                    return (
                      <div key={g.key} style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{g.label}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 6 }}>
                          {items.map(n => {
                            const on = !form.hiddenPages.includes(n.to)
                            const Icon = n.icon
                            const tabs = formTabs[n.to]
                            const pageBox = (
                              <label style={{ ...pageChip(on, form.color), ...(tabs.length ? { border: 'none', background: 'transparent', padding: '2px 0' } : {}) }}>
                                <input type="checkbox" checked={on} onChange={() => toggleHidden(n.to)} />
                                {Icon && <Icon size={13} style={{ flexShrink: 0 }} />}
                                <span style={{ fontWeight: on ? 600 : 500, textDecoration: on ? 'none' : 'line-through' }}>{n.label}</span>
                                {tabs.length > 0 && on && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                                    · {tabs.filter(x => !form.hiddenPages.includes(tabId(n.to, x.key))).length} / {tabs.length} onglets
                                  </span>
                                )}
                              </label>
                            )
                            if (!tabs.length) return <div key={n.to}>{pageBox}</div>
                            // Page à onglets : sur toute la largeur, ses onglets en dessous
                            return (
                              <div key={n.to} style={{ gridColumn: '1 / -1', borderRadius: 8, padding: '6px 9px', border: `1px solid ${on ? form.color : 'var(--border)'}`, background: on ? form.color + '0d' : 'transparent' }}>
                                {pageBox}
                                {on && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 2px 22px' }}>
                                    {tabs.map(x => {
                                      const id = tabId(n.to, x.key)
                                      const tabOn = !form.hiddenPages.includes(id)
                                      return (
                                        <label key={id} style={tabChip(tabOn, form.color)}>
                                          <input type="checkbox" checked={tabOn} onChange={() => toggleHidden(id)} style={{ margin: 0 }} />
                                          <span style={{ textDecoration: tabOn ? 'none' : 'line-through' }}>{x.label}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Une page décochée disparaît du menu de ce rôle et ne s'ouvre plus ; un onglet décoché disparaît de sa page.
                  {editing !== 'new' && (countByRole[editing.key] ?? 0) > 0 && ` S'applique aux ${countByRole[editing.key]} membre(s) de ce rôle au prochain chargement de l'admin.`}
                </div>
              </div>

              {formError && <div style={{ ...errorLine, marginTop: 0 }}>{formError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setEditing(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {saving ? 'Enregistrement…' : editing === 'new' ? 'Créer le rôle' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const inputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13 }
const errorLine  = { fontSize: 12, color: '#ef4444', background: '#ef444410', padding: '8px 12px', borderRadius: 6, marginTop: 8 }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const actionBtn  = (color) => ({ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}`, background: 'transparent', color, whiteSpace: 'nowrap' })
// Pages et onglets décochés d'un rôle, en clair : « Parrainage, Marketing › Promotions »
function hiddenLabels(role) {
  const ids = role.hiddenPages ?? []
  return pageEntriesFor(role.access).flatMap(n => [
    ...(ids.includes(n.to) ? [n.label] : []),
    ...(ids.includes(n.to) ? [] : (PAGE_TABS[n.to] ?? []).filter(x => ids.includes(tabId(n.to, x.key))).map(x => `${n.label} › ${x.label}`)),
  ])
}

const pageChip = (on, color) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5,
  border: `1px solid ${on ? color : 'var(--border)'}`, background: on ? color + '12' : 'transparent',
  color: on ? 'var(--text)' : 'var(--text-muted)',
})
const tabChip = (on, color) => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 14, cursor: 'pointer', fontSize: 11.5, fontWeight: on ? 600 : 500,
  border: `1px solid ${on ? color : 'var(--border)'}`, background: on ? '#fff' : 'transparent',
  color: on ? 'var(--text)' : 'var(--text-muted)',
})
const linkBtn    = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--primary)' }
const chip       = (color) => ({ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: color + '18', color })
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
