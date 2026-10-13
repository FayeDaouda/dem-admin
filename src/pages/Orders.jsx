import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { canSee, ACTION_ROLES } from '../lib/droits'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import { RefreshCw, Search, X, MapPin, Phone, MessageCircle, Copy, Check } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'
import DocThumb from '../components/DocThumb'
import { useUrlQuery } from '../lib/useUrlQuery'
import { cancelReasonLabel } from '../lib/cancelReasons'

// Montant payé par le client = part coursier (price) + frais DEM − réduction
// (même calcul que l'app : core/utils/price_format.dart:clientChargeFor).
const clientCharge = o => Math.max(0, (o.price ?? 0) + (o.demFee ?? 0) - (o.discountAmount ?? 0))

const firstNonEmpty = (...values) => values.find(v => typeof v === 'string' && v.trim() !== '') ?? '—'

// DEM Pro : on affiche le nom de l'entreprise plutôt que le nom du responsable.
const clientDisplayName = (client, clientName, clientPhone) =>
  client?.role === 'DEM_PRO' && client?.proBusinessName?.trim()
    ? client.proBusinessName
    : firstNonEmpty(client?.name, clientName, client?.phone, clientPhone)

// Groupes de statut : mêmes clés que le serveur (admin.orders.service.js,
// ORDER_STATUS_GROUPS) — « En cours » = acceptée, récupérée ou en transit.
const FILTERS = [
  { key: 'all',       label: 'Toutes' },
  { key: 'scheduled', label: 'Programmées' },
  { key: 'pending',   label: 'En attente' },
  { key: 'active',    label: 'En cours' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
]

const LIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
const LATE_MIN = 5 // au-delà, une course en attente s'affiche en orange (comme le Dashboard)

const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtTime = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null

function minutesSince(date) {
  return date ? Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000)) : null
}

