import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Store, MapPin, User, Phone, Package, Clock, Zap, CalendarClock, Wallet, Users, Search, Check, Minus, Plus, ArrowRight, History, Navigation,
} from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi, { errMsg } from '../lib/proApi'
import { fcfa } from '../lib/format'
import { Button, Card, Skeleton, Spinner } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'

// Nouvelle livraison (simple ou programmée) : même création que l'app
// (POST /orders, prix officiel /orders/estimate garanti à la création).
const newToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export default function NewDelivery() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [params] = useSearchParams()
  const requestId = params.get('commande') // commande reçue par le lien, à livrer
  const [request, setRequest] = useState(null)
  const [addresses, setAddresses] = useState(null)
  const [recent, setRecent] = useState([])
  const [products, setProducts] = useState([])
  const [pickupId, setPickupId] = useState(null)
  const [drop, setDrop] = useState(null) // { address, lat, lng }
  const [landmark, setLandmark] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [items, setItems] = useState([]) // { productId?, name, quantity, price? }
  const [note, setNote] = useState('')
  const [payment, setPayment] = useState('cod')
  const [when, setWhen] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    proApi.get('/dem-pro/addresses').then(r => {
      setAddresses(r.data ?? [])
      setPickupId((r.data ?? []).find(a => a.isDefault)?.id ?? r.data?.[0]?.id ?? null)
    }).catch(() => setAddresses([]))
    proApi.get('/dem-pro/me/recent-destinations').then(r => setRecent(r.data ?? [])).catch(() => {})
    proApi.get('/dem-pro/products').then(r => setProducts((r.data ?? []).filter(p => !p.locked))).catch(() => {})
  }, [])

  // Commande reçue : client, adresse, repère, articles et note pré-remplis
  useEffect(() => {
    if (!requestId) return
    proApi.get('/dem-pro/order-requests').then(r => {
      const req = (r.data ?? []).find(x => x.id === requestId)
      if (!req) return
      setRequest(req)
      if (req.customerName) setName(req.customerName)
      if (req.customerPhone) setPhone(req.customerPhone.replace(/^\+221/, ''))
      if (req.deliveryLatitude != null) setDrop({ address: req.deliveryAddress, lat: req.deliveryLatitude, lng: req.deliveryLongitude })
      if (req.landmark) setLandmark(req.landmark)
      if (req.notes) setNote(req.notes)
      setItems((req.items ?? []).map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity ?? 1, price: i.price ?? undefined })))
      if (req.deliveryPayment === 'WITH_ORDER') setPayment('merchant')
    }).catch(() => {})
  }, [requestId])

  const pickup = useMemo(() => (addresses ?? []).find(a => a.id === pickupId), [addresses, pickupId])

  // Prix officiel dès que départ et arrivée sont connus
  useEffect(() => {
    if (!pickup || !drop) { setEstimate(null); return }
    let alive = true
    setEstimating(true)
    proApi.get('/orders/estimate', { params: { pickupLat: pickup.lat, pickupLng: pickup.lng, deliveryLat: drop.lat, deliveryLng: drop.lng, orderType: 'DELIVERY', priority: 'NORMAL' } })
      .then(r => alive && setEstimate(r.data)).catch(() => alive && setEstimate(null))
      .finally(() => alive && setEstimating(false))
    return () => { alive = false }
  }, [pickup, drop])

  const phoneDigits = phone.replace(/\D/g, '').slice(0, 9)
  const phoneOk = /^7[015678]\d{7}$/.test(phoneDigits)
  const scheduleOk = when === 'now' || (scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 15 * 60_000)
  const ready = pickup && drop && name.trim().length >= 2 && phoneOk && estimate && scheduleOk

  const submit = async () => {
    if (!ready) return
    setSubmitting(true)
    const parts = []
    if (items.length) parts.push(items.map(i => `${i.name} ×${i.quantity}`).join(', '))
    if (note.trim()) parts.push(note.trim())
    if (landmark.trim()) parts.push(`Repère: ${landmark.trim()}`)
    try {
      const res = await proApi.post('/orders', {
        orderType: 'DELIVERY',
        priority: 'NORMAL',
        pickupAddress: pickup.address,
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        deliveryAddress: drop.address,
        deliveryLatitude: drop.lat,
        deliveryLongitude: drop.lng,
        receiverName: name.trim(),
        receiverPhone: `+221${phoneDigits}`,
        ...(parts.length ? { description: parts.join(' · ') } : {}),
        price: estimate.price,
        demFee: estimate.demFee,
        ...(when === 'later' ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
        paymentMode: payment,
        proAddressId: pickup.id,
        ...(items.length ? { items: items.map(i => ({ name: i.name, quantity: i.quantity, ...(i.price ? { price: i.price } : {}), ...(i.productId ? { productId: i.productId } : {}) })) } : {}),
      })
      const order = res.data.order ?? res.data
      if (request) await proApi.post(`/dem-pro/order-requests/${request.id}/confirm`, { orderId: order.id }).catch(() => {})
      notify.success(when === 'later' ? 'Livraison programmée' : 'Livraison lancée', when === 'later' ? 'Elle partira à l\'heure choisie.' : 'Nous cherchons un coursier proche. Vous serez prévenu en direct.')
      window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
      navigate(`/livraisons?id=${order.id}`)
    } catch (e) {
      notify.error('Livraison non créée', errMsg(e))
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.7px', margin: 0 }}>{request ? 'Livrer la commande reçue' : 'Nouvelle livraison'}</h1>
        <div className="muted" style={{ marginTop: 4 }}>{request
          ? `Commande de ${request.customerName || 'votre client'} pré-remplie${request.paidAt ? ' · articles payés en ligne' : ''}. Vérifiez puis lancez la livraison.`
          : 'Un coursier DEM récupère le colis chez vous et le livre à votre client.'}</div>
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
        <div style={{ display: 'grid', gap: 18 }} className="stagger">
          {/* Retrait */}
          <Step n={1} icon={Store} title="Point de retrait" hint="Où le coursier récupère le colis">
            {!addresses ? <Skeleton h={64} r={14} /> : addresses.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>Ajoutez une adresse de boutique dans Compte › Mes adresses.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {addresses.map(a => (
                  <Choice key={a.id} active={a.id === pickupId} onClick={() => setPickupId(a.id)} icon={Store} title={a.label} text={a.address} />
                ))}
              </div>
            )}
          </Step>

          {/* Client */}
          <Step n={2} icon={User} title="Votre client" hint="Le coursier l'appelle à l'arrivée">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field"><span>Nom</span><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Fatou Sow" /></label>
              <label className="field"><span>Téléphone</span>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: 13, top: 16, color: '#9aa8bb' }} />
                  <input className="input" inputMode="numeric" value={phoneDigits.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(' '))}
                    onChange={e => setPhone(e.target.value)} placeholder="77 123 45 67" style={{ paddingLeft: 36, borderColor: phone && !phoneOk ? '#f3b4b4' : undefined }} />
                </div>
              </label>
            </div>
            {recent.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><History size={13} /> Clients récents</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {recent.slice(0, 6).map(r => (
                    <button key={`${r.receiverPhone}-${r.address}`} className="btn btn-ghost btn-sm" onClick={() => {
                      if (r.receiverName) setName(r.receiverName)
                      if (r.receiverPhone) setPhone(r.receiverPhone.replace(/^\+221/, ''))
                      if (r.lat != null) setDrop({ address: r.address, lat: r.lat, lng: r.lng })
                    }}>{r.receiverName ?? r.address}</button>
                  ))}
                </div>
              </div>
            )}
          </Step>

          {/* Destination */}
          <Step n={3} icon={MapPin} title="Adresse de livraison" hint="Cherchez, ou touchez la carte à droite">
            <PlaceSearch value={drop} onPick={setDrop} />
            <label className="field" style={{ marginTop: 12 }}><span>Repère (conseillé)</span>
              <input className="input" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Ex. face pharmacie, 2e étage, portail bleu" /></label>
          </Step>

          {/* Colis */}
          <Step n={4} icon={Package} title="Colis" hint="Facultatif — affiché au coursier et sur le reçu">
            {products.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {products.slice(0, 12).map(p => {
                  const it = items.find(i => i.productId === p.id)
                  return (
                    <button key={p.id} className="btn btn-ghost btn-sm" style={{ borderColor: it ? 'var(--p-cyan)' : undefined, background: it ? '#e3f8fc' : undefined }}
                      onClick={() => setItems(list => it ? list.filter(i => i.productId !== p.id) : [...list, { productId: p.id, name: p.name, quantity: 1, price: p.defaultPrice ?? undefined }])}>
                      {it ? <Check size={14} /> : <Plus size={14} />} {p.name}
                    </button>
                  )
                })}
              </div>
            )}
            {items.map(it => (
              <div key={it.productId ?? it.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: 'var(--p-soft)', marginBottom: 6 }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>{it.name}</span>
                {it.price ? <span className="muted num" style={{ fontSize: 12.5 }}>{fcfa(it.price)}</span> : null}
                <Qty value={it.quantity} onChange={(q) => setItems(list => list.map(x => x === it ? { ...x, quantity: q } : x))} />
              </div>
            ))}
            <label className="field" style={{ marginTop: 8 }}><span>Description du colis</span>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex. 1 sac fragile" /></label>
          </Step>

          {/* Paiement et horaire */}
          <Step n={5} icon={Wallet} title="Paiement et horaire">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Choice active={payment === 'cod'} onClick={() => setPayment('cod')} icon={Users} title="Mon client paie" text="La livraison est réglée au coursier par le client" />
              <Choice active={payment === 'merchant'} onClick={() => setPayment('merchant')} icon={Store} title="Je paie" text="Vous réglez le coursier au retrait" />
              <Choice active={when === 'now'} onClick={() => setWhen('now')} icon={Zap} title="Maintenant" text="Un coursier part tout de suite" />
              <Choice active={when === 'later'} onClick={() => setWhen('later')} icon={CalendarClock} title="Programmer" text="À une date et une heure précises" />
            </div>
            {when === 'later' && (
              <label className="field anim-up" style={{ marginTop: 12 }}><span>Date et heure de retrait</span>
                <input type="datetime-local" className="input" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                {scheduledAt && !scheduleOk && <small style={{ color: 'var(--p-danger)', fontWeight: 600 }}>Au moins 15 minutes à l'avance.</small>}
              </label>
            )}
          </Step>
        </div>

        {/* Résumé fixe */}
        <div style={{ position: 'sticky', top: 92, display: 'grid', gap: 16 }} className="anim-up">
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 300 }}>
              <PickMap pickup={pickup} drop={drop} onPick={setDrop} />
            </div>
            <div style={{ padding: 20 }}>
              <SummaryRow icon={Store} label="Retrait" value={pickup?.label ?? '—'} />
              <SummaryRow icon={MapPin} label="Livraison" value={drop?.address ?? 'À choisir'} muted={!drop} />
              <SummaryRow icon={Clock} label="Départ" value={when === 'now' ? 'Dès maintenant' : scheduledAt ? new Date(scheduledAt).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'À programmer'} />
              <div style={{ borderTop: '1px dashed var(--p-line)', margin: '14px 0' }} />
              {estimating ? <Skeleton h={50} r={12} /> : estimate ? (
                <div className="anim-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="muted"><span>Livraison · {estimate.distanceKm} km</span><span className="num">{fcfa(estimate.price)}</span></div>
                  {estimate.demFee > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }} className="muted"><span>Frais de service</span><span className="num">{fcfa(estimate.demFee)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                    <span style={{ fontWeight: 800 }}>Total</span>
                    <span style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-.6px' }} className="num">{fcfa(estimate.totalClient ?? estimate.price + estimate.demFee)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{payment === 'cod' ? 'Payé par votre client à la livraison' : 'Payé par vous au coursier'}</div>
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>Le prix s'affiche dès que l'adresse de livraison est choisie.</div>
              )}
              <Button size="lg" loading={submitting} disabled={!ready} onClick={submit} style={{ width: '100%', marginTop: 18 }}>
                {when === 'later' ? 'Programmer la livraison' : 'Lancer la livraison'} <ArrowRight size={17} />
              </Button>
              {!ready && <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                {!drop ? 'Choisissez l\'adresse de livraison' : name.trim().length < 2 ? 'Indiquez le nom du client' : !phoneOk ? 'Numéro du client : mobile sénégalais (77, 78, 76, 70, 75)' : !scheduleOk ? 'Choisissez l\'heure de la livraison' : ''}
              </div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Step({ n, icon, title, hint, children }) {
  const Icon = icon
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--p-gradient)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>{n}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 8 }}><Icon size={16} color="var(--p-cyan-2)" /> {title}</div>
          {hint && <div className="muted" style={{ fontSize: 12.5 }}>{hint}</div>}
        </div>
      </div>
      {children}
    </Card>
  )
}

