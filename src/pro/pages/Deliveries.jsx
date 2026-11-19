import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Plus, Search, Bike, X, Phone, Link2, Copy, Download, MoreHorizontal, Eye, Ban, ChevronLeft, ChevronRight,
  ArrowDown, ArrowUp, ArrowUpDown,
} from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi, { errMsg } from '../lib/proApi'
import { ACTIVE_STATUSES, ORDER_STATUS, dateTime, fcfa, orderTotal, phoneFmt, timeAgo, timeOnly } from '../lib/format'
import { Button, Card, Drawer, Empty, ErrorState, IconButton, Modal, PageHeader, Skeleton, StatusBadge } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Livraisons : la même liste que l'app (/orders/my), filtrable, triable,
// exportable ; le détail s'ouvre dans un panneau latéral (?id=…).
// Filtre et période vivent dans l'URL (?filtre=…&periode=…) : les cartes du
// tableau de bord y mènent directement.

const FILTERS = [
  ['toutes', 'Toutes'],
  ['en-cours', 'En cours'],
  ['programmees', 'Programmées'],
  ['livrees', 'Livrées'],
  ['annulees', 'Annulées'],
]
const PERIODS = [
  ['jour', 'Aujourd\'hui'],
  ['7j', '7 jours'],
  ['30j', '30 jours'],
  ['tout', 'Tout'],
]
const PAGE_SIZE = 20
const CANCELLABLE = new Set(['PENDING', 'ACCEPTED', 'SCHEDULED'])

const match = (o, f) => f === 'toutes' ? true
  : f === 'en-cours' ? ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status) && !(o.status === 'PENDING' && o.scheduledAt && new Date(o.scheduledAt) > new Date())
  : f === 'programmees' ? o.status === 'SCHEDULED' || (o.status === 'PENDING' && !!o.scheduledAt && new Date(o.scheduledAt) > new Date())
  : f === 'livrees' ? o.status === 'DELIVERED'
  : f === 'annulees' ? o.status === 'CANCELLED'
  : true

function periodStart(p) {
  const d = new Date()
  if (p === 'jour') { d.setHours(0, 0, 0, 0); return d }
  if (p === '7j') return new Date(Date.now() - 7 * 86400e3)
  if (p === '30j') return new Date(Date.now() - 30 * 86400e3)
  return null
}

const shortRef = (id) => String(id ?? '').slice(0, 8).toUpperCase()
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
const stamp = (d) => !d ? '' : sameDay(d, Date.now()) ? timeOnly(d) : dateTime(d)

// Lien de suivi à envoyer au destinataire (même lien que l'app)
async function copyTrackingLink(id, notify) {
  try {
    const res = await proApi.get(`/orders/${id}/share-link`)
    await navigator.clipboard.writeText(res.data.shareUrl)
    notify.success('Lien de suivi copié', 'Envoyez-le à votre client : il suit le coursier en direct.')
  } catch (e) { notify.error('Lien indisponible', errMsg(e)) }
}