function formatDuration(min) {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${Math.floor(h / 24)} j ${h % 24} h`
}

export default function Orders() {
  const { user } = useAuth()
  const role = user?.adminRole
  const canDispatch = canSee(role, ACTION_ROLES.orderDispatch)
  const canCancel   = canSee(role, ACTION_ROLES.orderCancel)
  const canMarkPaid = canSee(role, ACTION_ROLES.orderMarkPaid)
  const LIMIT = 50

  // Filtre et recherche gardés dans l'adresse (?statut=…&q=…) : un lien ou un
  // rechargement rouvre la même liste. ?q= vient aussi de la recherche globale.
  const [params, setParams] = useSearchParams()
  const statusFilter = FILTERS.some(f => f.key === params.get('statut')) ? params.get('statut') : 'all'
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  useUrlQuery(setSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())

  const [orders, setOrders]   = useState([])
  const [total, setTotal]     = useState(0)
  const [counts, setCounts]   = useState({})
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice]   = useState(null) // message de la page (après une action)

  const [detail, setDetail]   = useState(null)
  const [confirming, setConfirming] = useState(null) // 'paid' | 'redispatch'
  const [busy, setBusy]       = useState(false)
  const [actionError, setActionError] = useState('')
  const [driverPicker, setDriverPicker] = useState(null) // { drivers, loading, error }
  const [cancelReasons, setCancelReasons] = useState(null)
  const [cancelPicker, setCancelPicker]   = useState(null) // { orderId, code, note }

  function setFilter(key) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === 'all') next.delete('statut')
      else next.set('statut', key)
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

  // Liste (statut + recherche appliqués par le serveur sur TOUTES les commandes)
  // et nombre de courses par filtre, pour la même recherche.
  const lastRequest = useRef(0)
  const fetch = useCallback(async (silent = false) => {
    const requestId = ++lastRequest.current
    if (!silent) setLoading(true)
    const base = debouncedSearch ? { search: debouncedSearch } : {}
    try {
      const listParams = { ...base, page, limit: LIMIT }
      if (statusFilter !== 'all') listParams.group = statusFilter
      const [list, ...countRes] = await Promise.all([
        api.get('/admin/orders', { params: listParams }),
        ...FILTERS.map(f => api.get('/admin/orders', { params: { ...base, limit: 1, ...(f.key === 'all' ? {} : { group: f.key }) } }).catch(() => null)),
      ])
      if (requestId !== lastRequest.current) return // réponse périmée
      setOrders(Array.isArray(list.data?.orders) ? list.data.orders : [])
      setTotal(list.data?.total ?? 0)
      setCounts(Object.fromEntries(FILTERS.map((f, i) => [f.key, countRes[i]?.data?.total])))
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent && requestId === lastRequest.current) setLoading(false)
    }
  }, [page, statusFilter, debouncedSearch])

  useEffect(() => { fetch() }, [fetch])
  useAutoRefresh(() => fetch(true))

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  // ── Fiche ──
  // Affichage immédiat avec la ligne de la liste, puis complétée par
  // GET /admin/orders/:id (origine de la réduction, etc.)
  const openDetail = (o) => {
    setDetail(o)
    setConfirming(null)
    setActionError('')
    api.get(`/admin/orders/${o.id}`)
      .then(res => setDetail(prev => (prev?.id === o.id ? { ...prev, ...res.data } : prev)))
      .catch(() => {})
  }

  const closeDetail = () => { if (!busy) { setDetail(null); setConfirming(null); setActionError('') } }

  async function runAction(fn) {
    setBusy(true)
    setActionError('')
    try { await fn() }
    catch (e) { setActionError(e.response?.data?.message ?? 'L’action a échoué. Réessayez.') }
    finally { setBusy(false) }
  }

  const markPaid = () => runAction(async () => {
    await api.patch(`/admin/orders/${detail.id}/payment`, { paymentStatus: 'PAID' })
    setDetail(prev => prev ? { ...prev, paymentStatus: 'PAID' } : prev)
    setConfirming(null)
    fetch(true)
  })

  const redispatch = () => runAction(async () => {
    await api.patch(`/admin/orders/${detail.id}/redispatch`)
    setDetail(prev => prev ? { ...prev, status: 'PENDING', driver: null } : prev)
    setConfirming(null)
    fetch(true)
  })

  const openDriverPicker = async () => {
    setDriverPicker({ drivers: [], loading: true, error: null })
    try {
      const res = await api.get(`/admin/orders/${detail.id}/assignable-drivers`)
      setDriverPicker({ drivers: res.data?.drivers ?? [], loading: false, error: null })
    } catch (e) {
      setDriverPicker({ drivers: [], loading: false, error: e.response?.data?.message ?? 'Erreur de chargement des coursiers.' })
    }
  }

  const assignDriver = async (driverId) => {
    setBusy(true)
    try {
      const res = await api.patch(`/admin/orders/${detail.id}/reassign`, { driverId })
      setDetail(res.data?.order ?? null)
      setDriverPicker(null)
      fetch(true)
    } catch (e) {
      setDriverPicker(p => p ? { ...p, error: e.response?.data?.message ?? 'Erreur lors de l’attribution du coursier' } : p)
    } finally { setBusy(false) }
  }

  const suggestDriver = async (driverId) => {
    setBusy(true)
    try {
      const res = await api.patch(`/admin/orders/${detail.id}/suggest`, { driverId })
      setNotice({ ok: true, text: res.data?.message ?? 'Course suggérée au coursier.' })
      setDriverPicker(null)
      setDetail(null)
      fetch(true)
    } catch (e) {
      setDriverPicker(p => p ? { ...p, error: e.response?.data?.message ?? 'Erreur lors de la suggestion au coursier' } : p)
    } finally { setBusy(false) }
  }

  // Le motif d'annulation détermine le message envoyé au client/coursier —
  // toujours choisi dans une liste préparée par le backend (jamais de texte
  // libre affiché tel quel), voir dem-backend/admin-cancel-reasons.js.
  const openCancelPicker = async () => {
    setCancelPicker({ orderId: detail.id, code: '', note: '', error: '' })
    if (cancelReasons) return
    try {
      const res = await api.get('/admin/orders/cancel-reasons')
      setCancelReasons(res.data?.reasons ?? [])
    } catch {
      setCancelReasons([])
    }
  }

  const confirmCancelOrder = async () => {
    if (!cancelPicker?.code) return
    setBusy(true)
    try {
      await api.patch(`/admin/orders/${cancelPicker.orderId}/cancel`, { reasonCode: cancelPicker.code, note: cancelPicker.note || undefined })
      setCancelPicker(null)
      setDetail(null)
      setNotice({ ok: true, text: 'Course annulée.' })
      fetch(true)
    } catch (e) {
      setCancelPicker(p => p ? { ...p, error: e.response?.data?.message ?? 'Erreur lors de l’annulation' } : p)
    } finally { setBusy(false) }
  }

  // Actions possibles sur la course ouverte (droits d'affichage = droits serveur)
  const actions = detail ? [
    canDispatch && detail.status === 'PENDING' && !detail.driver && { key: 'pick', label: 'Choisir un coursier', color: '#0077b6', onClick: openDriverPicker },
    canDispatch && detail.status === 'ACCEPTED' && { key: 'redispatch', label: 'Relancer la recherche', color: '#f97316', onClick: () => setConfirming('redispatch') },
    canMarkPaid && detail.status === 'DELIVERED' && detail.paymentStatus === 'PENDING' && { key: 'paid', label: 'Marquer payé', color: '#16a34a', onClick: () => setConfirming('paid') },
    canCancel && !['DELIVERED', 'CANCELLED'].includes(detail.status) && { key: 'cancel', label: 'Annuler la course', color: '#dc2626', onClick: openCancelPicker },
  ].filter(Boolean) : []

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Courses"
        subtitle="Toutes les commandes, du plus récent au plus ancien"
        actions={<button onClick={() => fetch()} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      {notice && (
        <div style={{ ...glass, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: notice.ok ? '#15803d' : '#dc2626', flexShrink: 0 }}>
          <span style={{ flex: 1 }}>{notice.text}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>
      )}

      {/* Recherche + filtres de statut, sur une ligne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 320px', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ID, client, coursier, adresse…"
            style={{ ...glassInput, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {FILTERS.map(f => {
            const active = statusFilter === f.key
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
              }}>
                {f.label}{counts[f.key] != null && <span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[f.key].toLocaleString('fr-FR')}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={pageScroll}>
        <div style={card}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          ) : orders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucune course pour ce filtre.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['ID', 'Type', 'Statut', 'Client', 'Coursier', 'Trajet', 'Prix client', 'Paiement', 'Créée le'].map((h, i) => (
                    <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const live = LIVE_STATUSES.includes(o.status)
                  const since = live ? minutesSince(o.status === 'PENDING' ? o.createdAt : (o.acceptedAt ?? o.createdAt)) : null
                  const late = o.status === 'PENDING' && since >= LATE_MIN
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => openDetail(o)}>
                      <td style={{ ...tdStyle, ...stickyCol }}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.id.slice(0, 8)}</code></td>
                      <td style={tdStyle}><Badge status={o.orderType} /></td>
                      <td style={tdStyle}><Badge status={o.status} /></td>
                      <td style={tdStyle}>{clientDisplayName(o.client, o.clientName, o.clientPhone)}</td>
                      <td style={tdStyle}>{firstNonEmpty(o.driver?.name, o.driver?.phone)}</td>
                      <td style={{ ...tdStyle, fontSize: 12, maxWidth: 240 }} title={`${o.pickupAddress} → ${o.deliveryAddress}`}>
                        <div style={ellipsis}>{o.pickupAddress}</div>
                        <div style={{ ...ellipsis, color: 'var(--text-muted)' }}>→ {o.deliveryAddress}</div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{clientCharge(o).toLocaleString('fr-FR')} F</td>
                      {/* Le paiement n'a de sens qu'une fois la course livrée */}
                      <td style={tdStyle}>{o.status === 'DELIVERED' ? <Badge status={o.paymentStatus ?? 'PENDING'} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ ...tdStyle, fontSize: 12, whiteSpace: 'nowrap' }}>
                        <div style={{ color: 'var(--text-muted)' }}>{fmtDate(o.createdAt)}</div>
                        {live && <div style={{ fontWeight: late ? 700 : 500, color: late ? '#f59e0b' : 'var(--text-muted)' }}>{o.status === 'PENDING' ? 'attend' : 'en cours'} depuis {formatDuration(since)}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Page {page} / {totalPages} — {total.toLocaleString('fr-FR')} course{total > 1 ? 's' : ''}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      </div>

      {/* ── Fiche d'une course : en-tête, actions, puis deux colonnes ── */}
      {detail && (
        <div style={overlay} onClick={closeDetail}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Course <code style={{ fontSize: 13, color: 'var(--text-muted)' }}>{detail.id.slice(0, 8)}</code>
                  <CopyButton text={detail.id} />
                </h2>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <Badge status={detail.orderType} />
                  <Badge status={detail.status} />
                  {detail.status === 'DELIVERED' && <Badge status={detail.paymentStatus ?? 'PENDING'} />}
                  {detail.batchOrderId && <span style={pill}>Tournée DEM Pro</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{clientCharge(detail).toLocaleString('fr-FR')} F</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>prix client · créée le {fmtDate(detail.createdAt)}</div>
                </div>
                <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>
            </div>

            {/* Actions, en haut */}
            {actions.length > 0 && !confirming && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {actions.map(a => (
                  <button key={a.key} onClick={a.onClick} disabled={busy} style={{ ...btnOutline, color: a.color, borderColor: a.color, background: a.color + '14', fontWeight: 600 }}>{a.label}</button>
                ))}
              </div>
            )}

            {/* Confirmation dans la fiche (plus de fenêtre du navigateur) */}
            {confirming && (
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {confirming === 'paid'
                    ? `Marquer le paiement de ${clientCharge(detail).toLocaleString('fr-FR')} F comme reçu ?`
                    : 'Relancer la recherche ? Le coursier actuel sera retiré et un nouveau coursier sera cherché automatiquement.'}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setConfirming(null)} disabled={busy} style={btnOutline}>Retour</button>
                  <button onClick={confirming === 'paid' ? markPaid : redispatch} disabled={busy} style={{ ...btnOutline, color: '#fff', background: confirming === 'paid' ? '#16a34a' : '#f97316', borderColor: 'transparent', fontWeight: 600 }}>
                    {busy ? 'En cours…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
            {actionError && <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 12 }}>{actionError}</div>}

            <div className="fiche-cols">
              {/* Colonne gauche : déroulé de la course */}
              <div>
                <FicheSection title="Chronologie">
                  <Timeline order={detail} />
                </FicheSection>

                <FicheSection title="Trajet">
                  <Place label="Départ" address={detail.pickupAddress} lat={detail.pickupLatitude} lng={detail.pickupLongitude} />
                  <Place label="Arrivée" address={detail.deliveryAddress} lat={detail.deliveryLatitude} lng={detail.deliveryLongitude} />
                  {(detail.description || detail.weight) && (
                    <Row label="Colis" value={[detail.description, detail.weight ? `${detail.weight} kg` : null].filter(Boolean).join(' · ')} />
                  )}
                </FicheSection>

                {Array.isArray(detail.items) && detail.items.length > 0 && (
                  <FicheSection title={`Articles (${detail.items.length})`}>
                    {detail.items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span>{it.name ?? 'Article'} <span style={{ color: 'var(--text-muted)' }}>× {it.quantity ?? 1}</span></span>
                        <span style={{ whiteSpace: 'nowrap' }}>{((Number(it.price) || 0) * (Number(it.quantity) || 1)).toLocaleString('fr-FR')} F</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {detail.proPaymentMode === 'SPLIT_IN_APP' ? 'Articles payés dans l’app (inclus dans le paiement en ligne)' : 'Articles réglés hors de l’app'}
                    </div>
                  </FicheSection>
                )}

                {detail.status === 'DELIVERED' && (
                  <FicheSection title="Preuve de livraison">
                    {detail.proofPhotoUrl
                      ? <DocThumb url={detail.proofPhotoUrl} label="Photo" width={160} height={120} />
                      : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune photo envoyée par le coursier.</div>}
                  </FicheSection>
                )}
              </div>

              {/* Colonne droite : personnes et argent */}
              <div>
                <FicheSection title="Personnes">
                  <PersonCard role={detail.client?.role === 'DEM_PRO' ? 'Client · DEM Pro' : 'Client'}
                    name={clientDisplayName(detail.client, detail.clientName, detail.clientPhone)}
                    phone={firstNonEmpty(detail.client?.phone, detail.clientPhone)}
                    extra={detail.createdByName ? `Créée par ${detail.createdByName}` : null} />
                  <PersonCard role="Coursier"
                    name={firstNonEmpty(detail.driver?.name, detail.driver?.phone)}
                    phone={detail.driver?.phone}
                    extra={detail.driver ? [detail.driver.vehicleType, detail.driver.vehiclePlate].filter(Boolean).join(' · ') : (['DELIVERED', 'CANCELLED'].includes(detail.status) ? 'Aucun coursier' : 'Pas encore de coursier')} />
                  {(detail.receiverName || detail.receiverPhone || detail.senderName || detail.senderPhone) && (
                    <PersonCard role="Destinataire"
                      name={firstNonEmpty(detail.receiverName, detail.receiverPhone)}
                      phone={detail.receiverPhone}
                      extra={detail.senderName || detail.senderPhone ? `Expéditeur : ${firstNonEmpty(detail.senderName, detail.senderPhone)}` : null} />
                  )}
                </FicheSection>

                <FicheSection title={detail.status === 'CANCELLED' ? 'Montants prévus' : 'Montants'}>
                  <Row label="Part coursier" value={`${(detail.price ?? 0).toLocaleString('fr-FR')} F`} />
                  <Row label="Frais DEM"     value={`+ ${(detail.demFee ?? 0).toLocaleString('fr-FR')} F`} />
                  {detail.discountAmount > 0 && <Row label="Réduction" value={
                    <span>
                      − {detail.discountAmount.toLocaleString('fr-FR')} F
                      {/* Origine de la réduction (Centre des récompenses) */}
                      {detail.discountOrigin && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          <strong style={{ color: 'var(--text)' }}>{detail.discountOrigin.label}</strong>
                          {detail.discountOrigin.detail ? ` · ${detail.discountOrigin.detail}` : ''}
                        </span>
                      )}
                    </span>
                  } />}
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                    <Row label="Prix client" value={<strong>{clientCharge(detail).toLocaleString('fr-FR')} F</strong>} />
                  </div>
                </FicheSection>

                {detail.status !== 'CANCELLED' && (
                  <FicheSection title="Paiement">
                    <Row label="Statut" value={detail.status === 'DELIVERED' ? <Badge status={detail.paymentStatus ?? 'PENDING'} /> : 'Après la livraison'} />
                    {detail.paymentMethod && <Row label="Mode" value={PAYMENT_METHOD_LABELS[detail.paymentMethod] ?? detail.paymentMethod} />}
                    {detail.paidOnlineAt && <Row label="Payée en ligne le" value={fmtDate(detail.paidOnlineAt)} />}
                    {detail.disputeNotes && <Row label="Note litige" value={<span style={{ color: 'var(--danger)' }}>{detail.disputeNotes}</span>} />}
                  </FicheSection>
                )}

                {detail.rating && (
                  <FicheSection title="Note du client">
                    <div style={{ fontSize: 16, color: '#f59e0b', letterSpacing: 2 }}>
                      {'★'.repeat(detail.rating.score)}<span style={{ color: 'var(--border)' }}>{'★'.repeat(Math.max(0, 5 - detail.rating.score))}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', letterSpacing: 0, marginLeft: 8 }}>{detail.rating.score}/5</span>
                    </div>
                    {detail.rating.comment && <div style={{ fontSize: 13, fontStyle: 'italic' }}>« {detail.rating.comment} »</div>}
                  </FicheSection>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Choix d'un coursier */}
      {driverPicker && (
        <div style={{ ...overlay, zIndex: 110 }} onClick={() => !busy && setDriverPicker(null)}>
          <div style={{ ...modalBox, width: 460 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4, fontSize: 16 }}>Choisir un coursier</h2>
            <p style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Suggérer</strong> envoie une offre que le coursier peut accepter ou refuser.{' '}
              <strong>Attribuer directement</strong> lui assigne la course sans confirmation de sa part.
            </p>
            {driverPicker.error && <div style={{ color: '#dc2626', padding: '0 0 10px', fontSize: 12.5 }}>{driverPicker.error}</div>}
            {driverPicker.loading ? (
              <div style={{ color: 'var(--text-muted)', padding: 12 }}>Chargement des coursiers disponibles…</div>
            ) : driverPicker.drivers.length === 0 ? (
              !driverPicker.error && <div style={{ color: 'var(--text-muted)', padding: 12 }}>Aucun coursier disponible pour le moment.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {driverPicker.drivers.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.2)', background: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                    <span style={{ minWidth: 0 }}>
                      <strong>{d.name ?? 'Sans nom'}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{d.phone}</span>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11 }}>{d.vehicleType ?? '—'}</span>
                    </span>
                    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => suggestDriver(d.id)} disabled={busy} style={{ ...btnOutline, padding: '6px 10px', fontSize: 12, color: '#0077b6', borderColor: '#0077b6', background: 'rgba(0,119,182,0.08)' }}>Suggérer</button>
                      <button onClick={() => assignDriver(d.id)} disabled={busy} style={{ ...btnOutline, padding: '6px 10px', fontSize: 12, color: '#16a34a', borderColor: '#16a34a', background: 'rgba(22,163,74,0.08)' }}>Attribuer directement</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDriverPicker(null)} disabled={busy} style={btnOutline}>{busy ? 'Attribution…' : 'Fermer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Motif d'annulation — obligatoire, jamais de texte libre envoyé au client/coursier */}
      {cancelPicker && (
        <div style={{ ...overlay, zIndex: 120 }} onClick={() => !busy && setCancelPicker(null)}>
          <div style={{ ...modalBox, width: 460 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4, fontSize: 16 }}>Annuler la course</h2>
            <p style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              Le motif choisi détermine le message envoyé au client (et au coursier si assigné) —
              jamais le mot "admin", toujours une formulation professionnelle déjà rédigée.
            </p>
            {cancelReasons === null ? (
              <div style={{ color: 'var(--text-muted)', padding: 12 }}>Chargement des motifs…</div>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Motif *</label>
                <select value={cancelPicker.code} onChange={e => setCancelPicker(p => ({ ...p, code: e.target.value }))} style={{ ...glassInput, width: '100%', marginBottom: 14 }}>
                  <option value="">— Sélectionner un motif —</option>
                  {cancelReasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Note interne (optionnelle — jamais montrée au client/coursier)</label>
                <textarea value={cancelPicker.note} onChange={e => setCancelPicker(p => ({ ...p, note: e.target.value }))} rows={3}
                  style={{ ...glassInput, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} placeholder="Contexte pour l'équipe support/audit…" />
              </>
            )}
            {cancelPicker.error && <div style={{ fontSize: 12.5, color: '#dc2626', marginTop: 10 }}>{cancelPicker.error}</div>}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setCancelPicker(null)} disabled={busy} style={btnOutline}>Retour</button>
              <button onClick={confirmCancelOrder} disabled={busy || !cancelPicker.code}
                style={{ ...btnOutline, color: '#fff', borderColor: '#dc2626', background: cancelPicker.code ? '#dc2626' : 'rgba(220,38,38,0.4)' }}>
                {busy ? 'Annulation…' : 'Confirmer l’annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const PAYMENT_METHOD_LABELS = { CASH: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', WALLET: 'Wallet DEM' }
const CANCELLED_BY_LABELS = { CLIENT: 'le client', DRIVER: 'le coursier', ADMIN: 'l’équipe DEM', SYSTEM: 'automatiquement' }

// Étapes de la course avec leur heure et la durée de chaque étape (données
// déjà renvoyées par le serveur) ; pour une annulation : motif, auteur, note.
function Timeline({ order }) {
  const end = order.status === 'CANCELLED'
    ? { label: 'Annulée', at: order.cancelledAt, color: '#dc2626' }
    : { label: 'Livrée', at: order.deliveredAt, color: '#16a34a' }
  const steps = [
    order.scheduledAt && { label: 'Programmée pour', at: order.scheduledAt, noDuration: true },
    { label: 'Créée', at: order.createdAt },
    { label: 'Acceptée par un coursier', at: order.acceptedAt },
    { label: 'Colis récupéré', at: order.pickedUpAt },
    end,
  ].filter(Boolean)
  let prev = null
  const rows = steps.map(s => {
    const gap = s.at && prev && !s.noDuration ? Math.max(0, Math.round((new Date(s.at) - new Date(prev)) / 60000)) : null
    if (s.at && !s.noDuration) prev = s.at
    return { ...s, gap }
  })
  const total = end.at && order.createdAt ? Math.max(0, Math.round((new Date(end.at) - new Date(order.createdAt)) / 60000)) : null
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0, background: s.at ? (s.color ?? 'var(--primary)') : 'transparent', border: `2px solid ${s.at ? (s.color ?? 'var(--primary)') : 'var(--border)'}` }} />
            <span style={{ flex: 1, color: s.at ? 'var(--text)' : 'var(--text-muted)' }}>{s.label}</span>
            {s.gap != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{formatDuration(s.gap)}</span>}
            <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmtTime(s.at) ?? '—'}</span>
          </div>
        ))}
      </div>
      {total != null && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {order.status === 'CANCELLED' ? 'Annulée après' : 'Durée totale :'} <strong style={{ color: 'var(--text)' }}>{formatDuration(total)}</strong>
        </div>
      )}
      {order.status === 'CANCELLED' && (
        <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.06)', fontSize: 12.5 }}>
          <div><strong>{cancelReasonLabel(order.cancelReason)}</strong>{order.cancelledBy ? ` · annulée par ${CANCELLED_BY_LABELS[order.cancelledBy] ?? order.cancelledBy}` : ''}{order.cancelledByName ? ` (${order.cancelledByName})` : ''}</div>
          {order.cancelNote && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>« {order.cancelNote} »</div>}
        </div>
      )}
    </>
  )
}

// Adresse + lien vers la carte (les coordonnées GPS sont toujours connues)
function Place({ label, address, lat, lng }) {
  const hasGps = lat != null && lng != null
  return (
    <Row label={label} value={
      <span>
        {address || '—'}
        {hasGps && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8, fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            <MapPin size={12} /> Carte
          </a>
        )}
      </span>
    } />
  )
}

// Une personne de la course : nom, téléphone, appel et WhatsApp en un clic
function PersonCard({ role, name, phone, extra }) {
  const digits = (phone ?? '').replace(/[^\d]/g, '')
  const hasPhone = digits.length >= 7
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{role}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{name}</span>
        {hasPhone && (
          <>
            <a href={`tel:${phone}`} title={`Appeler ${phone}`} style={iconLink}><Phone size={13} /></a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" title="WhatsApp" style={iconLink}><MessageCircle size={13} /></a>
          </>
        )}
      </div>
      {hasPhone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{phone}</div>}
      {extra && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{extra}</div>}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button title="Copier l’identifiant complet" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
      {copied ? <><Check size={13} /> copié</> : <Copy size={13} />}
    </button>
  )
}

function FicheSection({ title, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  )
}

const card       = { ...glass, padding: '12px 16px' }
const tableStyle = { width: '100%', minWidth: 900, borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '9px 10px', verticalAlign: 'middle', fontSize: 13 }
const ellipsis   = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '22px 26px', width: 920, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }
const pill       = { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(2,132,199,0.12)', color: '#0369a1' }
const iconLink   = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 13, border: '1px solid var(--border)', color: 'var(--primary)', background: 'rgba(255,255,255,0.7)' }
