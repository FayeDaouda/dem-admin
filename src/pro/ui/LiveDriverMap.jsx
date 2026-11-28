import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair } from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi from '../lib/proApi'
import { proSocket } from '../lib/proSocket'

// Carte du suivi d'une livraison : retrait, destination et coursier en
// direct — mêmes sources que l'app (dem_pro_order_tracking_screen.dart) :
//  - position : événement socket `driver:location` { lat, lng, orderId },
//    relayé par le serveur à chaque position du coursier (courses ACCEPTED et
//    PICKED_UP) ; à l'ouverture et à chaque reconnexion, la dernière position
//    connue est demandée (`client:requestDriverLocation` { orderId }) ;
//  - itinéraire : GET /orders/:id/route (tracé OSRM partagé, encodé), refait
//    au changement d'étape et, au plus toutes les 20 s, tant qu'il ne part
//    pas encore du coursier (60 s ensuite) — le quota est partagé avec l'app.
const ON_THE_WAY = new Set(['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'])
const ROUTE_STATUSES = new Set(['PENDING', 'SCHEDULED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'])

// Polyline Google (précision 5), format de l'OSRM du serveur
function decodePolyline(str) {
  const out = []
  let i = 0, lat = 0, lng = 0
  while (i < (str?.length ?? 0)) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20 && i < str.length)
      const d = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += d; else lng += d
    }
    out.push([lat / 1e5, lng / 1e5])
  }
  return out
}

const dot = (bg, svg, size = 24) => L.divIcon({
  className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(2,21,32,.3);display:grid;place-items:center;color:#fff">${svg}</div>`,
})
const SVG_STORE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M3 9l1-5h16l1 5M4 9v11h16V9"/></svg>'
const SVG_PIN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/></svg>'
const SVG_BIKE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5L9 10h6l3.5 7.5"/></svg>'
const ICON_PICKUP = dot('#021520', SVG_STORE)
const ICON_DROP = dot('#0086C8', SVG_PIN)
const ICON_DRIVER = dot('#15803D', SVG_BIKE, 30)

const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// Moto : glisse d'une position à la suivante (pas de saut à chaque relevé)
function DriverMarker({ position }) {
  const ref = useRef(null)
  const shown = useRef(position)
  // Position initiale seulement : la suite est animée ici (sinon la moto
  // sauterait à l'arrivée avant de glisser)
  const [initial] = useState(position)
  useEffect(() => {
    const m = ref.current
    const from = shown.current
    if (!m || !position) return
    if (!from || reducedMotion()) { m.setLatLng(position); shown.current = position; return }
    let raf = 0
    const start = performance.now()
    const step = (t) => {
      const k = Math.min(1, (t - start) / 900)
      const e = 1 - (1 - k) ** 3
      const p = [from[0] + (position[0] - from[0]) * e, from[1] + (position[1] - from[1]) * e]
      m.setLatLng(p); shown.current = p
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [position])
  return <Marker ref={ref} position={initial} icon={ICON_DRIVER} zIndexOffset={1000} />
}

// Cadrage : tout voir à l'ouverture et à chaque étape ; ensuite, la carte
// suit le coursier seulement s'il sort de l'écran (on peut zoomer librement)
function Framing({ points, frameKey, follow, recenter }) {
  const map = useMap()
  const key = JSON.stringify(points)
  const fit = useCallback(() => {
    const v = JSON.parse(key).filter(Boolean)
    map.invalidateSize()
    if (v.length > 1) map.fitBounds(L.latLngBounds(v).pad(0.3), { animate: false, maxZoom: 16 })
    else if (v.length === 1) map.setView(v[0], 15, { animate: false })
  }, [map, key])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fit() }, [map, frameKey, recenter])
  useEffect(() => {
    if (follow && !map.getBounds().pad(-0.08).contains(follow)) map.panTo(follow, { animate: !reducedMotion() })
  }, [map, follow])
  return null
}

