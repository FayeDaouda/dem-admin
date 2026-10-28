import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, X, Plus, Pencil, Trash2, Search, Phone, CheckCircle, XCircle, Briefcase, Flag, MessageCircle, ChevronDown, ChevronUp, Ban } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useUrlQuery } from '../lib/useUrlQuery'
import PageHeader from '../components/PageHeader'
import { canSee, ACTION_ROLES } from '../lib/droits'
import InfoTip from '../components/InfoTip'
import ExportMenu from '../components/ExportMenu'
import { fetchAllPages } from '../lib/exportList'

// Ordre d'affichage : Sans badge en premier, puis progression des tiers.
const CLIENT_BADGE_OPTIONS = [
  ['none',    '🆕 Sans badge'],
  ['classic', '✅ DEM Classic'],
  ['xarit',   '🤝 DEM Xarit'],
  ['mbokk',   '⭐ DEM Mbokk'],
  ['djambar', '🏆 DEM Djambar'],
  ['buur',    '👑 DEM Buur'],
  ['vip',     '💎 DEM VIP'],
]

// Vues de la liste (paramètre status du serveur) — « Tous » exclut les
// comptes supprimés, consultables dans leur propre vue.
const VIEWS = [
  { key: '',         label: 'Tous' },
  { key: 'active',   label: 'Actifs' },
  { key: 'inactive', label: 'Inactifs' },
  { key: 'banned',   label: 'Bannis' },
  { key: 'deleted',  label: 'Supprimés' },
]

const fmtDate = v => (v ? new Date(v).toLocaleDateString('fr-FR') : '—')

const PERIOD_LABELS = { today: "Inscrits aujourd'hui", '7d': 'Inscrits sur 7 jours', '30d': 'Inscrits sur 30 jours' }
const ORDERS_LABELS = { some: 'Avec courses', none: 'Sans course' }
const badgeText = key => CLIENT_BADGE_OPTIONS.find(([k]) => k === key)?.[1].replace(/^\S+\s/, '') ?? null

const statusText = (c, deleted) => deleted ? 'Supprimé' : c.isBanned ? 'Banni' : c.isActive ? 'Actif' : 'Inactif'
const STATUS_COLORS = { Supprimé: '#475569', Banni: '#dc2626', Actif: '#15803d', Inactif: '#b45309' }

// Colonnes des exports PDF / Word / Excel
const EXPORT_COLUMNS = [
  { header: 'Client',      key: 'name',      width: 2.2 },
  { header: 'Téléphone',   key: 'phone',     width: 1.4 },
  { header: 'E-mail',      key: 'email',     width: 2 },
  { header: 'Badge',       key: 'badge',     width: 1.3 },
  { header: 'Courses',     key: 'orders',    width: 0.9, type: 'number', align: 'center' },
  { header: 'Inscription', key: 'createdAt', width: 1.1, type: 'date' },
  { header: 'Statut',      key: 'status',    width: 1, color: r => STATUS_COLORS[r.status] },
]

function StatusPill({ client, deleted }) {
  const s = deleted       ? { bg: 'rgba(100,116,139,.14)', color: '#475569', label: 'Supprimé' }
    : client.isBanned     ? { bg: 'rgba(239,68,68,.12)',   color: '#dc2626', label: 'Banni' }
    : client.isActive     ? { bg: 'rgba(34,197,94,.12)',   color: '#15803d', label: 'Actif' }
    :                       { bg: 'rgba(245,158,11,.14)',  color: '#b45309', label: 'Inactif' }
  return <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
}

