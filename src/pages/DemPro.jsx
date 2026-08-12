import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import Badge from '../components/Badge'
import { RefreshCw, CheckCircle, XCircle, Pencil, Trash2, Ban, RotateCcw, X, Search, Phone, Flag, Plus, Gift, XSquare } from 'lucide-react'
import { glass, glassModal, glassInput, pageWrap, pageScroll, stickyTh, stickyThCol, stickyCol } from '../lib/glassStyles'
import SubmitRequestModal from './service-client/components/SubmitRequestModal'

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

const PLAN_LABELS = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' }
const PLAN_COLORS = { FREE: '#888', PRO: '#0077b6', BUSINESS: '#6366f1' }

// ── Modal Créer / Modifier ────────────────────────────────────────────────────
function EditModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id
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
    if (!isEdit && !form.phone.trim()) { setError('Le numéro de téléphone est requis.'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) await api.patch(`/admin/dem-pro/${initial.id}`, form)
      else        await api.post('/admin/dem-pro', form)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 460, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Modifier le compte DEM Pro' : 'Nouveau compte DEM Pro'}</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        {[
          { key: 'name',            label: 'Nom complet',     type: 'text', placeholder: 'Ex : Ibrahima Sow' },
          { key: 'phone',           label: isEdit ? 'Téléphone' : 'Téléphone *', type: 'tel',  placeholder: '+221 77 000 00 00' },
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

// ── Modal "Offrir un palier" — promo/bonus groupée ────────────────────────────
const DURATION_PRESETS = [
  ['7', '1 semaine'],
  ['30', '1 mois'],
  ['90', '3 mois'],
]

function GrantModal({ count, onClose, onConfirm, saving }) {
  const [plan, setPlan] = useState('PRO')
  const [days, setDays] = useState('30')
  const [customDays, setCustomDays] = useState('')
  const [now] = useState(() => Date.now())
  const effectiveDays = days === 'custom' ? Number(customDays) : Number(days)

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 420, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gift size={18} /> Offrir un palier
          </h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 13 }}>
          {count} compte{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Palier</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['PRO', 'BUSINESS'].map(p => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${plan === p ? PLAN_COLORS[p] : 'rgba(0,119,182,0.2)'}`,
                  background: plan === p ? PLAN_COLORS[p] + '18' : 'rgba(255,255,255,0.5)',
                  color: plan === p ? PLAN_COLORS[p] : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {PLAN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Durée offerte</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DURATION_PRESETS.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setDays(val)}
                style={{
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${days === val ? 'var(--primary)' : 'rgba(0,119,182,0.2)'}`,
                  background: days === val ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                  color: days === val ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setDays('custom')}
              style={{
                padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${days === 'custom' ? 'var(--primary)' : 'rgba(0,119,182,0.2)'}`,
                background: days === 'custom' ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                color: days === 'custom' ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600,
              }}
            >
              Personnalisé
            </button>
          </div>
          {days === 'custom' && (
            <input
              type="number"
              min="1"
              value={customDays}
              onChange={e => setCustomDays(e.target.value)}
              placeholder="Nombre de jours"
              style={{ ...inputStyle, marginTop: 10 }}
            />
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          {effectiveDays > 0
            ? `Expire le ${new Date(now + effectiveDays * 86400000).toLocaleDateString('fr-FR')}.`
            : 'Choisissez une durée valide.'}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnOutline}>Annuler</button>
          <button
            disabled={saving || !(effectiveDays > 0)}
            onClick={() => onConfirm(plan, effectiveDays)}
            style={btnPrimary}
          >
            {saving ? 'Envoi...' : `Offrir à ${count} compte${count > 1 ? 's' : ''}`}
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
  const paying    = accounts.filter(a => a.proPlan === 'PRO' || a.proPlan === 'BUSINESS').length

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        { label: 'Total comptes', value: accounts.length, color: 'var(--primary)' },
        { label: 'Actifs',        value: active,           color: 'var(--success)' },
        { label: 'En attente',    value: pending,          color: '#f59e0b' },
        { label: 'Payants (Pro/Business)', value: paying,  color: '#6366f1' },
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
  const isServiceClient = user?.adminRole === 'SERVICE_CLIENT'
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [requestTarget, setRequestTarget] = useState(null)
  // Sélection multiple — offre/retrait de palier groupé (SUPER uniquement)
  const [selected, setSelected] = useState(new Set())
  const [grantModalOpen, setGrantModalOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

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

  async function changePlan(account, plan) {
    if (plan === account.proPlan) return
    try {
      const res = await api.patch(`/admin/dem-pro/${account.id}/plan`, { plan })
      setAccounts(prev => prev.map(a => a.id === account.id ? res.data.account : a))
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(prev =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id))
    )
  }

  // Offre groupée — statut TRIAL (voir dem_pro.plans VALID_PLAN_STATUSES) :
  // distingue un cadeau d'un vrai abonnement payé, et le cron d'expiration
  // (checkPlanExpiry) le rétrograde en FREE normalement une fois expiresAt
  // dépassé — pas besoin d'y repenser plus tard.
  async function bulkGrant(plan, days) {
    setBulkSaving(true)
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString()
    const ids = [...selected]
    const results = await Promise.allSettled(
      ids.map(id => api.patch(`/admin/dem-pro/${id}/plan`, { plan, status: 'TRIAL', expiresAt }))
    )
    const failed = results.filter(r => r.status === 'rejected').length
    setBulkSaving(false)
    setGrantModalOpen(false)
    setSelected(new Set())
    fetch()
    if (failed > 0) alert(`${failed} compte(s) sur ${ids.length} n'ont pas pu être mis à jour.`)
  }

  async function bulkRevoke() {
    const ids = [...selected]
    if (!confirm(`Retirer l'accès payant pour ${ids.length} compte(s) ? Ils repassent immédiatement en Gratuit.`)) return
    setBulkSaving(true)
    const results = await Promise.allSettled(
      ids.map(id => api.patch(`/admin/dem-pro/${id}/plan`, { plan: 'FREE', status: 'ACTIVE', expiresAt: null }))
    )
    const failed = results.filter(r => r.status === 'rejected').length
    setBulkSaving(false)
    setSelected(new Set())
    fetch()
    if (failed > 0) alert(`${failed} compte(s) sur ${ids.length} n'ont pas pu être mis à jour.`)
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

  async function reportAccount(account) {
    const reason = window.prompt(`Motif du signalement pour ${account.name ?? account.phone} :`)
    if (!reason?.trim()) return
    try {
      await api.post('/admin/report-user', { userId: account.id, userRole: 'DEM_PRO', reason: reason.trim() })
      alert('Signalement envoyé.')
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetch} style={btnOutline}>
            <RefreshCw size={14} /> Actualiser
          </button>
          {isSuper && (
            <button onClick={() => setEditTarget({})} style={btnPrimary}>
              <Plus size={14} /> Nouveau compte
            </button>
          )}
        </div>
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

      {/* Barre d'actions groupées — n'apparaît qu'avec une sélection active */}
      {isSuper && selected.size > 0 && (
        <div style={{
          ...glass, padding: '10px 16px', marginBottom: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {selected.size} compte{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <button onClick={() => setGrantModalOpen(true)} disabled={bulkSaving} style={{ ...btnPrimary, background: '#6366f1' }}>
            <Gift size={14} /> Offrir Pro/Business
          </button>
          <button onClick={bulkRevoke} disabled={bulkSaving} style={{ ...btnOutline, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Ban size={14} /> Retirer l'accès payant
          </button>
          <button onClick={() => setSelected(new Set())} style={{ ...btnIcon, marginLeft: 'auto' }} title="Désélectionner">
            <XSquare size={16} />
          </button>
        </div>
      )}

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
                  {isSuper && (
                    <th style={{ ...thStyle, ...stickyTh, width: 30 }}>
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === filtered.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  {['#', 'Entreprise', 'Téléphone', 'Secteur', 'Volume', 'Plan', 'Commandes', 'Statut', 'Inscription', 'Actions'].map((h, i) => (
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
                    {isSuper && (
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
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
                    <td style={tdStyle}>
                      {a.phone ? <a href={`tel:${a.phone}`} style={{ color: '#0077b6' }}>{a.phone}</a> : '—'}
                    </td>
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
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                        {isSuper ? (
                          <select
                            value={a.proPlan ?? 'FREE'}
                            onChange={e => changePlan(a, e.target.value)}
                            style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 6px', borderRadius: 8,
                              border: `1px solid ${(PLAN_COLORS[a.proPlan] ?? '#888')}55`,
                              background: (PLAN_COLORS[a.proPlan] ?? '#888') + '18',
                              color: PLAN_COLORS[a.proPlan] ?? '#888',
                              cursor: 'pointer',
                            }}
                          >
                            {Object.entries(PLAN_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: (PLAN_COLORS[a.proPlan] ?? '#888') + '18',
                            color: PLAN_COLORS[a.proPlan] ?? '#888',
                          }}>
                            {PLAN_LABELS[a.proPlan] ?? a.proPlan ?? 'Gratuit'}
                          </span>
                        )}
                        {a.proPlanStatus === 'TRIAL' && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                            background: '#f59e0b18', color: '#f59e0b',
                          }}>
                            <Gift size={10} /> Offert
                          </span>
                        )}
                        {a.proPlanExpiresAt && (a.proPlan ?? 'FREE') !== 'FREE' && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            jusqu'au {new Date(a.proPlanExpiresAt).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </td>
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
                          {a.phone && (
                            <a href={`tel:${a.phone}`} style={btnSmall} title="Appeler">
                              <Phone size={13} />
                            </a>
                          )}
                          <button onClick={() => deleteAccount(a)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : isServiceClient ? (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button onClick={() => setEditTarget(a)} style={btnSmall} title="Modifier">
                            <Pencil size={13} />
                          </button>
                          {a.phone && (
                            <a href={`tel:${a.phone}`} style={btnSmall} title="Appeler">
                              <Phone size={13} />
                            </a>
                          )}
                          <button onClick={() => reportAccount(a)} style={{ ...btnSmall, color: '#dc2626', borderColor: '#dc2626' }} title="Signaler">
                            <Flag size={13} />
                          </button>
                          {a.isActive ? (
                            <button
                              onClick={() => setRequestTarget({ kind: 'DEM_PRO_SUSPEND', targetUser: { id: a.id, label: a.proBusinessName ?? a.name ?? a.phone } })}
                              style={{ ...btnSmall, color: '#f59e0b', borderColor: '#f59e0b' }}
                            >
                              Demander suspension
                            </button>
                          ) : (
                            <button
                              onClick={() => setRequestTarget({ kind: 'DEM_PRO_ACTIVATE', targetUser: { id: a.id, label: a.proBusinessName ?? a.name ?? a.phone } })}
                              style={{ ...btnSmall, color: '#15803d', borderColor: '#15803d' }}
                            >
                              Demander réactivation
                            </button>
                          )}
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

      {/* Modal demande suspension/réactivation (SERVICE_CLIENT) */}
      {requestTarget && (
        <SubmitRequestModal
          kind={requestTarget.kind}
          targetUser={requestTarget.targetUser}
          onClose={() => setRequestTarget(null)}
          onSubmitted={() => { setRequestTarget(null); alert('Demande envoyée pour validation.') }}
        />
      )}

      {/* Modal offre promo groupée */}
      {grantModalOpen && (
        <GrantModal
          count={selected.size}
          saving={bulkSaving}
          onClose={() => setGrantModalOpen(false)}
          onConfirm={bulkGrant}
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
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }
const btnDanger  = { padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glassModal }
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }
const inputStyle = { ...glassInput }
const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