function Choice({ active, onClick, icon, title, text }) {
  const Icon = icon
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 12,
      border: `1.5px solid ${active ? 'var(--p-cyan)' : 'var(--p-line)'}`, background: active ? '#f0fafd' : '#fff',
      boxShadow: active ? '0 0 0 4px rgba(12,184,222,.10)' : 'none', transition: 'all .18s',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: active ? 'var(--p-cyan)' : 'var(--p-soft)', color: active ? '#fff' : 'var(--p-muted)', flexShrink: 0, transition: 'all .18s' }}><Icon size={17} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--p-ink)' }}>{title}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{text}</div>
      </div>
    </button>
  )
}

function Qty({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 28, height: 28 }} onClick={() => onChange(Math.max(1, value - 1))}><Minus size={13} /></button>
      <span className="num" style={{ minWidth: 20, textAlign: 'center', fontWeight: 800 }}>{value}</span>
      <button className="btn btn-ghost btn-icon btn-sm" style={{ width: 28, height: 28 }} onClick={() => onChange(Math.min(99, value + 1))}><Plus size={13} /></button>
    </div>
  )
}

function SummaryRow({ icon, label, value, muted }) {
  const Icon = icon
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' }}>
      <Icon size={16} color="var(--p-cyan-2)" style={{ marginTop: 2 }} />
      <span className="muted" style={{ fontSize: 13, width: 70 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: muted ? '#9aa8bb' : undefined }}>{value}</span>
    </div>
  )
}