function Avatar({ client, size = 34 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,rgba(12,184,222,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {client.avatar
        ? <img src={client.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontWeight: 700, color: '#0671BA', fontSize: size * 0.38 }}>{(client.name ?? client.phone ?? '?')[0].toUpperCase()}</span>}
    </div>
  )
}

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
    <div style={{ ...overlay, zIndex: 120 }} onClick={onClose}>
      <div style={{ ...glass, background: 'rgba(255,255,255,0.97)', width: 420, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
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
          <button onClick={onClose} style={{ ...btnOutline, flex: 1, justifyContent: 'center' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Wallet client (06/10) ────────────────────────────────────────────────────
// GET /admin/clients/:id/wallet — solde, part retirable (remboursements),
// derniers mouvements. Lecture seule.
const WALLET_TX_LABELS = {
  CREDIT_TOPUP: 'Recharge', DEBIT_ORDER: 'Course payée', CREDIT_REFUND: 'Remboursement', DEBIT_CASHOUT: 'Retrait',
}

function ClientWalletBox({ clientId }) {
  const [wallet, setWallet] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.get(`/admin/clients/${clientId}/wallet`)
      .then(r => { if (!cancelled) setWallet(r.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId])
  if (!wallet) return null
  const fmt = n => `${Math.round(n).toLocaleString('fr-FR')} F`
  return (
    <FicheSection title="Wallet" aside={`dont ${fmt(wallet.withdrawable)} retirable (remboursements)`}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(wallet.balance)}</div>
      {wallet.transactions.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun mouvement.</div>
      ) : wallet.transactions.slice(0, 8).map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
          <span>
            <strong>{WALLET_TX_LABELS[t.type] ?? t.type}</strong>
            <span style={{ color: 'var(--text-muted)' }}> · {new Date(t.createdAt).toLocaleDateString('fr-FR')}{t.needsManualReview ? ' · à vérifier' : ''}</span>
          </span>
          <span style={{ fontWeight: 700, color: t.amount >= 0 ? 'var(--success)' : 'var(--text)' }}>{t.amount >= 0 ? '+' : ''}{fmt(t.amount)}</span>
        </div>
      ))}
    </FicheSection>
  )
}

// ── Fiche client : informations à gauche, contact et actions à droite ────────
function ClientFiche({ client, deleted, rights, onClose, onEdit, onChanged }) {
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [open, setOpen]       = useState(null)   // action dépliée : 'pro' | 'ban' | 'delete' | 'report'
  const [text, setText]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/clients/${client.id}`)
      .then(r => { if (!cancelled) setDetail(r.data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [client.id, reloadKey])

  const d = detail ?? client
  const digits = (d.phone ?? '').replace(/[^\d]/g, '')

  function toggle(action) {
    setOpen(o => (o === action ? null : action))
    setText('')
    setError('')
  }

  async function run(request, okText) {
    setBusy(true); setError('')
    try {
      await request()
      setNotice(okText)
      setOpen(null); setText('')
      setReloadKey(k => k + 1)
      onChanged()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  const who = d.name ?? d.phone
  const actions = {
    pro: {
      title: 'Convertir en DEM Pro',
      placeholder: "Nom de l'entreprise",
      required: true,
      confirm: 'Convertir',
      go: v => run(() => api.patch(`/admin/clients/${d.id}`, { role: 'DEM_PRO', proStatus: 'ACTIVE', proBusinessName: v }), `${who} est maintenant DEM Pro.`),
    },
    ban: d.isBanned ? {
      title: `Débannir ${who} ?`,
      confirm: 'Débannir',
      go: () => run(() => api.patch(`/admin/clients/${d.id}/unban`, {}), `${who} est débanni.`),
    } : {
      title: `Bannir ${who} ?`,
      placeholder: 'Motif (facultatif)',
      confirm: 'Bannir',
      danger: true,
      go: v => run(() => api.patch(`/admin/clients/${d.id}/ban`, { reason: v || 'Banni par admin' }), `${who} est banni.`),
    },
    delete: {
      title: `Supprimer ${who} ? Le compte sera désactivé et son numéro libéré — son historique (commandes, transactions...) reste conservé.`,
      confirm: 'Supprimer',
      danger: true,
      go: () => run(() => api.delete(`/admin/clients/${d.id}`), `${who} est supprimé.`),
    },
    report: {
      title: 'Signaler ce client',
      placeholder: 'Motif du signalement',
      required: true,
      confirm: 'Envoyer le signalement',
      danger: true,
      go: v => run(() => api.post('/admin/report-user', { userId: d.id, userRole: 'CLIENT', reason: v }), 'Signalement envoyé (incident ouvert).'),
    },
  }
  const current = open ? actions[open] : null

  function confirmCurrent() {
    const v = text.trim()
    if (current.required && !v) { setError('Ce champ est obligatoire.'); return }
    current.go(v)
  }

  const canPro = rights.manage && !deleted && (detail?.role ?? 'CLIENT') === 'CLIENT'

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        {/* En-tête de la fiche */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <Avatar client={d} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{d.name ?? '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.phone ?? '—'}</div>
          </div>
          <StatusPill client={d} deleted={deleted} />
          <button onClick={onClose} style={btnIcon} title="Fermer"><X size={18} /></button>
        </div>

        {notice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
            <CheckCircle size={14} /> {notice}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Chargement…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0 28px' }}>
            {/* Colonne gauche : informations, wallet, commandes */}
            <div>
              <FicheSection title="Informations">
                <Row label="Email" value={d.email ?? '—'} />
                <Row label="Inscrit le" value={fmtDate(d.createdAt)} />
                <Row label="Vérifié" value={d.isVerified ? '✓ Oui' : 'Non'} />
                <Row label="Code parrain" value={d.referralCode ?? '—'} />
                <Row label="Adresses fav." value={`${d._count?.favoriteAddresses ?? 0} / 6`} />
              </FicheSection>

              <ClientWalletBox clientId={client.id} />

              {detail?.ordersAsClient?.length > 0 && (
                <FicheSection
                  title="Commandes récentes"
                  // Totaux sur tout l'historique (serveur), pas sur la liste affichée
                  aside={<>{detail.deliveredCount ?? 0} livrée{(detail.deliveredCount ?? 0) > 1 ? 's' : ''} / {detail.ordersCount ?? 0} commande{(detail.ordersCount ?? 0) > 1 ? 's' : ''} · Total payé : <strong>{(detail.totalSpent ?? 0).toLocaleString()} F</strong></>}
                >
                  {detail.ordersAsClient.slice(0, 5).map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: o.status === 'DELIVERED' ? '#22c55e' : o.status === 'CANCELLED' ? '#ef4444' : '#f59e0b' }} />
                      <span style={{ flex: 1, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.deliveryAddress ?? o.pickupAddress ?? '—'}
                      </span>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{(o.price ?? 0).toLocaleString()} F</span>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDate(o.createdAt)}</span>
                    </div>
                  ))}
                </FicheSection>
              )}
            </div>

            {/* Colonne droite : contact et actions */}
            <div>
              <FicheSection title="Contact">
                {digits.length >= 7 ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`tel:${d.phone}`} style={btnOutline}><Phone size={14} /> Appeler</a>
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" style={btnOutline}><MessageCircle size={14} /> WhatsApp</a>
                  </div>
                ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pas de numéro.</span>}
              </FicheSection>

              {!deleted && (rights.edit || rights.manage || rights.report) && (
                <FicheSection title="Actions">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {rights.edit && <button onClick={() => onEdit(d)} style={btnOutline}><Pencil size={14} /> Modifier</button>}
                    {canPro && <button onClick={() => toggle('pro')} style={{ ...btnOutline, color: '#7c3aed', borderColor: 'rgba(124,58,237,.35)' }}><Briefcase size={14} /> Convertir en DEM Pro</button>}
                    {rights.manage && (
                      <button onClick={() => toggle('ban')} style={{ ...btnOutline, color: d.isBanned ? '#15803d' : '#b45309', borderColor: d.isBanned ? 'rgba(34,197,94,.4)' : 'rgba(245,158,11,.45)' }}>
                        <Ban size={14} /> {d.isBanned ? 'Débannir' : 'Bannir'}
                      </button>
                    )}
                    {rights.report && <button onClick={() => toggle('report')} style={{ ...btnOutline, color: '#dc2626', borderColor: 'rgba(239,68,68,.35)' }}><Flag size={14} /> Signaler</button>}
                    {rights.manage && <button onClick={() => toggle('delete')} style={{ ...btnOutline, color: '#dc2626', borderColor: 'rgba(239,68,68,.35)' }}><Trash2 size={14} /> Supprimer</button>}
                  </div>

                  {current && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{current.title}</div>
                      {current.placeholder && (
                        <input autoFocus value={text} onChange={e => { setText(e.target.value); setError('') }} placeholder={current.placeholder} style={inputStyle} />
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => toggle(open)} disabled={busy} style={btnOutline}>Retour</button>
                        <button onClick={confirmCurrent} disabled={busy} style={{ ...btnPrimary, background: current.danger ? '#dc2626' : 'var(--primary)' }}>
                          {busy ? 'En cours…' : current.confirm}
                        </button>
                      </div>
                    </div>
                  )}
                  {error && <div style={errorStyle}>{error}</div>}
                </FicheSection>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Demandes de changement de numéro : bandeau repliable ─────────────────────
function PhoneRequests({ requests, canDecide, onDecided }) {
  const [open, setOpen]         = useState(false)
  const [resolving, setResolving] = useState(null)
  const [errors, setErrors]     = useState({})

  async function resolve(id, approve) {
    setResolving(id)
    setErrors(e => ({ ...e, [id]: null }))
    try {
      await api.patch(`/admin/clients/${id}/phone-change`, { approve })
      onDecided()
    } catch (e) {
      setErrors(er => ({ ...er, [id]: e.response?.data?.message ?? 'Erreur.' }))
    } finally { setResolving(null) }
  }

  if (requests.length === 0) return null
  return (
    <div style={{ ...glass, padding: '10px 16px', marginBottom: 14, flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)' }}>
        <Phone size={15} color="#b45309" />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>
          {requests.length} demande{requests.length > 1 ? 's' : ''} de changement de numéro
        </span>
        {!canDecide && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· décision du Super Admin</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', display: 'flex' }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 140 }}>{r.name ?? '—'}</span>
              <span style={{ fontFamily: 'monospace' }}>{r.phone}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{r.pendingPhone ?? '—'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(r.phoneChangeRequestedAt)}</span>
              {canDecide && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  {resolving === r.id ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>En cours…</span> : (<>
                    <button onClick={() => resolve(r.id, true)} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}><CheckCircle size={13} /> Approuver</button>
                    <button onClick={() => resolve(r.id, false)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}><XCircle size={13} /> Refuser</button>
                  </>)}
                </div>
              )}
              {errors[r.id] && <div style={{ ...errorStyle, width: '100%' }}>{errors[r.id]}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
const LIMIT = 50

export default function Clients() {
  const { user } = useAuth()
  const role = user?.adminRole
  const rights = {
    create: canSee(role, ACTION_ROLES.clientCreate),
    edit:   canSee(role, ACTION_ROLES.clientEdit),
    manage: canSee(role, ACTION_ROLES.clientManage),
    report: canSee(role, ACTION_ROLES.reportUser),
    export: canSee(role, ACTION_ROLES.listExport),
  }

  // Vue, filtres et recherche gardés dans l'adresse : un lien ou un
  // rechargement rouvre la même liste. ?q= vient aussi de la recherche globale.
  const [params, setParams] = useSearchParams()
  const status      = VIEWS.some(v => v.key === params.get('statut')) ? params.get('statut') : ''
  const period      = params.get('inscription') ?? ''
  const hasOrders   = params.get('courses') ?? ''
  const badgeFilter = params.get('badge') ?? 'all'
  const sortByCourses = params.get('tri') === 'courses'
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  useUrlQuery(setSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())

  const [clients, setClients]   = useState([])
  const [total, setTotal]       = useState(0)
  const [counts, setCounts]     = useState({})
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState(null)
  const [formTarget, setFormTarget] = useState(null) // null=fermé, {}=créer, {id,...}=modifier
  const [phoneReqs, setPhoneReqs]   = useState([])
  const [ficheKey, setFicheKey]     = useState(0)

  // Plusieurs paramètres changés en une seule fois (sinon le second écrase le premier).
  function setParam(changes) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    }, { replace: true })
    setPage(1)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim()
      setDebouncedSearch(q)
      setPage(1)
      setParams(prev => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      }, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [search, setParams])

  const fetchPhoneRequests = useCallback(() => {
    api.get('/admin/clients/phone-requests')
      .then(res => setPhoneReqs(res.data?.requests ?? []))
      .catch(e => console.error(e))
  }, [])

  // Liste (filtres appliqués par le serveur sur TOUS les clients) et nombre
  // de clients par vue, avec les mêmes filtres.
  const lastRequest = useRef(0)
  const fetch = useCallback(async (silent = false) => {
    const requestId = ++lastRequest.current
    if (!silent) setLoading(true)
    const base = {}
    if (debouncedSearch)      base.search = debouncedSearch
    if (period)               base.period = period
    if (hasOrders)            base.hasOrders = hasOrders
    if (badgeFilter !== 'all') base.badge = badgeFilter // filtré par le serveur, sur tous les clients
    try {
      const listParams = { ...base, page, limit: LIMIT }
      if (status)        listParams.status = status
      if (sortByCourses) listParams.sortBy = 'courses'
      const [list, ...countRes] = await Promise.all([
        api.get('/admin/clients', { params: listParams }),
        ...VIEWS.map(v => api.get('/admin/clients', { params: { ...base, limit: 1, ...(v.key ? { status: v.key } : {}) } }).catch(() => null)),
      ])
      if (requestId !== lastRequest.current) return // réponse périmée
      setClients(Array.isArray(list.data?.clients) ? list.data.clients : (Array.isArray(list.data) ? list.data : []))
      setTotal(list.data?.total ?? 0)
      setCounts(Object.fromEntries(VIEWS.map((v, i) => [v.key, countRes[i]?.data?.total])))
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent && requestId === lastRequest.current) setLoading(false)
    }
  }, [page, status, period, hasOrders, badgeFilter, sortByCourses, debouncedSearch])

  useEffect(() => { fetch(); fetchPhoneRequests() }, [fetch, fetchPhoneRequests])
  useAutoRefresh(() => { fetch(true); fetchPhoneRequests() })

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const hasFilters = !!(debouncedSearch || status || period || hasOrders || badgeFilter !== 'all')
  const deletedView = status === 'deleted'

  // Export : tous les clients de la vue (pas seulement la page affichée)
  async function exportSpec() {
    const params = {}
    if (debouncedSearch)       params.search = debouncedSearch
    if (period)                params.period = period
    if (hasOrders)             params.hasOrders = hasOrders
    if (badgeFilter !== 'all') params.badge = badgeFilter
    if (status)                params.status = status
    if (sortByCourses)         params.sortBy = 'courses'
    const all = await fetchAllPages(api, '/admin/clients', params, 'clients')
    const view = VIEWS.find(v => v.key === status)
    return {
      title: deletedView ? 'Clients supprimés' : 'Liste des clients',
      fileBase: `clients${status ? '-' + view.label.toLowerCase() : ''}`,
      unit: { one: 'client', plural: 'clients' },
      filters: [
        status && `Vue : ${view.label}`,
        PERIOD_LABELS[period],
        ORDERS_LABELS[hasOrders],
        badgeFilter !== 'all' && `Badge : ${badgeText(badgeFilter)}`,
        debouncedSearch && `Recherche : « ${debouncedSearch} »`,
        sortByCourses && 'Triés par nombre de courses',
      ].filter(Boolean),
      columns: EXPORT_COLUMNS,
      rows: all.map(c => ({
        name: c.name?.trim() || null,
        phone: c.phone,
        email: c.email,
        badge: badgeText(c.clientBadge),
        orders: c._count?.ordersAsClient ?? 0,
        createdAt: c.createdAt,
        status: statusText(c, deletedView),
      })),
    }
  }

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Clients"
        subtitle={`${total.toLocaleString('fr-FR')} client${total !== 1 ? 's' : ''} dans cette vue`}
        actions={<>
          <button onClick={() => { fetch(); fetchPhoneRequests() }} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          {rights.export && <ExportMenu getSpec={exportSpec} disabled={loading || total === 0} />}
          {rights.create && <button onClick={() => setFormTarget({})} style={btnPrimary}><Plus size={14} /> Nouveau client</button>}
        </>}
      />

      <PhoneRequests requests={phoneReqs} canDecide={rights.manage} onDecided={fetchPhoneRequests} />

      {/* Recherche + vues, puis filtres secondaires */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom ou téléphone…"
            style={{ ...glassInput, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {VIEWS.map(v => {
            const active = status === v.key
            return (
              <button key={v.key || 'all'} onClick={() => setParam({ statut: v.key })} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
              }}>
                {v.label}{counts[v.key] != null && <span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[v.key].toLocaleString('fr-FR')}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <select value={period} onChange={e => setParam({ inscription: e.target.value })} style={{ ...glassInput, width: 190 }}>
          <option value="">Inscription : toujours</option>
          <option value="today">Inscrits aujourd'hui</option>
          <option value="7d">Inscrits sur 7 jours</option>
          <option value="30d">Inscrits sur 30 jours</option>
        </select>
        <select value={hasOrders} onChange={e => setParam({ courses: e.target.value })} style={{ ...glassInput, width: 170 }}>
          <option value="">Courses : tous</option>
          <option value="some">Avec courses</option>
          <option value="none">Sans course</option>
        </select>
        <select value={badgeFilter} onChange={e => setParam({ badge: e.target.value === 'all' ? '' : e.target.value })} style={{ ...glassInput, width: 170 }}>
          <option value="all">Badge : tous</option>
          {CLIENT_BADGE_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {(period || hasOrders || badgeFilter !== 'all') && (
          <button onClick={() => setParam({ inscription: '', courses: '', badge: '' })} style={{ ...btnSmall, border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 600 }}>
            Effacer les filtres
          </button>
        )}
      </div>

      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun client{hasFilters ? ' pour ce filtre' : ''}.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Client', 'Téléphone', 'Courses', 'Inscription', 'Statut'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...thStyle, ...(i === 0 ? stickyThCol : stickyTh),
                      ...(h === 'Courses' ? { cursor: 'pointer', userSelect: 'none', textAlign: 'center' } : {}),
                    }}
                    onClick={h === 'Courses' ? () => setParam({ tri: sortByCourses ? '' : 'courses' }) : undefined}
                    title={h === 'Courses' ? 'Trier par nombre de courses' : undefined}
                  >
                    {h}{h === 'Courses' && (sortByCourses ? ' ▼' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} title="Ouvrir la fiche">
                  <td style={{ ...tdStyle, ...stickyCol }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar client={c} />
                      <span style={{ fontWeight: 600 }}>{c.name ?? '—'}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13 }}>{c.phone ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{c._count?.ordersAsClient ?? 0}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(c.createdAt)}</td>
                  <td style={tdStyle}><StatusPill client={c} deleted={deletedView} /></td>
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

      {selected && (
        <ClientFiche
          key={ficheKey}
          client={selected}
          deleted={deletedView}
          rights={rights}
          onClose={() => setSelected(null)}
          onEdit={c => setFormTarget(c)}
          onChanged={() => fetch(true)}
        />
      )}

      {formTarget !== null && (
        <ClientFormModal
          initial={formTarget.id ? formTarget : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null)
            fetch(true)
            setFicheKey(k => k + 1) // fiche ouverte : relit les informations modifiées
          }}
        />
      )}
    </div>
  )
}

function FicheSection({ title, aside, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{title}<InfoTip k={title} size={12} /></div>
        {aside && <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{aside}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const overlay      = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox     = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '20px 24px', width: 860, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }
const card         = { ...glass, padding: '12px 16px' }
const tableStyle   = { width: '100%', minWidth: 620, borderCollapse: 'collapse' }
const thStyle      = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle      = { padding: '9px 10px', verticalAlign: 'middle' }
const labelStyle   = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle   = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle   = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }
const btnPrimary   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall     = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }
const btnIcon      = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
