import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MousePointerClick } from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi from '../lib/proApi'
import { BATCH_STATUS, STOP_STATUS } from './batch'

// Tournées groupées : badges de statut et carte (retrait, arrêts numérotés,
// coursier). Constantes et calculs : batch.js.

function Badge({ s, fallback }) {
  const v = s ?? { label: fallback, color: '#475569', bg: '#F1F5F9' }
  return (
    <span className="badge" style={{ background: v.bg, color: v.color }}>
      <span className="badge-dot" aria-hidden />
      {v.label}
    </span>
  )
}
export const BatchBadge = ({ status }) => <Badge s={BATCH_STATUS[status]} fallback={status} />
export const StopBadge = ({ status }) => <Badge s={STOP_STATUS[status]} fallback={status} />

// ── Carte : retrait, arrêts numérotés, coursier ─────────────────────────────
const SVG_STORE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M3 9l1-5h16l1 5M4 9v11h16V9"/></svg>'
const SVG_BIKE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5L9 10h6l3.5 7.5"/></svg>'
const SVG_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>'

const roundIcon = (bg, inner, size = 26) => L.divIcon({
  className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:grid;place-items:center;color:#fff;font:700 11.5px 'DM Sans',sans-serif">${inner}</div>`,
})
// Arrêt numéroté : carré bleu nuit (charte à angles vifs), vert une fois livré
const stopIcon = (n, state) => L.divIcon({
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  html: `<div style="width:26px;height:26px;background:${state === 'done' ? '#15803D' : state === 'off' ? '#94A3B8' : state === 'active' ? '#0086C8' : '#021520'};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:grid;place-items:center;color:#fff;font:700 12px 'DM Sans',sans-serif">${state === 'done' ? SVG_CHECK : n}</div>`,
})
const pickupIcon = roundIcon('#021520', SVG_STORE)
const driverIcon = roundIcon('#15803D', SVG_BIKE)

function Fit({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const v = JSON.parse(key).filter(Boolean)
    map.invalidateSize()
    if (v.length > 1) map.fitBounds(L.latLngBounds(v).pad(0.25), { animate: false })
    else if (v.length === 1) map.setView(v[0], 14, { animate: false })
  }, [map, key])
  return null
}

function ClickToPick({ onPick }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng
      let address = 'Point placé sur la carte'
      try { const r = await proApi.get('/public/places/reverse-geocode', { params: { lat, lng } }); if (r.data.address) address = r.data.address } catch { /* sans adresse */ }
      onPick({ address, lat, lng })
    },
  })
  return null
}

// pickup : { lat, lng } ; stops : [{ lat, lng, state? ('done' | 'off' | 'active') }]
// (null pour un arrêt pas encore placé) ; driver : { lat, lng } ;
// onPick : clic sur la carte → place un point (création) ; hint : texte affiché.
export function BatchMap({ pickup, stops = [], driver, onPick, hint }) {
  const a = pickup?.lat != null ? [pickup.lat, pickup.lng] : null
  const pts = stops.map(s => (s?.lat != null ? [s.lat, s.lng] : null))
  const path = [a, ...pts].filter(Boolean)
  const d = driver?.lat != null && driver.lat !== 0 ? [driver.lat, driver.lng] : null
  return (
    <MapContainer center={a ?? pts.find(Boolean) ?? [14.7167, -17.4677]} zoom={13}
      style={{ height: '100%', width: '100%', cursor: onPick ? 'crosshair' : 'grab' }} zoomControl={false} attributionControl={false}>
      <MapBaseLayer />
      {onPick && <ClickToPick onPick={onPick} />}
      {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#021520', weight: 2, dashArray: '6 6', opacity: .75 }} />}
      {a && <Marker position={a} icon={pickupIcon} />}
      {pts.map((p, i) => p && <Marker key={`${i}-${stops[i]?.state ?? ''}`} position={p} icon={stopIcon(i + 1, stops[i]?.state)} />)}
      {d && <Marker position={d} icon={driverIcon} zIndexOffset={1000} />}
      <Fit points={[a, ...pts, d]} />
      {hint && <div className="nd-map-hint"><MousePointerClick size={13} aria-hidden /> {hint}</div>}
    </MapContainer>
  )
}