// Recherche d'adresse (Google via le serveur DEM, comme dans l'app)
export function PlaceSearch({ value, onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const token = useRef(newToken())
  useEffect(() => {
    const input = q.trim()
    if (input.length < 3) { setResults([]); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      proApi.get('/public/places/autocomplete', { params: { input, sessionToken: token.current } })
        .then(r => alive && setResults(r.data.predictions ?? [])).catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false))
    }, 280)
    return () => { alive = false; clearTimeout(t) }
  }, [q])
  const pick = async (p) => {
    setOpen(false)
    try {
      const r = await proApi.get('/public/places/details', { params: { placeId: p.place_id, sessionToken: token.current } })
      token.current = newToken()
      if (r.data.lat != null) { onPick({ address: r.data.address ?? p.description, lat: r.data.lat, lng: r.data.lng }); setQ('') }
    } catch { /* adresse introuvable */ }
  }
  return (
    <div style={{ position: 'relative' }}>
      {value && (
        <div className="anim-in" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: '#f0fafd', border: '1.5px solid var(--p-cyan)', marginBottom: 10 }}>
          <MapPin size={17} color="var(--p-cyan-2)" />
          <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>{value.address}</span>
          <Check size={17} color="var(--p-success)" />
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 13, top: 15, color: '#9aa8bb' }} />
        <input className="input" value={q} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true) }}
          placeholder={value ? 'Changer d\'adresse…' : 'Quartier, rue, lieu connu…'} style={{ paddingLeft: 38 }} />
        {loading && <span style={{ position: 'absolute', right: 14, top: 14, color: '#9aa8bb' }}><Spinner size={16} /></span>}
      </div>
      {open && results.length > 0 && (
        <div className="card anim-scale" style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 6, zIndex: 30, padding: 6, boxShadow: 'var(--p-shadow-lg)' }}>
          {results.slice(0, 6).map(p => (
            <button key={p.place_id} className="pro-menu-item" onClick={() => pick(p)} style={{ alignItems: 'flex-start', textAlign: 'left' }}>
              <MapPin size={16} color="var(--p-cyan-2)" style={{ marginTop: 2, flexShrink: 0 }} />
              <span><b style={{ fontWeight: 700 }}>{p.structured_formatting?.main_text ?? p.description}</b><br /><span className="muted" style={{ fontSize: 12 }}>{p.structured_formatting?.secondary_text ?? ''}</span></span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 3 && !loading && results.length === 0 && (
        <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Aucun résultat : touchez la carte pour placer le point de livraison.</div>
      )}
    </div>
  )
}