// Export CSV : liste filtrée, « ; » + BOM pour qu'Excel lise les accents
function exportCsv(rows) {
  const head = ['Référence', 'Date', 'Client', 'Téléphone', 'Destination', 'Statut', 'Coursier', 'Montant (FCFA)']
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(o => [
    shortRef(o.id), dateTime(o.createdAt), o.receiverName ?? '', phoneFmt(o.receiverPhone), o.deliveryAddress ?? '',
    ORDER_STATUS[o.status]?.label ?? o.status, o.driver?.name ?? '', orderTotal(o),
  ].map(cell).join(';'))
  const blob = new Blob(['﻿' + [head.map(cell).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `livraisons-dem-pro-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Deliveries() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [params, setParams] = useSearchParams()
  const [orders, setOrders] = useState(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [menuId, setMenuId] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [flash, setFlash] = useState(() => new Set())
  const prevStatus = useRef(null)

  const openId = params.get('id')
  const filter = FILTERS.some(([k]) => k === params.get('filtre')) ? params.get('filtre') : 'toutes'
  const period = PERIODS.some(([k]) => k === params.get('periode')) ? params.get('periode') : 'tout'

  const setParam = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v == null || v === '') next.delete(k); else next.set(k, v) })
    setParams(next, { replace: true })
  }

  // Toutes les pages (le serveur en sert 100 au plus par appel)
  const load = useCallback(async () => {
    try {
      const all = []
      for (let p = 1; p <= 10; p++) {
        const res = await proApi.get('/orders/my', { params: { page: p, limit: 100 } })
        all.push(...(res.data?.orders ?? []))
        if (p >= (res.data?.totalPages ?? 1)) break
      }
      // Lignes dont le statut a changé depuis la dernière lecture : surlignées une fois
      const before = prevStatus.current
      if (before) {
        const changed = all.filter(o => before.has(o.id) && before.get(o.id) !== o.status).map(o => o.id)
        if (changed.length) {
          setFlash(new Set(changed))
          setTimeout(() => setFlash(new Set()), 1800)
        }
      }
      prevStatus.current = new Map(all.map(o => [o.id, o.status]))
      setOrders(all)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const retry = () => { setFailed(false); setOrders(null); load() }

  // Période + recherche, puis onglet
  const scoped = useMemo(() => {
    const from = periodStart(period)
    const needle = q.trim().toLowerCase()
    return (orders ?? [])
      // Une livraison livrée compte le jour où elle a été livrée (comme le tableau de bord)
      .filter(o => !from || new Date(o.status === 'DELIVERED' ? (o.deliveredAt ?? o.createdAt) : o.createdAt) >= from)
      .filter(o => !needle || [shortRef(o.id), o.receiverName, o.receiverPhone, phoneFmt(o.receiverPhone), o.deliveryAddress, o.description, o.driver?.name]
        .some(v => String(v ?? '').toLowerCase().includes(needle)))
  }, [orders, period, q])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, scoped.filter(o => match(o, k)).length])), [scoped])
  const list = useMemo(() => {
    const rows = scoped.filter(o => match(o, filter))
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) => sort.key === 'amount'
      ? (orderTotal(a) - orderTotal(b)) * dir
      : (new Date(a.createdAt) - new Date(b.createdAt)) * dir)
  }, [scoped, filter, sort])

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const total = orders?.length ?? 0
  const activeCount = (orders ?? []).filter(o => match(o, 'en-cours')).length
  const description = !orders ? 'Chargement de vos livraisons…'
    : total === 0 ? 'Vos livraisons apparaîtront ici et dans l\'application.'
    : `${total} livraison${total > 1 ? 's' : ''} · ${activeCount} en cours`

  const open = (id) => { setMenuId(null); setParam({ id }) }
  const toggleSort = (key) => { setPage(1); setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }) }
  const resetFilters = () => { setQ(''); setPage(1); setParam({ filtre: null, periode: null }) }
  const filtered = filter !== 'toutes' || period !== 'tout' || q.trim()

  // Fermer le menu « ⋯ » au clic dehors ou avec Échap
  useEffect(() => {
    if (!menuId) return
    const onDown = (e) => { if (!e.target.closest?.('.dl-menu-wrap')) setMenuId(null) }
    const onKey = (e) => e.key === 'Escape' && setMenuId(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuId])

  const menuFor = (o) => (
    <RowMenu order={o} open={menuId === o.id}
      onToggle={() => setMenuId(id => id === o.id ? null : o.id)}
      onDetail={() => open(o.id)}
      onCopy={() => { setMenuId(null); copyTrackingLink(o.id, notify) }}
      onCancel={() => { setMenuId(null); setCancelling(o) }} />
  )

  return (
    <div className="dl">
      <PageHeader
        eyebrow="Livraisons"
        title={<>Vos livraisons<span className="dot">.</span></>}
        description={description}
        actions={<Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>}
      />

      <Card className="dl-card" style={{ padding: 0 }}>
        <div className="dl-tabs" role="tablist" aria-label="Filtrer les livraisons">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className="dl-tab"
              onClick={() => { setPage(1); setParam({ filtre: k === 'toutes' ? null : k }) }}>
              {label}
              {orders && <span className="dl-count num">{counts[k]}</span>}
            </button>
          ))}
        </div>

        <div className="dl-tools">
          <label className="dl-search">
            <Search size={16} aria-hidden />
            <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Référence, client, téléphone, adresse…" aria-label="Rechercher une livraison" />
          </label>
          <div className="dl-seg" role="group" aria-label="Période">
            {PERIODS.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={period === k}
                onClick={() => { setPage(1); setParam({ periode: k === 'tout' ? null : k }) }}>{label}</button>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={Download} className="dl-export"
            disabled={!list.length} onClick={() => exportCsv(list)}>Exporter CSV</Button>
        </div>

        {failed ? (
          <ErrorState title="Impossible de charger vos livraisons" onRetry={retry} />
        ) : !orders ? (
          <div style={{ padding: 20, display: 'grid', gap: 10 }} aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={44} />)}
          </div>
        ) : list.length === 0 ? (
          total === 0 ? (
            <Empty icon={Bike} title="Pas encore de livraison"
              text="Créez votre première livraison : un coursier DEM récupère le colis chez vous et le livre à votre client."
              action={<Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>} />
          ) : (
            <Empty icon={Search} title="Aucune livraison ne correspond"
              text="Aucun résultat pour ces filtres."
              action={filtered && <Button variant="ghost" size="sm" onClick={resetFilters}>Effacer les filtres</Button>} />
          )
        ) : (
          <>
            {/* Téléphone : cartes */}
            <ul className="dl-mlist pro-only-sm">
              {visible.map(o => (
                <li key={o.id} className={`dl-mcard ${flash.has(o.id) ? 'flash' : ''} ${openId === o.id ? 'is-open' : ''}`}>
                  <button type="button" className="dl-mcard-main" onClick={() => open(o.id)}>
                    <span className="dl-mcard-top">
                      <span className="mono dl-ref">{shortRef(o.id)}</span>
                      <span className="muted" style={{ fontSize: 12.5 }}>{dateTime(o.createdAt)}</span>
                    </span>
                    <span className="dl-mcard-mid">
                      <span className="dl-name">{o.receiverName || 'Client'}</span>
                      <span className="num dl-amount-m">{fcfa(orderTotal(o))}</span>
                    </span>
                    <span className="muted dl-ellipsis" style={{ fontSize: 13 }}>{o.deliveryAddress}</span>
                    <span className="dl-mcard-bot">
                      <StatusBadge status={o.status} />
                      {o.driver?.name && <span className="muted dl-ellipsis" style={{ fontSize: 12.5 }}>{o.driver.name}</span>}
                    </span>
                  </button>
                  <div className="dl-mcard-menu">{menuFor(o)}</div>
                </li>
              ))}
            </ul>

            {/* Tablette et ordinateur : tableau */}
            <table className="dl-table pro-hide-only-sm">
              <colgroup>
                <col className="c-ref" /><col className="c-client" /><col className="c-dest" /><col className="c-status" />
                <col className="c-driver" /><col className="c-amount" /><col className="c-date" /><col className="c-menu" />
              </colgroup>
              <thead>
                <tr>
                  <th className="c-ref" scope="col">Référence</th>
                  <th scope="col">Client</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Statut</th>
                  <th className="c-driver" scope="col">Coursier</th>
                  <th scope="col" className="num-col" aria-sort={sort.key === 'amount' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <SortButton label="Montant" active={sort.key === 'amount'} dir={sort.dir} onClick={() => toggleSort('amount')} align="right" />
                  </th>
                  <th scope="col" aria-sort={sort.key === 'date' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <SortButton label="Date" active={sort.key === 'date'} dir={sort.dir} onClick={() => toggleSort('date')} />
                  </th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(o => (
                  <tr key={o.id} tabIndex={0} aria-label={`Livraison ${shortRef(o.id)} pour ${o.receiverName || 'client'}`}
                    className={`dl-row ${openId === o.id ? 'is-open' : ''} ${flash.has(o.id) ? 'flash' : ''}`}
                    onClick={() => open(o.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(o.id) }}>
                    <td className="c-ref"><span className="mono dl-ref">{shortRef(o.id)}</span></td>
                    <td>
                      <div className="dl-name dl-ellipsis">{o.receiverName || 'Client'}</div>
                      <div className="muted dl-sub">{phoneFmt(o.receiverPhone)}</div>
                    </td>
                    <td>
                      <div className="dl-ellipsis">{o.deliveryAddress}</div>
                      {o.description && <div className="muted dl-sub dl-ellipsis">{o.description}</div>}
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="c-driver"><span className="dl-ellipsis">{o.driver?.name ?? <span className="muted">—</span>}</span></td>
                    <td className="num num-col dl-amount">{fcfa(orderTotal(o))}</td>
                    <td><span title={timeAgo(o.createdAt)} className="dl-date">{dateTime(o.createdAt)}</span></td>
                    <td className="c-menu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{menuFor(o)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="dl-pager">
              <span className="num">{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, list.length)} sur {list.length}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <IconButton icon={ChevronLeft} label="Page précédente" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} />
                <IconButton icon={ChevronRight} label="Page suivante" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)} />
              </div>
            </div>
          </>
        )}
      </Card>

      <OrderDrawer key={openId ?? 'none'} id={openId} onClose={() => setParam({ id: null })} onChanged={load} />
      <CancelModal open={!!cancelling} order={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); load() }} />
    </div>
  )
}

function SortButton({ label, active, dir, onClick, align }) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button type="button" className={`dl-sort ${active ? 'on' : ''}`} onClick={onClick} style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {label} <Icon size={13} aria-hidden />
    </button>
  )
}

// Menu « ⋯ » d'une ligne
function RowMenu({ order: o, open, onToggle, onDetail, onCopy, onCancel }) {
  const canTrack = o.status !== 'CANCELLED'
  const canCall = !!o.driver?.phone && ACTIVE_STATUSES.has(o.status)
  const canCancel = CANCELLABLE.has(o.status)
  return (
    <div className="dl-menu-wrap">
      <IconButton icon={MoreHorizontal} label="Actions" size="sm" variant="plain"
        aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle() }} />
      {open && (
        <div className="dl-menu" role="menu">
          <button role="menuitem" type="button" onClick={onDetail}><Eye size={15} aria-hidden /> Voir le détail</button>
          {canTrack && <button role="menuitem" type="button" onClick={onCopy}><Link2 size={15} aria-hidden /> Copier le lien de suivi</button>}
          {canCall && <a role="menuitem" href={`tel:${o.driver.phone}`}><Phone size={15} aria-hidden /> Appeler le coursier</a>}
          {canCancel && <>
            <span className="dl-menu-sep" aria-hidden />
            <button role="menuitem" type="button" className="danger" onClick={onCancel}><Ban size={15} aria-hidden /> Annuler la livraison</button>
          </>}
        </div>
      )}
    </div>
  )
}

// ── Détail d'une livraison ───────────────────────────────────────────────────
const CANCEL_LABELS = {
  CUSTOMER_CANCELLED: 'Annulée par votre client', OUT_OF_STOCK: 'Article indisponible', ORDER_MISTAKE: 'Créée par erreur',
  WRONG_ADDRESS: 'Adresse ou infos erronées', TOO_LONG: 'Trop long', CHANGED_MIND: 'Changement d\'avis', PRICE: 'Prix trop élevé',
  FOUND_ALTERNATIVE: 'Autre solution trouvée', DRIVER_ISSUE: 'Problème avec le coursier', NO_DRIVER_FOUND: 'Aucun coursier disponible', OTHER: 'Autre',
}

function OrderDrawer({ id, onClose, onChanged }) {
  const notify = useNotify()
  const [order, setOrder] = useState(null)
  const [failed, setFailed] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await proApi.get(`/orders/${id}`)
      setOrder(res?.data?.order ?? res?.data ?? null)
      setFailed(false)
    } catch { setFailed(true) }
  }, [id])
  useEffect(() => { load() }, [load]) // remis à zéro par key={id} à chaque fiche
  useLiveRefresh(load)

  const o = order
  const cancellable = o && CANCELLABLE.has(o.status)
  const canCall = !!o?.driver?.phone && ACTIVE_STATUSES.has(o.status)
  const copyRef = async () => {
    try { await navigator.clipboard.writeText(shortRef(id)); notify.success('Référence copiée', shortRef(id)) } catch { /* presse-papiers refusé */ }
  }

  const steps = o ? [
    { label: 'Livraison créée', at: o.createdAt, done: true },
    ...(o.scheduledAt ? [{ label: `Programmée pour le ${dateTime(o.scheduledAt)}`, at: null, done: true }] : []),
    { label: o.driver?.name ? `Coursier trouvé · ${o.driver.name}` : 'Coursier trouvé', at: o.acceptedAt, done: !!o.acceptedAt },
    { label: 'Colis récupéré', at: o.pickedUpAt, done: !!o.pickedUpAt },
    { label: 'Livrée', at: o.deliveredAt, done: !!o.deliveredAt },
  ] : []
  const timeline = o?.status === 'CANCELLED'
    ? [...steps.filter(s => s.done), { label: `Annulée${o.cancelReason ? ` · ${CANCEL_LABELS[o.cancelReason] ?? o.cancelReason}` : ''}`, at: o.cancelledAt, done: true, danger: true }]
    : steps

  return (
    <Drawer open={!!id} onClose={onClose} width={560} label="Détail de la livraison">
      <div className="dl-dhead">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dl-dref">
            <span className="label-caps">Livraison</span>
            <span className="mono">{shortRef(id)}</span>
            <IconButton icon={Copy} label="Copier la référence" size="sm" variant="plain" onClick={copyRef} />
          </div>
          <div className="dl-dtitle">{o ? (o.receiverName || 'Client') : '…'}</div>
          {o && <div className="dl-dmeta"><StatusBadge status={o.status} /><span className="muted">Créée le {dateTime(o.createdAt)}</span></div>}
        </div>
        <IconButton icon={X} label="Fermer" size="sm" variant="plain" onClick={onClose} />
      </div>

      <div className="scroll-y dl-dbody">
        {failed ? <ErrorState compact title="Impossible de charger cette livraison" onRetry={load} />
          : !o ? <div style={{ padding: 24, display: 'grid', gap: 14 }}><Skeleton h={200} /><Skeleton h={120} /><Skeleton h={120} /></div>
          : (
            <>
              <RouteMap order={o} />

              <section className="dl-sec">
                <h3 className="label-caps dl-sec-title">Suivi</h3>
                <ol className="dl-tl">
                  {timeline.map((s, i) => (
                    <li key={s.label} className={`${s.done ? 'done' : ''} ${s.danger ? 'danger' : ''} ${i < timeline.length - 1 ? 'has-next' : ''} ${timeline[i + 1]?.done ? 'next-done' : ''}`}>
                      <span className="dl-tl-dot" aria-hidden />
                      <span className="dl-tl-label">{s.label}</span>
                      <span className="dl-tl-at num">{stamp(s.at)}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="dl-sec">
                <h3 className="label-caps dl-sec-title">Destinataire</h3>
                <KV label="Client" value={<>{o.receiverName || '—'}{o.receiverPhone && <> · <a className="link" href={`tel:${o.receiverPhone}`}>{phoneFmt(o.receiverPhone)}</a></>}</>} />
                <KV label="Adresse" value={o.deliveryAddress} />
                {o.description && <KV label="Colis" value={o.description} />}
                <KV label="Retrait" value={o.pickupAddress} />
              </section>

              {o.driver && (
                <section className="dl-sec">
                  <h3 className="label-caps dl-sec-title">Coursier</h3>
                  <div className="dl-driver">
                    <span className="dl-avatar" aria-hidden>{(o.driver.name ?? '?').charAt(0)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{o.driver.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {phoneFmt(o.driver.phone)}{o.driver.vehiclePlate ? ` · ${o.driver.vehiclePlate}` : ''}
                      </div>
                    </div>
                    {canCall && <Button variant="ghost" size="sm" icon={Phone} href={`tel:${o.driver.phone}`}>Appeler</Button>}
                  </div>
                </section>
              )}

              <section className="dl-sec">
                <h3 className="label-caps dl-sec-title">Paiement</h3>
                <Row label="Livraison" value={fcfa(o.price)} />
                {Number(o.demFee) > 0 && <Row label="Frais de service" value={fcfa(o.demFee)} />}
                {Number(o.discountAmount) > 0 && <Row label="Réduction" value={`− ${fcfa(o.discountAmount)}`} />}
                <div className="dl-total"><span>Total</span><span className="num">{fcfa(orderTotal(o))}</span></div>
                <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  {o.paymentMode === 'merchant' ? 'Payée par vous' : 'Payée par le client à la livraison'}{o.paymentStatus === 'PAID' ? ' · réglée' : ''}
                </div>
              </section>
            </>
          )}
      </div>

      {o && (
        <div className="dl-dfoot">
          {cancellable && <button type="button" className="dl-cancel-link" onClick={() => setCancelOpen(true)}>Annuler la livraison</button>}
          <div style={{ flex: 1 }} />
          {canCall && <Button variant="ghost" size="sm" icon={Phone} href={`tel:${o.driver.phone}`} className="dl-hide-xs">Appeler le coursier</Button>}
          {o.status !== 'CANCELLED'
            ? <Button size="sm" icon={Link2} onClick={() => copyTrackingLink(o.id, notify)}>Copier le lien de suivi</Button>
            : <Button variant="ghost" size="sm" icon={Copy} onClick={copyRef}>Copier la référence</Button>}
        </div>
      )}
      <CancelModal open={cancelOpen} order={o} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); load(); onChanged() }} />
    </Drawer>
  )
}

const KV = ({ label, value }) => (
  <div className="dl-kv"><span className="muted">{label}</span><span>{value || '—'}</span></div>
)
const Row = ({ label, value }) => (
  <div className="dl-row-price"><span className="muted">{label}</span><span className="num">{value}</span></div>
)

// ── Annulation ───────────────────────────────────────────────────────────────
const REASONS = [
  ['CUSTOMER_CANCELLED', 'Mon client a annulé'],
  ['OUT_OF_STOCK', 'Article indisponible'],
  ['ORDER_MISTAKE', 'Créée par erreur'],
  ['WRONG_ADDRESS', 'Adresse ou infos erronées'],
  ['TOO_LONG', 'Trop long'],
  ['OTHER', 'Autre motif'],
]

function CancelModal({ open, order, onClose, onDone }) {
  const notify = useNotify()
  const [reason, setReason] = useState('CUSTOMER_CANCELLED')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await proApi.patch(`/orders/${order.id}/cancel`, { reason, ...(reason === 'OTHER' && note.trim() ? { note: note.trim() } : {}) })
      notify.success('Livraison annulée', order.acceptedAt ? 'Le coursier est prévenu.' : null)
      onDone()
    } catch (e) { notify.error('Annulation impossible', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Annuler cette livraison ?"
      subtitle={order?.acceptedAt ? 'Un coursier est déjà en route : il sera prévenu.' : 'Aucun coursier ne l\'a encore acceptée.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Ne pas annuler</Button>
        <Button variant="danger" loading={busy} onClick={submit}>Annuler la livraison</Button>
      </>}>
      <fieldset className="dl-reasons">
        <legend className="label-caps" style={{ marginBottom: 10 }}>Motif</legend>
        {REASONS.map(([k, label]) => (
          <label key={k} className={`dl-radio ${reason === k ? 'on' : ''}`}>
            <input type="radio" name="cancel-reason" value={k} checked={reason === k} onChange={() => setReason(k)} />
            <span className="dl-radio-mark" aria-hidden />
            {label}
          </label>
        ))}
        {reason === 'OTHER' && (
          <textarea className="input" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Précisez le motif (facultatif)" aria-label="Précision du motif" style={{ marginTop: 4 }} />
        )}
      </fieldset>
    </Modal>
  )
}

// ── Carte : retrait, destination, coursier ───────────────────────────────────
const dot = (bg, svg) => L.divIcon({
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
  html: `<div style="width:24px;height:24px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);display:grid;place-items:center;color:#fff">${svg}</div>`,
})
const SVG_STORE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M3 9l1-5h16l1 5M4 9v11h16V9"/></svg>'
const SVG_PIN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/></svg>'
const SVG_BIKE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5L9 10h6l3.5 7.5"/></svg>'

function Fit({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const valid = JSON.parse(key).filter(Boolean)
    if (valid.length) map.fitBounds(L.latLngBounds(valid).pad(0.3), { animate: false })
  }, [map, key])
  return null
}

function RouteMap({ order: o }) {
  const pickup = o.pickupLatitude != null ? [o.pickupLatitude, o.pickupLongitude] : null
  const drop = o.deliveryLatitude != null ? [o.deliveryLatitude, o.deliveryLongitude] : null
  const driver = o.driver?.latitude != null && ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status) ? [o.driver.latitude, o.driver.longitude] : null
  if (!pickup && !drop) return null
  return (
    <div className="dl-map">
      <MapContainer center={drop ?? pickup} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        <MapBaseLayer />
        {pickup && drop && <Polyline positions={[pickup, drop]} pathOptions={{ color: '#021520', weight: 2, dashArray: '6 6', opacity: .7 }} />}
        {pickup && <Marker position={pickup} icon={dot('#021520', SVG_STORE)} />}
        {drop && <Marker position={drop} icon={dot('#0086C8', SVG_PIN)} />}
        {driver && <Marker position={driver} icon={dot('#15803D', SVG_BIKE)} />}
        <Fit points={[pickup, drop, driver]} />
      </MapContainer>
      <div className="dl-map-legend" aria-hidden>
        <span><i style={{ background: '#021520' }} />Retrait</span>
        <span><i style={{ background: '#0086C8' }} />Destination</span>
        {driver && <span><i style={{ background: '#15803D' }} />Coursier</span>}
      </div>
    </div>
  )
}
