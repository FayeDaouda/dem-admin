import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, CheckCircle, XCircle, Pencil, Trash2, Ban, RotateCcw, X, Search, Phone, Flag, Plus, Gift, XSquare, MessageCircle, Send } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyThCol, stickyCol } from '../lib/glassStyles'
import SubmitRequestModal from './service-client/components/SubmitRequestModal'
import AccountDetailModal from './dem-pro/AccountDetailModal'
import OffersTab from './dem-pro/OffersTab'
import ReferralsTab from './dem-pro/ReferralsTab'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { canSee, ACTION_ROLES } from '../lib/droits'
import {
  hasPaidTier, SECTOR_LABELS, SECTOR_COLORS, VOLUME_LABELS, PLAN_COLORS, proStatusInfo, planLabel,
} from './dem-pro/labels'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useUrlQuery } from '../lib/useUrlQuery'

// Vues de la liste. « Actifs » = validé ET non suspendu (même règle que
// l'ancienne carte « Actifs ») ; les suspendus ont leur propre vue.
const VIEWS = [
  { key: '',          label: 'Tous',       test: () => true },
  { key: 'PENDING',   label: 'En attente', test: a => a.proStatus === 'PENDING' },
  { key: 'ACTIVE',    label: 'Actifs',     test: a => a.proStatus === 'ACTIVE' && a.isActive },
  { key: 'SUSPENDED', label: 'Suspendus',  test: a => !a.isActive },
  { key: 'REJECTED',  label: 'Refusés',    test: a => a.proStatus === 'REJECTED' },
]

// Payé = abonnement réglé via SamirPay et en cours (paidPlanActive, calculé
// côté serveur) ; Offert = palier donné sans paiement (essai TRIAL ou
// attribution manuelle par un admin).
const PLAN_FILTERS = [
  { key: '',        label: 'Plan : tous',            test: () => true },
  { key: 'FREE',    label: 'Gratuit',                test: a => !hasPaidTier(a) },
  { key: 'PAID',    label: 'Abonnement payé',        test: a => a.paidPlanActive },
  { key: 'OFFERED', label: 'Accès offert / manuel',  test: a => hasPaidTier(a) && !a.paidPlanActive },
]

const PAGE_TABS = [
  { key: 'comptes',    label: 'Comptes' },
  { key: 'offres',     label: 'Offres DEM Pro' },
  { key: 'parrainage', label: 'Parrainage' },
]

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
    <div style={{ ...overlay, zIndex: 320 }} onClick={onClose}>
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

