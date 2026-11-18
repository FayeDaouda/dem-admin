import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Plus, Search, Bike, X, Phone, Link2, Copy, MapPin, Store, Clock, CheckCircle2, PackageCheck, Ban, Receipt, User,
} from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi, { errMsg } from '../lib/proApi'
import { ACTIVE_STATUSES, ORDER_STATUS, dateTime, fcfa, orderTotal, phoneFmt, timeAgo, timeOnly } from '../lib/format'
import { Button, Card, Drawer, Empty, Modal, Skeleton, StatusBadge } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Livraisons : même liste que l'app (/orders/my), fiche en panneau latéral
const FILTERS = [
  ['all', 'Toutes'],
  ['active', 'En cours'],
  ['scheduled', 'Programmées'],
  ['DELIVERED', 'Livrées'],
  ['CANCELLED', 'Annulées'],
]

const match = (o, f) => f === 'all' ? true
  : f === 'active' ? ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)
  : f === 'scheduled' ? o.status === 'SCHEDULED' || (o.scheduledAt && o.status === 'PENDING')
  : o.status === f

export default function Deliveries() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [orders, setOrders] = useState(null)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const openId = params.get('id')

  const load = useCallback(async () => {
    const res = await proApi.get('/orders/my', { params: { page: 1, limit: 200 } }).catch(() => null)
    setOrders(res?.data?.orders ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, (orders ?? []).filter(o => match(o, k)).length])), [orders])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (orders ?? []).filter(o => match(o, filter)).filter(o => !needle || [o.receiverName, o.receiverPhone, o.deliveryAddress, o.description, o.driver?.name]
      .some(v => String(v ?? '').toLowerCase().includes(needle)))
  }, [orders, filter, q])

  const open = (id) => setParams(id ? { id } : {}, { replace: true })

  return (
    <div>
      <div className="anim-up" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.7px', margin: 0 }}>Livraisons</h1>
          <div className="muted" style={{ marginTop: 4 }}>Les mêmes que dans votre application, mises à jour en direct.</div>
        </div>
        <Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>
      </div>

      <Card className="anim-up" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--p-line)' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--p-soft)', padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: 9, fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                background: filter === k ? '#fff' : 'transparent', color: filter === k ? 'var(--p-ink)' : 'var(--p-muted)',
                boxShadow: filter === k ? '0 1px 3px rgba(11,27,51,.1)' : 'none', transition: 'all .18s',
              }}>{label} <span style={{ opacity: .6, fontWeight: 600 }}>{orders ? counts[k] : ''}</span></button>
            ))}
          </div>
          <div style={{ position: 'relative', marginLeft: 'auto', width: 300, maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: 13, top: 15, color: '#9aa8bb' }} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, téléphone, adresse…" style={{ paddingLeft: 38 }} />
          </div>
        </div>

        {!orders ? (
          <div style={{ padding: 18, display: 'grid', gap: 10 }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={52} r={12} />)}</div>
        ) : list.length === 0 ? (
          <Empty icon={Bike} title={orders.length ? 'Aucune livraison pour ce filtre' : 'Pas encore de livraison'}
            text={orders.length ? 'Changez de filtre ou de recherche.' : 'Votre première livraison apparaîtra ici, et dans l\'application.'}
            action={!orders.length && <Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>} />
        ) : (
          <>
          {/* Téléphone : cartes ; tablette et ordinateur : tableau */}
          <div className="pro-only-sm stagger">
            {list.map(o => (
              <button key={o.id} className="row-hover" onClick={() => open(o.id)} style={{ display: 'grid', gap: 6, width: '100%', textAlign: 'left', padding: '14px 16px', border: 'none', borderTop: '1px solid var(--p-line)', background: openId === o.id ? '#f0f8fd' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.receiverName || '—'}</span>
                  <span className="num" style={{ fontWeight: 800 }}>{fcfa(orderTotal(o))}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.deliveryAddress}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge status={o.status} />
                  <span className="muted" style={{ fontSize: 12.5, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{o.driver?.name ? `${o.driver.name} · ` : ''}{timeAgo(o.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="pro-hide-only-sm" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr>{['Client', 'Destination', 'Statut', 'Coursier', 'Montant', 'Créée'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 12, fontWeight: 700, color: 'var(--p-muted)', background: 'var(--p-soft)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody className="stagger">
                {list.map(o => (
                  <tr key={o.id} className="row-hover" onClick={() => open(o.id)} style={{ cursor: 'pointer', borderTop: '1px solid var(--p-line)', background: openId === o.id ? '#f0f8fd' : undefined }}>
                    <td style={td}><div style={{ fontWeight: 700 }}>{o.receiverName || '—'}</div><div className="muted" style={{ fontSize: 12.5 }}>{phoneFmt(o.receiverPhone)}</div></td>
                    <td style={{ ...td, maxWidth: 280 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.deliveryAddress}</div>{o.description && <div className="muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.description}</div>}</td>
                    <td style={td}><StatusBadge status={o.status} /></td>
                    <td style={td}>{o.driver?.name ?? <span className="muted">—</span>}</td>
                    <td style={{ ...td, fontWeight: 800 }} className="num">{fcfa(orderTotal(o))}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }} className="muted">{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <OrderDrawer id={openId} onClose={() => open(null)} onChanged={load} />
    </div>
  )
}

const td = { padding: '14px 18px', fontSize: 13.5, verticalAlign: 'middle' }

// ── Fiche d'une livraison ────────────────────────────────────────────────────
function OrderDrawer({ id, onClose, onChanged }) {
  const notify = useNotify()
  const [order, setOrder] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const res = await proApi.get(`/orders/${id}`).catch(() => null)
    setOrder(res?.data?.order ?? res?.data ?? null)
  }, [id])
  useEffect(() => { setOrder(null); load() }, [load])
  useLiveRefresh(load)

  const share = async () => {
    try {
      const res = await proApi.get(`/orders/${id}/share-link`)
      await navigator.clipboard.writeText(res.data.shareUrl)
      notify.success('Lien de suivi copié', 'Envoyez-le à votre client : il suit le coursier en direct.')
    } catch (e) { notify.error('Lien indisponible', errMsg(e)) }
  }

  const o = order
  const steps = o ? [
    { icon: Receipt, label: 'Livraison créée', at: o.createdAt, done: true },
    { icon: Bike, label: o.driver?.name ? `Coursier trouvé — ${o.driver.name}` : 'Coursier trouvé', at: o.acceptedAt, done: !!o.acceptedAt },
    { icon: PackageCheck, label: 'Colis récupéré', at: o.pickedUpAt, done: !!o.pickedUpAt },
    { icon: CheckCircle2, label: 'Livrée', at: o.deliveredAt, done: !!o.deliveredAt },
  ] : []
  const cancellable = o && ['PENDING', 'ACCEPTED', 'SCHEDULED'].includes(o.status)

  return (
    <Drawer open={!!id} onClose={onClose} width={560}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--p-line)' }}>
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Livraison {id?.slice(0, 8).toUpperCase()}</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{o?.receiverName || (o ? 'Client' : '…')}</div>
        </div>
        {o && <StatusBadge status={o.status} />}
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
      </div>
      <div className="scroll-y" style={{ flex: 1, padding: 22, display: 'grid', gap: 18, alignContent: 'start' }}>
        {!o ? <><Skeleton h={220} r={16} /><Skeleton h={140} r={16} /></> : (
          <>
            <RouteMap order={o} />

            <div className="card" style={{ padding: 18 }}>
              {o.status === 'CANCELLED' ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--p-danger)', fontWeight: 700 }}>
                  <Ban size={18} /> Annulée {o.cancelledAt ? `le ${dateTime(o.cancelledAt)}` : ''}{o.cancelReason ? ` · ${o.cancelReason}` : ''}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 0 }}>
                  {steps.map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
                      {i < steps.length - 1 && <span style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, background: steps[i + 1].done ? 'var(--p-cyan)' : 'var(--p-line)' }} />}
                      <div style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, zIndex: 1, background: s.done ? 'var(--p-cyan)' : '#eef2f7', color: s.done ? '#fff' : '#9aa8bb', transition: 'all .3s' }}><s.icon size={16} /></div>
                      <div style={{ flex: 1, paddingTop: 5 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: s.done ? 'var(--p-ink)' : '#9aa8bb' }}>{s.label}</div>
                      </div>
                      <div className="muted num" style={{ fontSize: 12.5, paddingTop: 7 }}>{s.at ? timeOnly(s.at) : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
              <InfoRow icon={Store} label="Retrait" value={o.pickupAddress} />
              <InfoRow icon={MapPin} label="Livraison" value={o.deliveryAddress} />
              <InfoRow icon={User} label="Client" value={`${o.receiverName ?? '—'} · ${phoneFmt(o.receiverPhone)}`} />
              {o.description && <InfoRow icon={Receipt} label="Colis" value={o.description} />}
              {o.scheduledAt && <InfoRow icon={Clock} label="Programmée" value={dateTime(o.scheduledAt)} />}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <Row label="Livraison" value={fcfa(o.price)} />
              {Number(o.demFee) > 0 && <Row label="Frais de service" value={fcfa(o.demFee)} />}
              {Number(o.discountAmount) > 0 && <Row label="Réduction" value={`− ${fcfa(o.discountAmount)}`} />}
              <div style={{ borderTop: '1px dashed var(--p-line)', margin: '10px 0' }} />
              <Row label={<b>Total</b>} value={<b style={{ fontSize: 16 }}>{fcfa(orderTotal(o))}</b>} />
              <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {o.paymentMode === 'merchant' ? 'Payée par vous' : 'Payée par le client à la livraison'}{o.paymentStatus === 'PAID' ? ' · réglée' : ''}
              </div>
            </div>

            {o.driver?.phone && (
              <a className="btn btn-ghost" href={`tel:${o.driver.phone}`}><Phone size={16} /> Appeler le coursier · {phoneFmt(o.driver.phone)}</a>
            )}
          </>
        )}
      </div>
      {o && (
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--p-line)', display: 'flex', gap: 10, background: 'var(--p-soft)' }}>
          {ACTIVE_STATUSES.has(o.status) && <Button variant="ghost" icon={Link2} onClick={share} style={{ flex: 1 }}>Lien de suivi</Button>}
          {cancellable && <Button variant="danger" icon={Ban} onClick={() => setCancelOpen(true)}>Annuler</Button>}
          {!ACTIVE_STATUSES.has(o.status) && <Button variant="ghost" icon={Copy} onClick={() => { navigator.clipboard.writeText(o.id); notify.success('Référence copiée') }} style={{ flex: 1 }}>Copier la référence</Button>}
        </div>
      )}
      <CancelModal open={cancelOpen} order={o} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); load(); onChanged() }} />
    </Drawer>
  )
}

function InfoRow({ icon, label, value }) {
  const Icon = icon
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Icon size={17} color="var(--p-cyan-2)" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}><div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{value}</div></div>
    </div>
  )
}

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}><span className="muted">{label}</span><span className="num">{value}</span></div>
)

