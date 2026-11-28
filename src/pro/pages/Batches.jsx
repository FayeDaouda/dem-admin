import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Route, X, Phone, Copy, Link2, Ban, Eye, MoreHorizontal, Repeat, Store, MessageCircle, Info, StickyNote,
} from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { dateTime, fcfa, phoneFmt, timeAgo, timeOnly, dakarDay } from '../lib/format'
import { Button, Card, Drawer, Empty, ErrorState, IconButton, Modal, PageHeader, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { BatchBadge, BatchMap, StopBadge } from '../ui/batchKit'
import {
  BATCH_ACTIVE, BATCH_CANCELLABLE, BATCH_CANCEL_REASONS, batchTotal, isScheduled, shortRef, sortedStops, stopTotal,
} from '../ui/batch'
import '../styles/batch.css'

// Tournées groupées : la même liste que l'app (GET /dem-pro/batch, 50 plus
// récentes), filtrable ; le suivi s'ouvre dans un panneau latéral (?id=…)
// — GET /dem-pro/batch/:id, annulation DELETE /dem-pro/batch/:id.

const FILTERS = [
  ['toutes', 'Toutes'],
  ['en-cours', 'En cours'],
  ['programmees', 'Programmées'],
  ['terminees', 'Terminées'],
  ['annulees', 'Annulées'],
]
const HELP_URL = 'https://wa.me/221784448524'

const match = (b, f) => f === 'toutes' ? true
  : f === 'en-cours' ? BATCH_ACTIVE.has(b.status) && !isScheduled(b)
  : f === 'programmees' ? isScheduled(b)
  : f === 'terminees' ? b.status === 'COMPLETED'
  : f === 'annulees' ? b.status === 'CANCELLED'
  : true

const stamp = (d) => !d ? '' : dakarDay(d) === dakarDay(Date.now()) ? timeOnly(d) : dateTime(d)
const delivered = (b) => (b.orders ?? []).filter(o => o.status === 'DELIVERED').length
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`

async function copyTrackingLink(id, notify) {
  try {
    const res = await proApi.get(`/orders/${id}/share-link`)
    await navigator.clipboard.writeText(res.data.shareUrl)
    notify.success('Lien de suivi copié', 'Envoyez-le à ce destinataire : il suit le coursier en direct.')
  } catch (e) { notify.error('Lien indisponible', errMsg(e)) }
}

export default function Batches() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [batches, setBatches] = useState(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [flash, setFlash] = useState(() => new Set())
  const prev = useRef(null)
  const seq = useRef(0)

  const openId = params.get('id')
  const filter = FILTERS.some(([k]) => k === params.get('filtre')) ? params.get('filtre') : 'toutes'
  const setParam = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => { if (v == null || v === '') next.delete(k); else next.set(k, v) })
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    const n = ++seq.current
    try {
      const res = await proApi.get('/dem-pro/batch')
      if (n !== seq.current) return
      const list = Array.isArray(res.data) ? res.data : []
      // Tournées dont le statut ou l'avancement a changé : surlignées une fois
      const sig = (b) => `${b.status}:${delivered(b)}`
      if (prev.current) {
        const changed = list.filter(b => prev.current.has(b.id) && prev.current.get(b.id) !== sig(b)).map(b => b.id)
        if (changed.length) { setFlash(new Set(changed)); setTimeout(() => setFlash(new Set()), 1800) }
      }
      prev.current = new Map(list.map(b => [b.id, sig(b)]))
      setBatches(list)
      setFailed(false)
    } catch {
      if (n === seq.current) setFailed(true)
    }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)
  const retry = () => { setFailed(false); setBatches(null); load() }

  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (batches ?? []).filter(b => !needle || [
      shortRef(b.id), b.pickupAddress, b.driver?.name,
      ...(b.orders ?? []).flatMap(o => [o.receiverName, o.deliveryAddress]),
    ].some(v => String(v ?? '').toLowerCase().includes(needle)))
  }, [batches, q])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, scoped.filter(b => match(b, k)).length])), [scoped])
  const list = useMemo(() => scoped.filter(b => match(b, filter)), [scoped, filter])

  const total = batches?.length ?? 0
  const activeCount = (batches ?? []).filter(b => match(b, 'en-cours')).length
  const description = !batches ? 'Chargement de vos tournées…'
    : total === 0 ? 'Un seul coursier, plusieurs destinataires : vos tournées apparaîtront ici et dans l\'application.'
    : `${plural(total, 'tournée')} · ${activeCount} en cours`

  const open = (id) => { setMenuId(null); setParam({ id }) }

  useEffect(() => {
    if (!menuId) return
    const onDown = (e) => { if (!e.target.closest?.('.dl-menu-wrap')) setMenuId(null) }
    const onKey = (e) => e.key === 'Escape' && setMenuId(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuId])

  const menuFor = (b) => (
    <RowMenu batch={b} open={menuId === b.id}
      onToggle={() => setMenuId(id => id === b.id ? null : b.id)}
      onDetail={() => open(b.id)}
      onRepeat={() => { setMenuId(null); navigate(`/tournees/nouvelle?dupliquer=${b.id}`) }}
      onCancel={() => { setMenuId(null); setCancelling(b) }} />
  )

  return (
    <div className="dl bt">
      <PageHeader
        eyebrow="Livraisons"
        title={<>Tournées groupées<span className="dot">.</span></>}
        description={description}
        actions={<Button icon={Plus} onClick={() => navigate('/tournees/nouvelle')}>Nouvelle tournée</Button>}
      />

      <Card className="dl-card" style={{ padding: 0 }}>
        <div className="dl-tabs" role="tablist" aria-label="Filtrer les tournées">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className="dl-tab"
              onClick={() => setParam({ filtre: k === 'toutes' ? null : k })}>
              {label}
              {batches && <span className="dl-count num">{counts[k]}</span>}
            </button>
          ))}
        </div>

        <div className="dl-tools">
          <label className="dl-search">
            <Search size={16} aria-hidden />
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Référence, destinataire, adresse, coursier…" aria-label="Rechercher une tournée" />
          </label>
        </div>

        {failed ? (
          <ErrorState title="Impossible de charger vos tournées" onRetry={retry} />
        ) : !batches ? (
          <div style={{ padding: 20, display: 'grid', gap: 10 }} aria-busy="true">
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={52} />)}
          </div>
        ) : list.length === 0 ? (
          total === 0 ? (
            <Empty icon={Route} title="Pas encore de tournée"
              text="Livrez 2 à 5 clients en une seule course : un coursier récupère tous les colis chez vous et les livre l'un après l'autre."
              action={<Button icon={Plus} onClick={() => navigate('/tournees/nouvelle')}>Créer une tournée</Button>} />
          ) : (
            <Empty icon={Search} title="Aucune tournée ne correspond" text="Aucun résultat pour ces filtres."
              action={<Button variant="ghost" size="sm" onClick={() => { setQ(''); setParam({ filtre: null }) }}>Effacer les filtres</Button>} />
          )
        ) : (
          <>
            {/* Téléphone : cartes */}
            <ul className="dl-mlist pro-only-sm">
              {list.map(b => (
                <li key={b.id} className={`dl-mcard ${flash.has(b.id) ? 'flash' : ''} ${openId === b.id ? 'is-open' : ''}`}>
                  <button type="button" className="dl-mcard-main" onClick={() => open(b.id)}>
                    <span className="dl-mcard-top">
                      <span className="mono dl-ref">{shortRef(b.id)}</span>
                      <span className="muted" style={{ fontSize: 12.5 }}>{dateTime(b.scheduledAt && isScheduled(b) ? b.scheduledAt : b.createdAt)}</span>
                    </span>
                    <span className="dl-mcard-mid">
                      <span className="dl-name">{plural(b.orders?.length ?? 0, 'arrêt')}</span>
                      <span className="num dl-amount-m">{fcfa(batchTotal(b))}</span>
                    </span>
                    <span className="muted dl-ellipsis" style={{ fontSize: 13 }}>{names(b)}</span>
                    <span className="dl-mcard-bot">
                      <BatchBadge status={b.status} />
                      <Progress batch={b} compact />
                    </span>
                  </button>
                  <div className="dl-mcard-menu">{menuFor(b)}</div>
                </li>
              ))}
            </ul>

            {/* Tablette et ordinateur : tableau */}
            <table className="dl-table bt-table pro-hide-only-sm">
              <colgroup>
                <col className="c-ref" /><col className="c-tour" /><col className="c-prog" /><col className="c-status" />
                <col className="c-driver" /><col className="c-amount" /><col className="c-date" /><col className="c-menu" />
              </colgroup>
              <thead>
                <tr>
                  <th className="c-ref" scope="col">Référence</th>
                  <th scope="col">Destinataires</th>
                  <th scope="col" className="c-prog">Avancement</th>
                  <th scope="col">Statut</th>
                  <th className="c-driver" scope="col">Coursier</th>
                  <th scope="col" className="num-col">Montant</th>
                  <th scope="col">Date</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map(b => (
                  <tr key={b.id} tabIndex={0} aria-label={`Tournée ${shortRef(b.id)}, ${plural(b.orders?.length ?? 0, 'arrêt')}`}
                    className={`dl-row ${openId === b.id ? 'is-open' : ''} ${flash.has(b.id) ? 'flash' : ''}`}
                    onClick={() => open(b.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(b.id) }}>
                    <td className="c-ref"><span className="mono dl-ref">{shortRef(b.id)}</span></td>
                    <td>
                      <div className="dl-name dl-ellipsis">{plural(b.orders?.length ?? 0, 'arrêt')} · {names(b)}</div>
                      <div className="muted dl-sub dl-ellipsis">Depuis {b.pickupAddress}</div>
                    </td>
                    <td className="c-prog"><Progress batch={b} /></td>
                    <td><BatchBadge status={b.status} /></td>
                    <td className="c-driver"><span className="dl-ellipsis">{b.driver?.name ?? <span className="muted">—</span>}</span></td>
                    <td className="num num-col dl-amount">{fcfa(batchTotal(b))}</td>
                    <td>
                      <span title={timeAgo(b.createdAt)} className="dl-date">{dateTime(b.createdAt)}</span>
                      {isScheduled(b) && <div className="muted dl-sub">Départ {dateTime(b.scheduledAt)}</div>}
                    </td>
                    <td className="c-menu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{menuFor(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="dl-pager">
              <span className="num">{plural(list.length, 'tournée')}</span>
              {total >= 50 && <span>Les 50 tournées les plus récentes</span>}
            </div>
          </>
        )}
      </Card>

      <BatchDrawer key={openId ?? 'none'} id={openId} onClose={() => setParam({ id: null })} onChanged={load}
        onRepeat={(id) => navigate(`/tournees/nouvelle?dupliquer=${id}`)} />
      <CancelModal open={!!cancelling} batch={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); load() }} />
    </div>
  )
}

const names = (b) => sortedStops(b).map((o, i) => o.receiverName || `Destinataire ${i + 1}`).join(', ')

// Avancement : un segment par arrêt (livré, annulé, à venir)
function Progress({ batch: b, compact }) {
  const stops = sortedStops(b)
  const done = stops.filter(o => o.status === 'DELIVERED').length
  return (
    <span className={`bt-prog ${compact ? 'is-compact' : ''}`} aria-label={`${done} sur ${stops.length} livrés`}>
      <span className="bt-prog-bar" aria-hidden>
        {stops.map(o => <i key={o.id} className={o.status === 'DELIVERED' ? 'done' : o.status === 'CANCELLED' ? 'off' : ['PICKED_UP', 'IN_TRANSIT'].includes(o.status) ? 'go' : ''} />)}
      </span>
      <span className="num bt-prog-txt">{done}/{stops.length}</span>
    </span>
  )
}

function RowMenu({ batch: b, open, onToggle, onDetail, onRepeat, onCancel }) {
  const canCancel = BATCH_CANCELLABLE.has(b.status)
  return (
    <div className="dl-menu-wrap">
      <IconButton icon={MoreHorizontal} label="Actions" size="sm" variant="plain"
        aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle() }} />
      {open && (
        <div className="dl-menu" role="menu">
          <button role="menuitem" type="button" onClick={onDetail}><Eye size={15} aria-hidden /> Voir le suivi</button>
          <button role="menuitem" type="button" onClick={onRepeat}><Repeat size={15} aria-hidden /> Recommander</button>
          {canCancel && <>
            <span className="dl-menu-sep" aria-hidden />
            <button role="menuitem" type="button" className="danger" onClick={onCancel}><Ban size={15} aria-hidden /> Annuler la tournée</button>
          </>}
        </div>
      )}
    </div>
  )
}

// ── Suivi d'une tournée ─────────────────────────────────────────────────────
function BatchDrawer({ id, onClose, onChanged, onRepeat }) {
  const notify = useNotify()
  const [batch, setBatch] = useState(null)
  const [failed, setFailed] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await proApi.get(`/dem-pro/batch/${id}`)
      setBatch(res.data ?? null)
      setFailed(null)
    } catch (e) { setFailed(e?.response?.status === 404 ? 'Cette tournée est introuvable.' : errMsg(e, 'Vérifiez votre connexion puis réessayez.')) }
  }, [id])
  useEffect(() => { load() }, [load]) // remis à zéro par key={id}
  useLiveRefresh(load)

  // Position du coursier : relue toutes les 20 s pendant la tournée (comme
  // l'app), onglet visible seulement
  const live = batch && ['ACCEPTED', 'IN_PROGRESS'].includes(batch.status)
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => { if (!document.hidden) load() }, 20_000)
    return () => clearInterval(t)
  }, [live, load])

  const b = batch
  const stops = sortedStops(b)
  const done = stops.filter(o => o.status === 'DELIVERED').length
  const cancellable = b && BATCH_CANCELLABLE.has(b.status)
  const driver = b?.driver ?? stops.find(o => o.driver)?.driver ?? null
  const canCall = !!driver?.phone && b && ['ACCEPTED', 'IN_PROGRESS'].includes(b.status)
  // Arrêt vers lequel se dirige le coursier
  const current = b?.status === 'IN_PROGRESS' ? stops.find(o => !['DELIVERED', 'CANCELLED'].includes(o.status)) : null

  const copyRef = async () => {
    try { await navigator.clipboard.writeText(shortRef(id)); notify.success('Référence copiée', shortRef(id)) } catch { /* presse-papiers refusé */ }
  }

  const firstAccepted = stops.map(o => o.acceptedAt).filter(Boolean).sort()[0]
  const firstPicked = stops.map(o => o.pickedUpAt).filter(Boolean).sort()[0]
  const lastDelivered = stops.map(o => o.deliveredAt).filter(Boolean).sort().at(-1)
  const steps = b ? [
    { label: 'Tournée créée', at: b.createdAt, done: true },
    ...(b.scheduledAt ? [{ label: `Programmée pour le ${dateTime(b.scheduledAt)}`, at: null, done: true }] : []),
    { label: driver?.name ? `Coursier trouvé · ${driver.name}` : 'Coursier trouvé', at: firstAccepted, done: !!firstAccepted || ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) },
    { label: 'Colis récupérés', at: firstPicked, done: !!firstPicked || ['IN_PROGRESS', 'COMPLETED'].includes(b.status) },
    { label: `Livraisons · ${done} sur ${stops.length}`, at: done ? lastDelivered : null, done: done > 0 },
    { label: 'Tournée terminée', at: b.status === 'COMPLETED' ? lastDelivered : null, done: b.status === 'COMPLETED' },
  ] : []
  const cancelledAt = stops.map(o => o.cancelledAt).filter(Boolean).sort()[0]
  const timeline = b?.status === 'CANCELLED'
    ? [...steps.filter(s => s.done), { label: 'Tournée annulée', at: cancelledAt, done: true, danger: true }]
    : steps

  const mapStops = stops.map(o => (o.deliveryLatitude != null
    ? { lat: o.deliveryLatitude, lng: o.deliveryLongitude, state: o.status === 'DELIVERED' ? 'done' : o.status === 'CANCELLED' ? 'off' : o.id === current?.id ? 'active' : undefined }
    : null))
  const driverPos = live && driver?.latitude != null ? { lat: driver.latitude, lng: driver.longitude } : null

  const discount = stops.reduce((t, o) => t + (Number(o.discountAmount) || 0), 0)
  const fees = Number(b?.demFee) || 0
  const total = batchTotal(b)

  return (
    <Drawer open={!!id} onClose={onClose} width={580} label="Suivi de la tournée">
      <div className="dl-dhead">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dl-dref">
            <span className="label-caps">Tournée</span>
            <span className="mono">{shortRef(id)}</span>
            <IconButton icon={Copy} label="Copier la référence" size="sm" variant="plain" onClick={copyRef} />
          </div>
          <div className="dl-dtitle">{b ? `${plural(stops.length, 'arrêt')} · ${done} livré${done > 1 ? 's' : ''}` : '…'}</div>
          {b && <div className="dl-dmeta"><BatchBadge status={b.status} /><span className="muted">Créée le {dateTime(b.createdAt)}</span></div>}
        </div>
        <IconButton icon={X} label="Fermer" size="sm" variant="plain" onClick={onClose} />
      </div>

      <div className="scroll-y dl-dbody">
        {failed ? <ErrorState compact title="Impossible de charger cette tournée" text={failed} onRetry={load} />
          : !b ? <div style={{ padding: 24, display: 'grid', gap: 14 }}><Skeleton h={220} /><Skeleton h={120} /><Skeleton h={180} /></div>
          : (
            <>
              <div className="dl-map bt-dmap">
                <BatchMap pickup={{ lat: b.pickupLatitude, lng: b.pickupLongitude }} stops={mapStops} driver={driverPos} />
                <div className="dl-map-legend" aria-hidden>
                  <span><i style={{ background: '#021520' }} />Retrait</span>
                  <span><i style={{ background: '#021520', borderRadius: 0 }} />Arrêt</span>
                  {done > 0 && <span><i style={{ background: '#15803D', borderRadius: 0 }} />Livré</span>}
                  {driverPos && <span><i style={{ background: '#15803D' }} />Coursier</span>}
                </div>
              </div>

              {b.status === 'IN_PROGRESS' && (
                <div className="bt-note" role="note">
                  <Info size={15} aria-hidden />
                  <span>Les colis sont récupérés : la tournée ne peut plus être annulée ici. Pour un problème, contactez le <a className="link" href={HELP_URL} target="_blank" rel="noreferrer">service client</a>.</span>
                </div>
              )}

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

              {driver && (
                <section className="dl-sec">
                  <h3 className="label-caps dl-sec-title">Coursier</h3>
                  <div className="dl-driver">
                    <span className="dl-avatar" aria-hidden>{(driver.name ?? '?').charAt(0)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{driver.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{phoneFmt(driver.phone)}</div>
                    </div>
                    {canCall && <Button variant="ghost" size="sm" icon={Phone} href={`tel:${driver.phone}`}>Appeler</Button>}
                  </div>
                </section>
              )}

              <section className="dl-sec">
                <h3 className="label-caps dl-sec-title">Retrait</h3>
                <div className="bt-pick"><Store size={15} aria-hidden /><span>{b.pickupAddress}</span></div>
                {b.notes && <div className="bt-pick bt-notes"><StickyNote size={15} aria-hidden /><span>{b.notes}</span></div>}
              </section>

              <section className="dl-sec">
                <h3 className="label-caps dl-sec-title">Arrêts · {done} sur {stops.length} livrés</h3>
                <ol className="bt-dstops">
                  {stops.map((o, i) => (
                    <li key={o.id} className={`${o.status === 'DELIVERED' ? 'is-done' : ''} ${o.status === 'CANCELLED' ? 'is-off' : ''} ${o.id === current?.id ? 'is-current' : ''}`}>
                      <span className="bt-num" aria-hidden>{i + 1}</span>
                      <div className="bt-dstop-main">
                        <div className="bt-dstop-top">
                          <b className="dl-ellipsis">{o.receiverName || `Destinataire ${i + 1}`}</b>
                          <StopBadge status={o.status} />
                        </div>
                        <div className="muted bt-dstop-addr">{o.deliveryAddress}</div>
                        {o.description && <div className="muted bt-dstop-desc">{o.description}</div>}
                        <div className="bt-dstop-meta">
                          {o.receiverPhone && <a className="link" href={`tel:${o.receiverPhone}`}>{phoneFmt(o.receiverPhone)}</a>}
                          <span className="num">{fcfa(stopTotal(o))}</span>
                          {o.deliveredAt && <span className="muted">Livré {stamp(o.deliveredAt)}</span>}
                          {o.id === current?.id && <span className="bt-current">Prochain arrêt</span>}
                        </div>
                      </div>
                      {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                        <IconButton icon={Link2} label={`Copier le lien de suivi de l'arrêt ${i + 1}`} size="sm" variant="plain" onClick={() => copyTrackingLink(o.id, notify)} />
                      )}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="dl-sec">
                <h3 className="label-caps dl-sec-title">Paiement</h3>
                <div className="dl-row-price"><span className="muted">Livraisons · {plural(stops.length, 'arrêt')}</span><span className="num">{fcfa(total - fees + discount)}</span></div>
                {discount > 0 && <div className="dl-row-price"><span className="muted">Réduction</span><span className="num">− {fcfa(discount)}</span></div>}
                {fees > 0 && <div className="dl-row-price"><span className="muted">Frais de service</span><span className="num">{fcfa(fees)}</span></div>}
                <div className="dl-total"><span>Total</span><span className="num">{fcfa(total)}</span></div>
                <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Chaque destinataire règle son arrêt au coursier, à la livraison.</div>
              </section>
            </>
          )}
      </div>

      {b && (
        <div className="dl-dfoot">
          {cancellable && <button type="button" className="dl-cancel-link" onClick={() => setCancelOpen(true)}>Annuler la tournée</button>}
          {b.status === 'IN_PROGRESS' && <Button variant="ghost" size="sm" icon={MessageCircle} href={HELP_URL} target="_blank" rel="noreferrer">Service client</Button>}
          <div style={{ flex: 1 }} />
          {canCall && <Button variant="ghost" size="sm" icon={Phone} href={`tel:${driver.phone}`} className="dl-hide-xs">Appeler le coursier</Button>}
          {['COMPLETED', 'CANCELLED'].includes(b.status) && <Button size="sm" icon={Repeat} onClick={() => onRepeat(b.id)}>Recommander</Button>}
        </div>
      )}
      <CancelModal open={cancelOpen} batch={b} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); load(); onChanged() }} />
    </Drawer>
  )
}

