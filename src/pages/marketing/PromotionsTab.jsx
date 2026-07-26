import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Gift, Search, ToggleLeft, ToggleRight, Check, X } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'

const TYPE_LABELS = { FREE_COURSE: 'Course gratuite', PERCENT_OFF: 'Réduction %', FIXED_OFF: 'Montant fixe' }
const TARGET_LABELS = { CLIENT: 'Clients', DEM_PRO: 'DEM Pro', DRIVER: 'Livreurs (passe)', ALL: 'Clients + DEM Pro' }

const card       = { ...glass, padding: '20px 24px' }
const tableStyle = { width: '100%', minWidth: 760, borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { ...btnOutline, color: '#fff', borderColor: 'var(--primary)', background: 'var(--primary)' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, padding: '28px 32px', width: 520, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }
const label      = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 14 }

const EMPTY_FORM = {
  name: '', code: '', type: 'PERCENT_OFF', value: '', targetRole: 'ALL', targetUser: null,
  maxUsesPerUser: 1, maxUsesTotal: '', budgetCap: '', minOrderPrice: '', expiresAt: '',
}

export default function PromotionsTab() {
  const [campaigns, setCampaigns] = useState(null)
  const [form, setForm] = useState(null) // null = fermé, {} = création, {...} = édition
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [searchingUser, setSearchingUser] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/promotions')
      setCampaigns(res.data.campaigns)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm({ ...EMPTY_FORM }); setError('')
    setUserSearch(''); setUserResults([])
  }
  function openEdit(c) {
    setForm({
      id: c.id, name: c.name, code: c.code ?? '', type: c.type, value: c.value ?? '',
      targetRole: c.targetRole, targetUser: c.targetUser ?? null,
      maxUsesPerUser: c.maxUsesPerUser, maxUsesTotal: c.maxUsesTotal ?? '',
      budgetCap: c.budgetCap ?? '', minOrderPrice: c.minOrderPrice ?? '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
    })
    setError('')
    setUserSearch(''); setUserResults([])
  }

  async function searchTargetUser() {
    if (!userSearch.trim()) return
    setSearchingUser(true)
    try {
      const res = await api.get('/admin/promotions/users-search', { params: { search: userSearch.trim() } })
      setUserResults(res.data.users ?? [])
    } catch (e) { console.error(e) }
    finally { setSearchingUser(false) }
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        type: form.type,
        value: form.type === 'FREE_COURSE' ? null : Number(form.value),
        targetRole: form.targetRole,
        targetUserId: form.targetUser?.id || null,
        maxUsesPerUser: Number(form.maxUsesPerUser) || 0,
        maxUsesTotal: form.maxUsesTotal === '' ? null : Number(form.maxUsesTotal),
        budgetCap: form.budgetCap === '' ? null : Number(form.budgetCap),
        minOrderPrice: form.minOrderPrice === '' ? null : Number(form.minOrderPrice),
        expiresAt: form.expiresAt || null,
      }
      if (form.id) await api.put(`/admin/promotions/${form.id}`, payload)
      else await api.post('/admin/promotions', payload)
      setForm(null)
      load()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de l\'enregistrement.')
    } finally { setSaving(false) }
  }

  async function toggleActive(c) {
    try {
      await api.put(`/admin/promotions/${c.id}`, { active: !c.active })
      load()
    } catch (e) { console.error(e) }
  }

  async function remove(c) {
    if (!window.confirm(`Supprimer la campagne "${c.name}" ?`)) return
    try {
      await api.delete(`/admin/promotions/${c.id}`)
      load()
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, maxWidth: 560 }}>
          Le livreur touche toujours 100% du prix de la course — DEM finance la réduction accordée
          au client, jamais le livreur.
        </p>
        <button onClick={openCreate} style={btnPrimary}>
          <Plus size={14} /> Nouvelle campagne
        </button>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Nom', 'Code', 'Type', 'Cible', 'Utilisations', 'Budget', 'Statut', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns === null ? (
                <tr><td colSpan={8} style={{ ...tdStyle, color: 'var(--text-muted)', padding: 20 }}>Chargement…</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={8} style={{ ...tdStyle, color: 'var(--text-muted)', padding: 20 }}>Aucune campagne pour le moment.</td></tr>
              ) : campaigns.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <td style={tdStyle}><strong>{c.name}</strong></td>
                  <td style={tdStyle}>{c.code ? <code style={{ fontSize: 12 }}>{c.code}</code> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Auto</span>}</td>
                  <td style={tdStyle}>
                    {TYPE_LABELS[c.type]}
                    {c.type === 'PERCENT_OFF' && ` (${c.value}%)`}
                    {c.type === 'FIXED_OFF' && ` (${c.value} F)`}
                  </td>
                  <td style={tdStyle}>
                    {c.targetUser
                      ? <span>👤 {c.targetUser.name ?? c.targetUser.phone}</span>
                      : TARGET_LABELS[c.targetRole]}
                  </td>
                  <td style={tdStyle}>{c.usedCount}{c.maxUsesTotal != null ? ` / ${c.maxUsesTotal}` : ''}</td>
                  <td style={tdStyle}>
                    {c.budgetCap != null
                      ? `${c.budgetSpent.toLocaleString()} / ${c.budgetCap.toLocaleString()} F`
                      : `${c.budgetSpent.toLocaleString()} F`}
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => toggleActive(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.active ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {c.active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(c)} style={{ ...btnOutline, padding: '5px 8px' }}><Pencil size={13} /></button>
                      <button onClick={() => remove(c)} style={{ ...btnOutline, padding: '5px 8px', color: '#e53e3e', borderColor: 'rgba(229,62,62,.3)' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <GiftForfaitCard />

      {form && (
        <div style={overlay} onClick={() => !saving && setForm(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4, fontSize: 16 }}>{form.id ? 'Modifier la campagne' : 'Nouvelle campagne'}</h2>
            <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Sans code, la campagne s'applique automatiquement à la meilleure éligibilité du client — avec un code, il doit le saisir.
            </p>

            <label style={label}>Nom interne *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...glassInput, width: '100%' }} placeholder="Ex : Lancement Thiaroye" />

            <label style={label}>Code promo (optionnel — laisser vide pour auto-application)</label>
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} style={{ ...glassInput, width: '100%' }} placeholder="Ex : DEM20" />

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...glassInput, width: '100%' }}>
                  <option value="FREE_COURSE">Course gratuite</option>
                  <option value="PERCENT_OFF">Réduction %</option>
                  <option value="FIXED_OFF">Montant fixe (FCFA)</option>
                </select>
              </div>
              {form.type !== 'FREE_COURSE' && (
                <div style={{ flex: 1 }}>
                  <label style={label}>{form.type === 'PERCENT_OFF' ? 'Pourcentage *' : 'Montant (FCFA) *'}</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} style={{ ...glassInput, width: '100%' }} />
                </div>
              )}
            </div>

            <label style={label}>Cible *</label>
            <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} style={{ ...glassInput, width: '100%' }}>
              <option value="ALL">Tous (clients + DEM Pro)</option>
              <option value="CLIENT">Clients uniquement</option>
              <option value="DEM_PRO">DEM Pro uniquement</option>
              <option value="DRIVER">Livreurs — réduction sur la passe</option>
            </select>
            {form.targetRole === 'DRIVER' && (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                S'applique au prix de la passe journalière (480/650 FCFA), pas aux commandes.
                "Course minimum" ne s'applique pas ici.
              </p>
            )}

            <label style={label}>Utilisateur spécifique (optionnel — prime sur la cible ci-dessus)</label>
            {form.targetUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,119,182,0.06)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, flex: 1 }}>
                  <strong>{form.targetUser.name ?? '—'}</strong> — {form.targetUser.phone}
                </span>
                <button onClick={() => setForm(f => ({ ...f, targetUser: null }))} style={{ ...btnOutline, padding: '4px 10px' }}>Retirer</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchTargetUser() } }}
                    placeholder="Nom ou téléphone…"
                    style={{ ...glassInput, flex: 1 }}
                  />
                  <button onClick={searchTargetUser} disabled={searchingUser} style={btnOutline}>
                    <Search size={14} /> {searchingUser ? '…' : 'Chercher'}
                  </button>
                </div>
                {userResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 150, overflowY: 'auto' }}>
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setForm(f => ({ ...f, targetUser: u })); setUserResults([]); setUserSearch('') }}
                        style={{ ...btnOutline, justifyContent: 'space-between', width: '100%', textAlign: 'left' }}
                      >
                        <span>{u.name ?? '—'} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({u.role})</span></span>
                        <span style={{ color: 'var(--text-muted)' }}>{u.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Utilisations max / utilisateur</label>
                <input type="number" value={form.maxUsesPerUser} onChange={e => setForm(f => ({ ...f, maxUsesPerUser: e.target.value }))} style={{ ...glassInput, width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Utilisations max totales</label>
                <input type="number" value={form.maxUsesTotal} onChange={e => setForm(f => ({ ...f, maxUsesTotal: e.target.value }))} style={{ ...glassInput, width: '100%' }} placeholder="Illimité" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Budget max (FCFA)</label>
                <input type="number" value={form.budgetCap} onChange={e => setForm(f => ({ ...f, budgetCap: e.target.value }))} style={{ ...glassInput, width: '100%' }} placeholder="Illimité" />
              </div>
              {form.targetRole !== 'DRIVER' && (
                <div style={{ flex: 1 }}>
                  <label style={label}>Course minimum (FCFA)</label>
                  <input type="number" value={form.minOrderPrice} onChange={e => setForm(f => ({ ...f, minOrderPrice: e.target.value }))} style={{ ...glassInput, width: '100%' }} placeholder="Aucun minimum" />
                </div>
              )}
            </div>

            <label style={label}>Expire le</label>
            <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} style={{ ...glassInput, width: '100%' }} />

            {error && <div style={{ marginTop: 12, color: '#e53e3e', fontSize: 13 }}>{error}</div>}

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setForm(null)} disabled={saving} style={btnOutline}>Annuler</button>
              <button onClick={save} disabled={saving || !form.name.trim()} style={btnPrimary}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Récompenser un livreur — passe offerte, sans débit wallet ────────────────
function GiftForfaitCard() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [selected, setSelected] = useState([]) // plusieurs livreurs possibles — cadeau groupé
  const [days, setDays] = useState(1)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(null)

  // Recherche en direct (débouncée) — évite de dépendre d'un clic ou d'un
  // Entrée, et affiche systématiquement un état (résultats / vide / erreur)
  // au lieu de rester silencieuse en cas d'échec réseau.
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setResults([]); setHasSearched(false); setSearchError(''); setSearching(false)
      return
    }
    setSearching(true); setSearchError('')
    const handle = setTimeout(async () => {
      try {
        const res = await api.get('/admin/drivers', { params: { search: q, limit: 15 } })
        setResults(res.data.drivers ?? [])
      } catch (e) {
        setSearchError(e.response?.data?.message ?? 'Recherche impossible — réessayez.')
        setResults([])
      } finally {
        setSearching(false); setHasSearched(true)
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [search])

  function toggleSelect(driver) {
    setMessage(null)
    setSelected(prev => prev.some(d => d.id === driver.id)
      ? prev.filter(d => d.id !== driver.id)
      : [...prev, driver])
  }

  async function sendGift() {
    if (selected.length === 0) return
    setSending(true); setMessage(null)
    try {
      if (selected.length === 1) {
        const target = selected[0]
        const res = await api.post(`/admin/drivers/${target.id}/gift-forfait`, { days: Number(days) })
        const expires = new Date(res.data.expiresAt).toLocaleString('fr-FR')
        setMessage({ ok: true, text: `Passe offerte à ${target.name ?? target.phone} — active jusqu'au ${expires}.` })
      } else {
        const res = await api.post('/admin/drivers/gift-forfait-bulk', {
          driverIds: selected.map(d => d.id), days: Number(days),
        })
        const nameOf = Object.fromEntries(selected.map(d => [d.id, d.name ?? d.phone]))
        const failures = (res.data.results ?? []).filter(r => !r.ok)
        setMessage({
          ok: failures.length === 0,
          text: failures.length === 0
            ? `Passe offerte à ${res.data.succeeded} livreur(s).`
            : `Passe offerte à ${res.data.succeeded} livreur(s) — échec pour ${failures.map(f => `${nameOf[f.driverId] ?? f.driverId} (${f.message})`).join(', ')}.`,
        })
      }
      setSelected([]); setResults([]); setSearch('')
    } catch (e) {
      setMessage({ ok: false, text: e.response?.data?.message ?? 'Erreur.' })
    } finally { setSending(false) }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Gift size={16} color="var(--primary)" />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Récompenser un ou plusieurs livreurs</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>
        Offre une passe journalière gratuite (aucun débit wallet) — se cumule si le livreur a déjà une passe active.
        Sélectionnez un ou plusieurs livreurs pour un cadeau groupé.
      </p>

      <div style={{ position: 'relative' }}>
        <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom ou numéro de téléphone du livreur…"
          style={{ ...glassInput, width: '100%', paddingLeft: 32 }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 11, color: 'var(--text-muted)' }}>
            Recherche…
          </span>
        )}
      </div>

      {searchError && (
        <div style={{ fontSize: 12, color: '#e53e3e', marginTop: 6 }}>{searchError}</div>
      )}
      {!searchError && !searching && hasSearched && results.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Aucun livreur trouvé pour « {search.trim()} ».
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, marginBottom: 14, maxHeight: 240, overflowY: 'auto' }}>
          {results.map(d => {
            const checked = selected.some(s => s.id === d.id)
            return (
              <button
                key={d.id}
                onClick={() => toggleSelect(d)}
                style={{
                  ...btnOutline, justifyContent: 'space-between', width: '100%', textAlign: 'left',
                  background: checked ? 'rgba(0,119,182,0.10)' : btnOutline.background,
                  borderColor: checked ? 'var(--primary)' : btnOutline.borderColor,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: checked ? 'var(--primary)' : 'transparent', flexShrink: 0,
                  }}>
                    {checked && <Check size={11} color="#fff" />}
                  </span>
                  {d.name ?? '—'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{d.phone}</span>
              </button>
            )
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'rgba(0,119,182,0.06)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selected.map(d => (
              <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 10px', borderRadius: 999, background: '#fff', fontSize: 12, border: '1px solid rgba(0,119,182,0.2)' }}>
                {d.name ?? d.phone}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelected(prev => prev.filter(s => s.id !== d.id))} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number" min={1} value={days}
                onChange={e => setDays(e.target.value)}
                style={{ ...glassInput, width: 60 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>jour(s)</span>
            </span>
            <button onClick={sendGift} disabled={sending} style={btnPrimary}>
              {sending ? 'Envoi…' : `Offrir la passe à ${selected.length} livreur${selected.length > 1 ? 's' : ''}`}
            </button>
            <button onClick={() => setSelected([])} style={btnOutline}>Tout désélectionner</button>
          </div>
        </div>
      )}

      {message && (
        <div style={{ fontSize: 13, color: message.ok ? '#22c55e' : '#e53e3e', marginTop: 4 }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