const REASONS = [
  ['CUSTOMER_CANCELLED', 'Mon client a annulé'],
  ['OUT_OF_STOCK', 'Article indisponible'],
  ['ORDER_MISTAKE', 'Créée par erreur'],
  ['WRONG_ADDRESS', 'Adresse ou infos erronées'],
  ['TOO_LONG', 'Trop long'],
  ['CHANGED_MIND', 'Changement d\'avis'],
]

function CancelModal({ open, order, onClose, onDone }) {
  const notify = useNotify()
  const [reason, setReason] = useState('CUSTOMER_CANCELLED')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await proApi.patch(`/orders/${order.id}/cancel`, { reason })
      notify.success('Livraison annulée', order.acceptedAt ? 'Le coursier est prévenu.' : null)
      onDone()
    } catch (e) { notify.error('Annulation impossible', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Annuler cette livraison ?" subtitle={order?.acceptedAt ? 'Un coursier est déjà en route : il sera prévenu.' : 'Aucun coursier ne l\'a encore acceptée.'}
      footer={<><Button variant="ghost" onClick={onClose}>Garder</Button><Button variant="danger" loading={busy} onClick={submit}>Annuler la livraison</Button></>}>
      <div style={{ display: 'grid', gap: 8 }}>
        {REASONS.map(([k, label]) => (
          <label key={k} className="row-hover" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${reason === k ? 'var(--p-cyan)' : 'var(--p-line)'}`, cursor: 'pointer', fontWeight: 600 }}>
            <input type="radio" checked={reason === k} onChange={() => setReason(k)} /> {label}
          </label>
        ))}
      </div>
    </Modal>
  )
}

// ── Carte : boutique, client, coursier ───────────────────────────────────────
const pin = (bg, svg) => L.divIcon({
  className: '', iconSize: [34, 34], iconAnchor: [17, 34],
  html: `<div style="width:34px;height:34px;border-radius:12px 12px 12px 2px;transform:rotate(-45deg);background:${bg};display:grid;place-items:center;box-shadow:0 6px 16px rgba(4,49,124,.35);border:2px solid #fff"><div style="transform:rotate(45deg);color:#fff;display:grid">${svg}</div></div>`,
})
const SVG_STORE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6"/></svg>'
const SVG_PIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/></svg>'
const SVG_BIKE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5L9 10h6l3.5 7.5"/></svg>'

function Fit({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const valid = JSON.parse(key).filter(Boolean)
    if (valid.length) map.fitBounds(L.latLngBounds(valid).pad(0.3), { animate: true })
  }, [map, key])
  return null
}

function RouteMap({ order: o }) {
  const pickup = o.pickupLatitude != null ? [o.pickupLatitude, o.pickupLongitude] : null
  const drop = o.deliveryLatitude != null ? [o.deliveryLatitude, o.deliveryLongitude] : null
  const driver = o.driver?.latitude != null && ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status) ? [o.driver.latitude, o.driver.longitude] : null
  if (!pickup && !drop) return null
  return (
    <div className="card" style={{ height: 240, overflow: 'hidden', padding: 0 }}>
      <MapContainer center={drop ?? pickup} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        <MapBaseLayer />
        {pickup && drop && <Polyline positions={[pickup, drop]} pathOptions={{ color: '#0671ba', weight: 3, dashArray: '6 8', opacity: .7 }} />}
        {pickup && <Marker position={pickup} icon={pin('#04317c', SVG_STORE)} />}
        {drop && <Marker position={drop} icon={pin('#0cb8de', SVG_PIN)} />}
        {driver && <Marker position={driver} icon={pin('#16a34a', SVG_BIKE)} />}
        <Fit points={[pickup, drop, driver]} />
      </MapContainer>
    </div>
  )
}