export default function LiveDriverMap({ order: o }) {
  const id = o.id
  const status = o.status
  const onTheWay = ON_THE_WAY.has(status)
  const pickup = useMemo(() => (o.pickupLatitude != null ? [o.pickupLatitude, o.pickupLongitude] : null), [o.pickupLatitude, o.pickupLongitude])
  const drop = useMemo(() => (o.deliveryLatitude != null ? [o.deliveryLatitude, o.deliveryLongitude] : null), [o.deliveryLatitude, o.deliveryLongitude])
  const dLat = onTheWay ? o.driver?.latitude : null
  const dLng = onTheWay ? o.driver?.longitude : null
  const known = useMemo(() => (dLat != null && dLng != null ? [dLat, dLng] : null), [dLat, dLng])
  const [live, setLive] = useState(null) // { pos, at } reçu en direct
  const [route, setRoute] = useState(null) // { points, from, legs, durationSeconds, at, status }
  const [recenter, setRecenter] = useState(0)
  // Horloge du bandeau (« En direct », minutes restantes), relue toutes les 15 s
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!onTheWay) return
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [onTheWay])
  const driver = onTheWay ? (live?.pos ?? known) : null

  // Position en direct (socket partagé de l'espace web)
  useEffect(() => {
    if (!onTheWay) return
    const s = proSocket()
    const onLoc = (p) => {
      if (p?.orderId !== id) return
      const lat = Number(p.lat), lng = Number(p.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      setLive({ pos: [lat, lng], at: Date.now() })
    }
    const ask = () => s.emit('client:requestDriverLocation', { orderId: id })
    s.on('driver:location', onLoc)
    s.on('connect', ask)
    if (s.connected) ask()
    return () => { s.off('driver:location', onLoc); s.off('connect', ask) }
  }, [id, onTheWay])

  // Itinéraire (tracé routier) : à l'ouverture, à chaque étape, puis selon
  // la position du coursier (voir l'en-tête)
  // Seule la réponse du dernier appel compte (étape changée entre-temps)
  const seq = useRef(0)
  const lastFetch = useRef(0)
  const fetchRoute = useCallback(async () => {
    const n = ++seq.current
    lastFetch.current = Date.now()
    try {
      const r = await proApi.get(`/orders/${id}/route`)
      if (n !== seq.current) return
      const points = decodePolyline(r.data?.polyline)
      setRoute(points.length > 1 ? { points, from: r.data?.from, legs: r.data?.legs ?? [], durationSeconds: r.data?.durationSeconds, at: Date.now(), status } : null)
    } catch {
      if (n === seq.current) setRoute(null) // tracé indisponible : ligne droite
    }
  }, [id, status])
  useEffect(() => {
    if (!ROUTE_STATUSES.has(status) || !pickup || !drop) { setRoute(null); return }
    fetchRoute()
  }, [status, pickup, drop, fetchRoute])
  useEffect(() => {
    if (!driver || !pickup || !drop || (route && route.status !== status)) return
    const wait = route && route.from !== 'driver' ? 20_000 : 60_000
    if (Date.now() - lastFetch.current >= wait) fetchRoute()
  }, [driver, route, status, pickup, drop, fetchRoute])

  if (!pickup && !drop) return null

  // Ce qu'il reste à parcourir : coursier → retrait (ACCEPTED), coursier → client ensuite
  const line = route?.points ?? (driver
    ? (status === 'ACCEPTED' ? [driver, pickup, drop] : [driver, drop]).filter(Boolean)
    : [pickup, drop].filter(Boolean))
  const fromDriver = route?.from === 'driver' && route.status === status
  const legSec = fromDriver ? (status === 'ACCEPTED' ? route.legs?.[0]?.durationSeconds : route.durationSeconds) : null
  const etaMin = legSec != null ? Math.max(1, Math.round((legSec - Math.max(0, now - route.at) / 1000) / 60)) : null
  const fresh = !!live && now - live.at < 120_000

  return (
    <div className="dl-map dv-live-map">
      <MapContainer center={driver ?? drop ?? pickup} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        <MapBaseLayer />
        {line.length > 1 && (route
          ? <Polyline positions={line} pathOptions={{ color: '#021520', weight: 4, opacity: .85 }} />
          : <Polyline positions={line} pathOptions={{ color: '#021520', weight: 2, dashArray: '6 6', opacity: .7 }} />)}
        {pickup && <Marker position={pickup} icon={ICON_PICKUP} />}
        {drop && <Marker position={drop} icon={ICON_DROP} />}
        {driver && <DriverMarker position={driver} />}
        <Framing points={[pickup, drop, driver]} frameKey={`${status}|${!!driver}`} follow={driver} recenter={recenter} />
      </MapContainer>

      {onTheWay && (
        <div className="dv-live-top" aria-live="polite">
          {driver ? (
            <span className={`dv-live-chip ${fresh ? 'is-live' : ''}`}>
              <i aria-hidden />{fresh ? 'En direct' : 'Dernière position connue'}
            </span>
          ) : (
            <span className="dv-live-chip">Position du coursier en attente…</span>
          )}
          {etaMin != null && (
            <span className="dv-live-eta">
              {status === 'ACCEPTED' ? 'Au retrait' : 'Chez votre client'} dans ≈ <b className="num">{etaMin} min</b>
            </span>
          )}
        </div>
      )}
      <button type="button" className="dv-recenter" onClick={() => setRecenter(n => n + 1)} aria-label="Recentrer la carte" title="Recentrer la carte">
        <Crosshair size={15} aria-hidden />
      </button>
      <div className="dl-map-legend" aria-hidden>
        <span><i style={{ background: '#021520' }} />Retrait</span>
        <span><i style={{ background: '#0086C8' }} />Destination</span>
        {driver && <span><i style={{ background: '#15803D' }} />Coursier</span>}
      </div>
    </div>
  )
}
