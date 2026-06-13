import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { connectSocket, disconnectSocket } from '../lib/socket'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw } from 'lucide-react'

// Fix icônes Leaflet avec Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        width:32px;height:32px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:14px">${label}</span>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
}

const DRIVER_ICON  = makeIcon('#6366f1', '🏍')
const PICKUP_ICON  = makeIcon('#f59e0b', '📦')
const DELIVERY_ICON = makeIcon('#22c55e', '🏁')

// Centre auto sur les marqueurs
function AutoFit({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [points, map])
  return null
}

export default function LiveMap() {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showDrivers, setShowDrivers]   = useState(true)
  const [showOrders, setShowOrders]     = useState(true)
  const [showRoutes, setShowRoutes]     = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/admin/live')
      setSnapshot(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const s = connectSocket()
    const refresh = () => fetch()

    s.on('admin:order:new',        refresh)
    s.on('admin:order:accepted',   refresh)
    s.on('admin:order:pickedup',   refresh)
    s.on('admin:order:delivered',  refresh)
    s.on('admin:order:cancelled',  refresh)

    return () => {
      ['admin:order:new','admin:order:accepted','admin:order:pickedup',
       'admin:order:delivered','admin:order:cancelled',
      ].forEach(ev => s.off(ev))
      disconnectSocket()
    }
  }, [fetch])

  const drivers = snapshot?.availableDrivers ?? []
  const orders  = snapshot?.activeOrders ?? []

  // Tous les points pour le autofit
  const allPoints = [
    ...drivers.filter(d => d.latitude).map(d => [d.latitude, d.longitude]),
    ...orders.filter(o => o.pickupLatitude).map(o => [o.pickupLatitude, o.pickupLongitude]),
  ]

  // Centre de secours : Dakar
  const defaultCenter = [14.6937, -17.4441]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Carte en temps réel</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {drivers.length} driver{drivers.length !== 1 ? 's' : ''} en ligne · {orders.length} course{orders.length !== 1 ? 's' : ''} active{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['Drivers', showDrivers, setShowDrivers, '#6366f1'],
            ['Courses', showOrders,  setShowOrders,  '#f59e0b'],
            ['Trajets', showRoutes,  setShowRoutes,  '#38bdf8'],
          ].map(([label, active, setter, color]) => (
            <button
              key={label}
              onClick={() => setter(v => !v)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: `1px solid ${active ? color : 'var(--border)'}`,
                background: active ? color + '22' : 'transparent',
                color: active ? color : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          <button onClick={fetch} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
          }}>
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--text-muted)' }}>
            Chargement de la carte…
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {allPoints.length > 0 && <AutoFit points={allPoints} />}

            {/* Drivers en ligne */}
            {showDrivers && drivers.map(d => (
              d.latitude && (
                <Marker key={d.id} position={[d.latitude, d.longitude]} icon={DRIVER_ICON}>
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>{d.name ?? 'Driver'}</strong><br />
                      <span style={{ color: '#666', fontSize: 12 }}>{d.phone}</span><br />
                      <span style={{ fontSize: 12 }}>{d.vehicleType ?? '—'}</span>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}

            {/* Courses actives */}
            {showOrders && orders.map(o => (
              <span key={o.id}>
                {/* Point pickup */}
                {o.pickupLatitude && (
                  <Marker position={[o.pickupLatitude, o.pickupLongitude]} icon={PICKUP_ICON}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>Pickup</strong> — <Badge status={o.status} /><br />
                        <span style={{ fontSize: 12, color: '#666' }}>{o.pickupAddress}</span><br />
                        <span style={{ fontSize: 12 }}>Client : {o.client?.name ?? '—'}</span><br />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{o.price?.toLocaleString()} F</span>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* Point livraison */}
                {o.deliveryLatitude && (
                  <Marker position={[o.deliveryLatitude, o.deliveryLongitude]} icon={DELIVERY_ICON}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>Livraison</strong><br />
                        <span style={{ fontSize: 12, color: '#666' }}>{o.deliveryAddress}</span><br />
                        {o.driver && <span style={{ fontSize: 12 }}>Driver : {o.driver.name}</span>}
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* Ligne pickup → livraison */}
                {showRoutes && o.pickupLatitude && o.deliveryLatitude && (
                  <Polyline
                    positions={[
                      [o.pickupLatitude, o.pickupLongitude],
                      [o.deliveryLatitude, o.deliveryLongitude],
                    ]}
                    color="#38bdf8"
                    weight={2}
                    dashArray="6 4"
                    opacity={0.6}
                  />
                )}
              </span>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 12, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
        <span>🏍 Driver disponible</span>
        <span>📦 Point de pickup</span>
        <span>🏁 Point de livraison</span>
        <span style={{ color: '#38bdf8' }}>— — Trajet estimé</span>
      </div>
    </div>
  )
}