// Carte : départ, arrivée ; un clic place l'arrivée (adresse retrouvée)
const pinIcon = (bg, label) => L.divIcon({
  className: '', iconSize: [30, 30], iconAnchor: [15, 30],
  html: `<div style="width:30px;height:30px;border-radius:11px 11px 11px 2px;transform:rotate(-45deg);background:${bg};box-shadow:0 6px 16px rgba(4,49,124,.35);border:2px solid #fff;display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font:800 12px Plus Jakarta Sans">${label}</span></div>`,
})

function ClickToPick({ onPick }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng
      let address = `Point choisi (${lat.toFixed(5)}, ${lng.toFixed(5)})`
      try { const r = await proApi.get('/public/places/reverse-geocode', { params: { lat, lng } }); if (r.data.address) address = r.data.address } catch { /* coordonnées seules */ }
      onPick({ address, lat, lng })
    },
  })
  return null
}

// Recadre la carte quand un point change (clé texte : pas de nouvel objet à chaque rendu)
function FitTo({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const v = JSON.parse(key).filter(Boolean)
    if (v.length === 2) map.fitBounds(L.latLngBounds(v).pad(0.35), { animate: true })
    else if (v.length === 1) map.setView(v[0], 14, { animate: true })
  }, [map, key])
  return null
}

function PickMap({ pickup, drop, onPick }) {
  const a = pickup ? [pickup.lat, pickup.lng] : null
  const b = drop ? [drop.lat, drop.lng] : null
  return (
    <MapContainer center={a ?? [14.7167, -17.4677]} zoom={13} style={{ height: '100%', width: '100%', cursor: 'crosshair' }} zoomControl={false} attributionControl={false}>
      <MapBaseLayer />
      <ClickToPick onPick={onPick} />
      {a && b && <Polyline positions={[a, b]} pathOptions={{ color: '#0671ba', weight: 3, dashArray: '6 8' }} />}
      {a && <Marker position={a} icon={pinIcon('#04317c', 'A')} />}
      {b && <Marker position={b} icon={pinIcon('#0cb8de', 'B')} />}
      <FitTo points={[a, b]} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 500, background: 'rgba(255,255,255,.92)', padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Navigation size={13} color="var(--p-cyan-2)" /> Touchez la carte pour placer le point B
      </div>
    </MapContainer>
  )
}