// Paliers offrables = plans attribuables du système en vigueur (GET
// /admin/dem-pro/plans), hors Gratuit. Ancien système : Pro seulement
// (Business masqué — plus aucune différence fonctionnelle réelle avec Pro).
// Nouveaux paliers : Starter / Business / Premium — c'est ainsi que l'admin
// lance l'essai d'un compte gratuit, le compte à rebours part à l'offre.
function giftablePlans(planSystem) {
  if (!planSystem) return []
  const plans = planSystem.plans.filter(p => p !== 'FREE')
  return planSystem.system === 'legacy' ? plans.filter(p => p !== 'BUSINESS') : plans
}
function GrantModal({ count, planSystem, onClose, onConfirm, saving }) {
  const options = giftablePlans(planSystem)
  const [plan, setPlan] = useState(options[0] ?? 'PRO')
  const [days, setDays] = useState('30')
  const [customDays, setCustomDays] = useState('')
  const [now] = useState(() => Date.now())
  const effectiveDays = days === 'custom' ? Number(customDays) : Number(days)

  return (
    <div style={{ ...overlay, zIndex: 320 }} onClick={onClose}>
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

        {options.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Palier</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {options.map(p => (
                <button key={p} onClick={() => setPlan(p)} style={{
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
                  border: `1px solid ${plan === p ? 'var(--primary)' : 'rgba(0,119,182,0.2)'}`,
                  background: plan === p ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                  color: plan === p ? '#fff' : 'var(--text-muted)',
                }}>{planSystem.labels[p] ?? p}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Durée offerte (le compte à rebours démarre maintenant)</label>
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

// ── Plan dans la liste : changement confirmé avant d'être enregistré ─────────
function PlanCell({ account: a, isSuper, planSystem, onChanged }) {
  const current = a.proPlan ?? 'FREE'
  const [pending, setPending] = useState(null)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const color = PLAN_COLORS[a.proPlan] ?? '#888'
  const labelOf = k => planSystem?.labels?.[k] ?? planLabel(k)

  async function confirm() {
    setBusy(true); setError('')
    try {
      const res = await api.patch(`/admin/dem-pro/${a.id}/plan`, { plan: pending })
      onChanged(a.id, res.data.account)
      setPending(null)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }} onClick={e => e.stopPropagation()}>
      {isSuper ? (
        <select
          value={pending ?? current}
          onChange={e => { setError(''); setPending(e.target.value === current ? null : e.target.value) }}
          style={{ fontSize: 11, fontWeight: 700, padding: '3px 6px', borderRadius: 8, border: `1px solid ${color}55`, background: color + '18', color, cursor: 'pointer' }}
        >
          {/* Plans du système en vigueur (Business masqué dans l'ancien,
              sauf pour un compte qui l'a déjà) ; le plan actuel reste
              affiché même s'il n'est plus attribuable (ex. Pro après bascule). */}
          {(planSystem?.plans ?? ['FREE', 'PRO'])
            .filter(k => planSystem?.system === 'tiers' || k !== 'BUSINESS' || a.proPlan === 'BUSINESS')
            .map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
          {planSystem && !planSystem.plans.includes(current) && (
            <option value={a.proPlan} disabled>{planLabel(a.proPlan)} (ancien)</option>
          )}
        </select>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: color + '18', color }}>{planLabel(current)}</span>
      )}
      {pending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span style={{ fontWeight: 600 }}>Passer en {labelOf(pending)} ?</span>
          <button onClick={confirm} disabled={busy} style={{ ...btnTiny, color: '#fff', background: 'var(--primary)', border: 'none' }}>{busy ? '…' : 'Confirmer'}</button>
          <button onClick={() => setPending(null)} disabled={busy} style={btnTiny}>Annuler</button>
        </div>
      )}
      {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
      {hasPaidTier(a) && !a.paidPlanActive && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#f59e0b18', color: '#f59e0b' }}>
          <Gift size={10} /> {a.proPlanStatus === 'TRIAL' ? 'Offert' : 'Sans paiement'}
        </span>
      )}
      {a.paidPlanActive && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#22c55e18', color: '#22c55e' }}>Payé</span>
      )}
      {a.proPlanExpiresAt && current !== 'FREE' && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>jusqu'au {new Date(a.proPlanExpiresAt).toLocaleDateString('fr-FR')}</span>
      )}
    </div>
  )
}

// ── Barre d'actions de la fiche commerçant ────────────────────────────────────
function ProActions({ account: a, rights, isServiceClient, onDone, onEdit, onRequest, onDeleted }) {
  const [open, setOpen]   = useState(null)
  const [text, setText]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const who = a.proBusinessName?.trim() || a.name || a.phone
  const digits = (a.phone ?? '').replace(/[^\d]/g, '')
  const isSuspended = !a.isActive && a.proStatus === 'ACTIVE'

  function toggle(action) {
    setOpen(o => (o === action ? null : action))
    setText(''); setError('')
  }

  const inline = {
    validate:   { title: `Valider le compte ${who} ?`, confirm: 'Valider', go: () => api.patch(`/admin/dem-pro/${a.id}/validate`, { approve: true }), ok: `${who} : compte validé.` },
    reject:     { title: `Refuser le compte ${who} ?`, placeholder: 'Motif du refus', danger: true, confirm: 'Confirmer le refus', go: v => api.patch(`/admin/dem-pro/${a.id}/validate`, { approve: false, reason: v || undefined }), ok: `${who} : compte refusé.` },
    suspend:    { title: `Suspendre le compte ${who} ?`, placeholder: 'Motif de la suspension', danger: true, confirm: 'Confirmer la suspension', go: v => api.patch(`/admin/dem-pro/${a.id}/suspend`, { reason: v || undefined }), ok: `${who} : compte suspendu.` },
    reactivate: { title: `Réactiver le compte ${who} ?`, confirm: 'Réactiver', go: () => api.patch(`/admin/dem-pro/${a.id}/suspend`, {}), ok: `${who} : compte réactivé.` },
    report:     { title: 'Signaler ce compte', placeholder: 'Motif du signalement', required: true, danger: true, confirm: 'Envoyer le signalement', go: v => api.post('/admin/report-user', { userId: a.id, userRole: 'DEM_PRO', reason: v }), ok: 'Signalement envoyé (incident ouvert).' },
    delete:     { title: `Supprimer définitivement ${who} ? Cette action est irréversible.`, danger: true, confirm: 'Supprimer définitivement', go: () => api.delete(`/admin/dem-pro/${a.id}`), ok: `${who} est supprimé.`, deletes: true },
  }
  const current = open ? inline[open] : null

  async function confirm() {
    const v = text.trim()
    if (current.required && !v) { setError('Ce champ est obligatoire.'); return }
    setBusy(true); setError('')
    try {
      await current.go(v)
      if (current.deletes) { onDeleted(current.ok); return }
      setNotice(current.ok)
      setOpen(null); setText('')
      onDone()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  const btn = (color, border) => ({ ...btnOutline, padding: '6px 12px', color, borderColor: border })
  const target = { id: a.id, label: who }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {digits.length >= 7 && (<>
          <a href={`tel:${a.phone}`} style={btn('var(--text-muted)', 'rgba(0,119,182,0.25)')}><Phone size={14} /> Appeler</a>
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" style={btn('var(--text-muted)', 'rgba(0,119,182,0.25)')}><MessageCircle size={14} /> WhatsApp</a>
        </>)}
        {rights.edit && <button onClick={() => onEdit(a)} style={btn('var(--text-muted)', 'rgba(0,119,182,0.25)')}><Pencil size={14} /> Modifier</button>}
        {rights.manage && a.proStatus === 'PENDING' && (<>
          <button onClick={() => toggle('validate')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><CheckCircle size={14} /> Valider</button>
          <button onClick={() => toggle('reject')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><XCircle size={14} /> Refuser</button>
        </>)}
        {rights.manage && a.proStatus === 'ACTIVE' && a.isActive && (
          <button onClick={() => toggle('suspend')} style={btn('#b45309', 'rgba(245,158,11,.45)')}><Ban size={14} /> Suspendre</button>
        )}
        {rights.manage && isSuspended && (
          <button onClick={() => toggle('reactivate')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><RotateCcw size={14} /> Réactiver</button>
        )}
        {isServiceClient && (a.isActive
          ? <button onClick={() => onRequest('DEM_PRO_SUSPEND', target)} style={btn('#b45309', 'rgba(245,158,11,.45)')}><Send size={14} /> Demander une suspension</button>
          : <button onClick={() => onRequest('DEM_PRO_ACTIVATE', target)} style={btn('#15803d', 'rgba(34,197,94,.4)')}><Send size={14} /> Demander une réactivation</button>)}
        {rights.report && <button onClick={() => toggle('report')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Flag size={14} /> Signaler</button>}
        {rights.manage && <button onClick={() => toggle('delete')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Trash2 size={14} /> Supprimer</button>}
      </div>

      {current && (
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{current.title}</div>
          {current.placeholder && (
            <input autoFocus value={text} onChange={e => { setText(e.target.value); setError('') }} placeholder={current.placeholder + (current.required ? '' : ' (facultatif)')} style={{ ...glassInput, width: '100%', boxSizing: 'border-box' }} />
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => toggle(open)} disabled={busy} style={btnOutline}>Retour</button>
            <button onClick={confirm} disabled={busy} style={{ ...btnPrimary, background: current.danger ? '#dc2626' : '#16a34a' }}>
              {busy ? 'En cours…' : current.confirm}
            </button>
          </div>
        </div>
      )}
      {error && <div style={errorStyle}>{error}</div>}
      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '7px 12px', borderRadius: 10 }}>
          <CheckCircle size={14} /> {notice}
        </div>
      )}
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function DemPro() {
  const { user } = useAuth()
  const role = user?.adminRole
  // Valider, suspendre, plan, supprimer, créer : Super uniquement ;
  // modifier : Super + Service Client (PATCH /admin/dem-pro/:id).
  const isSuper = !role || role === 'SUPER'
  const isServiceClient = role === 'SERVICE_CLIENT'
  const rights = {
    manage: isSuper,
    edit:   isSuper || isServiceClient,
    report: canSee(role, ACTION_ROLES.reportUser),
  }

  // Onglet, vue, plan et recherche gardés dans l'adresse.
  const [params, setParams] = useSearchParams()
  const onglet = params.get('onglet')
  const view = onglet === 'offres' || onglet === 'parrainage' ? onglet : 'comptes'
  const status     = VIEWS.some(v => v.key === params.get('statut')) ? params.get('statut') : ''
  const planFilter = PLAN_FILTERS.some(f => f.key === params.get('plan')) ? params.get('plan') : ''
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  useUrlQuery(setSearch)

  function setParam(changes) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    }, { replace: true })
  }
  const setView = v => setParams(v === 'comptes' ? {} : { onglet: v })

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim()
      setParams(prev => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      }, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [search, setParams])

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editTarget, setEditTarget] = useState(null)
  const [requestTarget, setRequestTarget] = useState(null)
  const [detailId, setDetailId] = useState(null) // fiche commerçant ouverte
  const [ficheVersion, setFicheVersion] = useState(0)
  const [pageNotice, setPageNotice] = useState('')

  // Plans attribuables selon le système en vigueur (ancien / nouveaux paliers)
  const [planSystem, setPlanSystem] = useState(null)
  const loadPlanSystem = useCallback(() => {
    api.get('/admin/dem-pro/plans').then(r => setPlanSystem(r.data)).catch(() => setPlanSystem(null))
  }, [])
  useEffect(() => { loadPlanSystem() }, [loadPlanSystem])

  // Sélection multiple — offre/retrait de palier groupé (SUPER uniquement)
  const [selected, setSelected] = useState(new Set())
  const [grantModalOpen, setGrantModalOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState(false)
  const [bulkMessage, setBulkMessage] = useState(null) // { ok, text }

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/dem-pro')
      setAccounts(res.data?.accounts ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  useAutoRefresh(() => fetch(true))

  useEffect(() => {
    if (!pageNotice) return
    const t = setTimeout(() => setPageNotice(''), 6000)
    return () => clearTimeout(t)
  }, [pageNotice])

  function onPlanChanged(id, updated) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...updated, paidPlanActive: a.paidPlanActive && (updated.proPlan ?? 'FREE') !== 'FREE' } : a))
  }

  // Filtres appliqués sur la liste chargée (le serveur renvoie tous les comptes).
  const q = search.trim().toLowerCase()
  const bySearch = accounts.filter(a => !q
    || (a.name ?? '').toLowerCase().includes(q)
    || (a.phone ?? '').includes(q)
    || (a.proBusinessName ?? '').toLowerCase().includes(q))
  const viewTest = VIEWS.find(v => v.key === status).test
  const planTest = PLAN_FILTERS.find(f => f.key === planFilter).test
  const filtered = bySearch.filter(viewTest).filter(planTest)
  const viewCounts = Object.fromEntries(VIEWS.map(v => [v.key, bySearch.filter(planTest).filter(v.test).length]))
  const planCounts = Object.fromEntries(PLAN_FILTERS.map(f => [f.key, bySearch.filter(viewTest).filter(f.test).length]))
  const totalOrders = accounts.reduce((s, a) => s + (a._count?.ordersAsClient ?? 0), 0)

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)))
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
    setBulkMessage(failed > 0
      ? { ok: false, text: `${failed} compte(s) sur ${ids.length} n'ont pas pu être mis à jour.` }
      : { ok: true, text: `Palier offert à ${ids.length} compte(s).` })
  }

  async function bulkRevoke() {
    const ids = [...selected]
    setBulkSaving(true)
    const results = await Promise.allSettled(
      ids.map(id => api.patch(`/admin/dem-pro/${id}/plan`, { plan: 'FREE', status: 'ACTIVE', expiresAt: null }))
    )
    const failed = results.filter(r => r.status === 'rejected').length
    setBulkSaving(false)
    setRevokeConfirm(false)
    setSelected(new Set())
    fetch()
    setBulkMessage(failed > 0
      ? { ok: false, text: `${failed} compte(s) sur ${ids.length} n'ont pas pu être mis à jour.` }
      : { ok: true, text: `Accès payant retiré à ${ids.length} compte(s).` })
  }

  const detailAccount = accounts.find(a => a.id === detailId)

  return (
    <div style={pageWrap}>
      <PageHeader
        title="DEM Pro"
        subtitle={view === 'comptes' ? `${accounts.length.toLocaleString('fr-FR')} compte${accounts.length !== 1 ? 's' : ''} · ${totalOrders.toLocaleString('fr-FR')} commande${totalOrders !== 1 ? 's' : ''} au total (historique)` : null}
        actions={view === 'comptes' ? <>
          <button onClick={() => fetch()} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          {isSuper && <button onClick={() => setEditTarget({})} style={btnPrimary}><Plus size={14} /> Nouveau compte</button>}
        </> : null}
      />

      <TabBar tabs={PAGE_TABS} active={view} onChange={setView} />

      {view === 'comptes' ? (
        <>
        {/* Recherche + vues, puis plan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone ou entreprise…" style={{ ...glassInput, paddingLeft: 36, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
            {VIEWS.map(v => {
              const active = status === v.key
              return (
                <button key={v.key || 'all'} onClick={() => setParam({ statut: v.key })} style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                  background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
                }}>
                  {v.label}<span style={{ marginLeft: 5, opacity: 0.8 }}>{viewCounts[v.key].toLocaleString('fr-FR')}</span>
                </button>
              )
            })}
          </div>
          <select value={planFilter} onChange={e => setParam({ plan: e.target.value })} style={{ ...glassInput, width: 230 }}>
            {PLAN_FILTERS.map(f => <option key={f.key || 'all'} value={f.key}>{f.label}{f.key ? ` (${planCounts[f.key]})` : ''}</option>)}
          </select>
        </div>

        {pageNotice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 10, flexShrink: 0 }}>
            <CheckCircle size={14} /> {pageNotice}
          </div>
        )}

        {/* Barre d'actions groupées — n'apparaît qu'avec une sélection active */}
        {isSuper && (selected.size > 0 || bulkMessage) && (
          <div style={{ ...glass, padding: '10px 16px', marginBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {selected.size > 0 ? (<>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {selected.size} compte{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
              {revokeConfirm ? (<>
                <span style={{ fontSize: 13 }}>Retirer l'accès payant ? Ils repassent immédiatement en Gratuit.</span>
                <button onClick={bulkRevoke} disabled={bulkSaving} style={{ ...btnPrimary, background: 'var(--danger)' }}>{bulkSaving ? 'En cours…' : 'Confirmer'}</button>
                <button onClick={() => setRevokeConfirm(false)} disabled={bulkSaving} style={btnOutline}>Retour</button>
              </>) : (<>
                <button onClick={() => { setBulkMessage(null); setGrantModalOpen(true) }} disabled={bulkSaving} style={{ ...btnPrimary, background: '#6366f1' }}>
                  <Gift size={14} /> Offrir un palier
                </button>
                <button onClick={() => { setBulkMessage(null); setRevokeConfirm(true) }} disabled={bulkSaving} style={{ ...btnOutline, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <Ban size={14} /> Retirer l'accès payant
                </button>
              </>)}
              <button onClick={() => { setSelected(new Set()); setRevokeConfirm(false) }} style={{ ...btnIcon, marginLeft: 'auto' }} title="Désélectionner">
                <XSquare size={16} />
              </button>
            </>) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: bulkMessage.ok ? '#15803d' : 'var(--danger)' }}>{bulkMessage.text}</span>
                <button onClick={() => setBulkMessage(null)} style={{ ...btnIcon, marginLeft: 'auto' }} title="Fermer"><X size={16} /></button>
              </>
            )}
          </div>
        )}

        {/* Table */}
        <div style={pageScroll}>
          <div style={card}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>
                Aucun compte DEM Pro{status || planFilter || q ? ' pour ce filtre' : ''}.
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {isSuper && (
                      <th style={{ ...thStyle, ...stickyTh, width: 30 }}>
                        <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} title="Tout sélectionner" />
                      </th>
                    )}
                    {['Entreprise', 'Téléphone', 'Plan', 'Commandes', 'Statut', 'Inscription'].map((h, i) => (
                      <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh), ...(h === 'Commandes' ? { textAlign: 'center' } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const st = proStatusInfo(a)
                    const isSuspended = !a.isActive && a.proStatus === 'ACTIVE'
                    const sectorColor = SECTOR_COLORS[a.proSector] ?? '#888'
                    return (
                    <tr key={a.id} onClick={() => setDetailId(a.id)} style={{ borderBottom: '1px solid var(--border)', opacity: isSuspended ? 0.6 : 1, cursor: 'pointer' }} title="Ouvrir la fiche">
                      {isSuper && (
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} style={{ cursor: 'pointer' }} />
                        </td>
                      )}
                      <td style={{ ...tdStyle, ...stickyCol }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,rgba(99,102,241,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#6366f1', fontSize: 13, flexShrink: 0 }}>
                            {a.avatar
                              ? <img src={a.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                              : (a.proBusinessName?.trim() || a.name?.trim() || a.phone || '?')[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{a.proBusinessName?.trim() || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              {a.name && <span>{a.name}</span>}
                              {a.proSector && <span style={{ fontWeight: 600, color: sectorColor }}>{SECTOR_LABELS[a.proSector] ?? a.proSector}</span>}
                              {a.proWeeklyVolume && <span>{VOLUME_LABELS[a.proWeeklyVolume] ?? a.proWeeklyVolume}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 13 }}>{a.phone ?? '—'}</td>
                      <td style={tdStyle}><PlanCell account={a} isSuper={isSuper} planSystem={planSystem} onChanged={onPlanChanged} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{a._count?.ordersAsClient ?? 0}</td>
                      <td style={tdStyle}><span style={{ fontSize: 12, fontWeight: 600, color: st.color, whiteSpace: 'nowrap' }}>{st.text}</span></td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </>
      ) : view === 'parrainage' ? (
        <ReferralsTab isSuper={isSuper} />
      ) : (
        <OffersTab isSuper={isSuper} onSystemChange={loadPlanSystem} />
      )}

      {/* Fiche commerçant, avec sa barre d'actions */}
      {detailId && (
        <AccountDetailModal
          accountId={detailId}
          onClose={() => setDetailId(null)}
          canEdit={isSuper || isServiceClient}
          canManageApi={isSuper}
          refreshKey={ficheVersion}
          actions={detailAccount && (
            <ProActions
              key={detailId}
              account={detailAccount}
              rights={rights}
              isServiceClient={isServiceClient}
              onDone={() => { fetch(true); setFicheVersion(v => v + 1) }}
              onEdit={acc => setEditTarget(acc)}
              onRequest={(kind, targetUser) => setRequestTarget({ kind, targetUser })}
              onDeleted={okText => { setDetailId(null); fetch(true); setPageNotice(okText) }}
            />
          )}
        />
      )}

      {/* Modal créer / modifier */}
      {editTarget && (
        <EditModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetch(true); setFicheVersion(v => v + 1); if (!editTarget.id) setPageNotice('Compte DEM Pro créé.') }}
        />
      )}

      {/* Modal demande suspension/réactivation (SERVICE_CLIENT) */}
      {requestTarget && (
        <SubmitRequestModal
          kind={requestTarget.kind}
          targetUser={requestTarget.targetUser}
          onClose={() => setRequestTarget(null)}
          onSubmitted={() => { setRequestTarget(null); setPageNotice('Demande envoyée pour validation.') }}
        />
      )}

      {/* Modal offre promo groupée */}
      {grantModalOpen && (
        <GrantModal
          count={selected.size}
          planSystem={planSystem}
          saving={bulkSaving}
          onClose={() => setGrantModalOpen(false)}
          onConfirm={bulkGrant}
        />
      )}
    </div>
  )
}

const card       = { ...glass, padding: '12px 16px' }
const tableStyle = { width: '100%', minWidth: 760, borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '9px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnTiny    = { padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.6)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }
const inputStyle = { ...glassInput }
const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
