import { useState } from 'react'
import api from '../../lib/api'
import { Pencil, Trash2, XCircle, Lock, Check, Plus } from 'lucide-react'
import { glass, glassInput } from '../../lib/glassStyles'
import { ACCESS, pagesFor } from '../../lib/roleAccess'
import InlineConfirm from '../../components/InlineConfirm'

// ── Rôles de l'équipe (onglet Rôles de la page Équipes) ──
// Un rôle = un nom, une couleur et des accès. Chaque accès ouvre les pages du
// menu qui le citent (lib/menu.js) et les actions qui vont avec, comme
// côté serveur (requireAdminRole). Super Admin : accès total, verrouillé.

const PALETTE = ['#6366f1', '#22c55e', '#ec4899', '#06b6d4', '#a855f7', '#0ea5e9', '#14b8a6', '#84cc16', '#f97316', '#ef4444', '#64748b', '#0f766e']

const EMPTY_FORM = { label: '', color: PALETTE[5], access: [] }

export default function RolesTab({ roles, countByRole, onChanged, onNotice }) {
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
    setEditing(role); setForm({ label: role.label, color: role.color, access: role.access }); setFormError('')
  }
  function toggleAccess(key) {
    setForm(f => ({ ...f, access: f.access.includes(key) ? f.access.filter(k => k !== key) : [...f.access, key] }))
  }

  async function save(e) {
    e.preventDefault()
    if (form.access.length === 0) { setFormError('Cochez au moins un accès.'); return }
    setSaving(true); setFormError('')
    try {
      const res = editing === 'new'
        ? await api.post('/admin/roles', form)
        : await api.patch(`/admin/roles/${editing.key}`, form)
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
          const pages = pagesFor(role.access, role.locked)
          const others = roles.filter(r => r.key !== role.key)
          return (
            <div key={role.key} style={{ ...glass, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
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
                    <button onClick={() => openEdit(role)} style={actionBtn('#0077b6')}><Pencil size={12} /> Modifier</button>
                    {!role.isSystem && (
                      <button onClick={() => askDelete(role)} title="Supprimer le rôle" style={actionBtn('#ef4444')}><Trash2 size={12} /></button>
                    )}
                  </div>
                )}
              </div>

              {!role.locked && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {ACCESS.filter(a => role.access.includes(a.key)).map(a => (
                    <span key={a.key} style={chip(role.color)}>{a.label}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>Pages : </span>
                {role.locked ? 'toutes, y compris Équipes et Maintenance' : (pages.join(', ') || 'aucune')}
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
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Chargé de comptes" required minLength={2} maxLength={40} style={inputStyle} />
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
                <label style={labelStyle}>Accès * (au moins un)</label>
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

              <div style={{ fontSize: 12, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ fontWeight: 600 }}>Pages visibles avec ce rôle : </span>
                <span style={{ color: 'var(--text-muted)' }}>{pagesFor(form.access).join(', ') || 'aucune'}</span>
                {editing !== 'new' && (countByRole[editing.key] ?? 0) > 0 && (
                  <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    S'applique tout de suite aux {countByRole[editing.key]} membre(s) de ce rôle.
                  </div>
                )}
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
const chip       = (color) => ({ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: color + '18', color })
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