// ── Annulation ──────────────────────────────────────────────────────────────
function CancelModal({ open, batch, onClose, onDone }) {
  const notify = useNotify()
  const [reason, setReason] = useState('CUSTOMER_CANCELLED')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const accepted = batch?.status === 'ACCEPTED'
  const submit = async () => {
    setBusy(true)
    try {
      await proApi.delete(`/dem-pro/batch/${batch.id}`, { data: { reason, ...(reason === 'OTHER' && note.trim() ? { note: note.trim().slice(0, 200) } : {}) } })
      notify.success('Tournée annulée', accepted ? 'Le coursier est prévenu.' : 'Les livraisons non effectuées sont annulées.')
      window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
      onDone()
    } catch (e) { notify.error('Annulation impossible', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Annuler cette tournée ?"
      subtitle={accepted ? 'Un coursier est en route vers votre point de retrait : il sera prévenu.' : 'Toutes les livraisons de cette tournée seront annulées.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Garder la tournée</Button>
        <Button variant="danger" loading={busy} onClick={submit}>Annuler la tournée</Button>
      </>}>
      <fieldset className="dl-reasons">
        <legend className="label-caps" style={{ marginBottom: 10 }}>Motif</legend>
        {BATCH_CANCEL_REASONS.map(([k, label]) => (
          <label key={k} className={`dl-radio ${reason === k ? 'on' : ''}`}>
            <input type="radio" name="batch-cancel-reason" value={k} checked={reason === k} onChange={() => setReason(k)} />
            <span className="dl-radio-mark" aria-hidden />
            {label}
          </label>
        ))}
        {reason === 'OTHER' && (
          <textarea className="input bt-textarea" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Précisez le motif (facultatif)" aria-label="Précision du motif" style={{ marginTop: 4 }} />
        )}
      </fieldset>
    </Modal>
  )
}
