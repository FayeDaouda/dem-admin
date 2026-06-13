import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import fleetApi from '../../lib/fleetApi'
import { RefreshCw } from 'lucide-react'
import { glass, pageWrap, pageScroll } from '../../lib/glassStyles'
import { useResponsive } from '../../lib/useResponsive'

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
        width:30px;height:30px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:13px">${label}</span>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32],
  })
}

const ICONS = {
  busy:      makeIcon('#7c3aed', '🏍'),
  available: makeIcon('#22c55e', '🏍'),
  offline:   makeIcon('#94a3b8', '🏍'),
  pickup:    makeIcon('#f59e0b', '📦'),
  delivery:  makeIcon('#22c55e', '🏁'),
}

const STATE_LABEL = { busy: 'En course', available: 'Disponible', offline: 'Hors ligne' }
const STATE_COLOR = { busy: '#7c3aed', available: '#22c55e', offline: '#94a3b8' }

function driverState(d) {
  if (d.currentOrder) return 'busy'
  if (d.isAvailable)  return 'available'
  return 'offline'
}

// Centre auto sur les marqueurs
function AutoFit({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [points, map])
  return null
}

const DAKAR_CENTER = [14.6937, -17.4441]

export default function FleetMap() {
  const { isMobile } = useResponsive()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLive = useCallback(async () => {
    try {
      const res = await fleetApi.get('/chefs-de-flotte/me/drivers/live')
      setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 15000)
    return () => clearInterval(interval)
  }, [fetchLive])

  const located = drivers.filter(d => d.latitude != null && d.longitude != null)
  const onlineCount = drivers.filter(d => driverState(d) !== 'offline').length

  const points = [
    ...located.map(d => [d.latitude, d.longitude]),
    ...located.flatMap(d => d.currentOrder ? [
      ...(d.currentOrder.pickupLatitude   != null ? [[d.currentOrder.pickupLatitude, d.currentOrder.pickupLongitude]] : []),
      ...(d.currentOrder.deliveryLatitude != null ? [[d.currentOrder.deliveryLatitude, d.currentOrder.deliveryLongitude]] : []),
    ] : []),
  ]

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Suivi des livreurs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {onlineCount} / {drivers.length} livreur{drivers.length !== 1 ? 's' : ''} en ligne
          </p>
        </div>
        <button onClick={fetchLive} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
      </div>

      <div style={pageScroll}>
        <div style={{ ...glass, padding: 0, height: isMobile ? 280 : 420, overflow: 'hidden', marginBottom: 20, borderRadius: 'var(--radius)' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Chargement de la carte…
            </div>
          ) : (
            <MapContainer center={DAKAR_CENTER} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {points.length > 0 && <AutoFit points={points} />}

              {located.map(d => {
                const state = driverState(d)
                return (
                  <span key={d.id}>
                    <Marker position={[d.latitude, d.longitude]} icon={ICONS[state]}>
                      <Popup>
                        <div style={{ minWidth: 160 }}>
                          <strong>{d.name?.trim() || d.phone}</strong><br />
                          <span style={{ fontSize: 12, color: '#666' }}>{d.phone}</span><br />
                          <span style={{ fontSize: 12 }}>{d.vehicleType ?? '—'}</span><br />
                          <span style={{ fontSize: 12, fontWeight: 600, color: STATE_COLOR[state] }}>{STATE_LABEL[state]}</span>
                        </div>
                      </Popup>
                    </Marker>

                    {d.currentOrder?.pickupLatitude != null && (
                      <Marker position={[d.currentOrder.pickupLatitude, d.currentOrder.pickupLongitude]} icon={ICONS.pickup}>
                        <Popup>
                          <div style={{ minWidth: 160 }}>
                            <strong>Pickup</strong><br />
                            <span style={{ fontSize: 12, color: '#666' }}>{d.currentOrder.pickupAddress}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {d.currentOrder?.deliveryLatitude != null && (
                      <Marker position={[d.currentOrder.deliveryLatitude, d.currentOrder.deliveryLongitude]} icon={ICONS.delivery}>
                        <Popup>
                          <div style={{ minWidth: 160 }}>
                            <strong>Livraison</strong><br />
                            <span style={{ fontSize: 12, color: '#666' }}>{d.currentOrder.deliveryAddress}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {d.currentOrder?.pickupLatitude != null && d.currentOrder?.deliveryLatitude != null && (
                      <Polyline
                        positions={[
                          [d.currentOrder.pickupLatitude, d.currentOrder.pickupLongitude],
                          [d.currentOrder.deliveryLatitude, d.currentOrder.deliveryLongitude],
                        ]}
                        color="#38bdf8" weight={2} dashArray="6 4" opacity={0.6}
                      />
                    )}
                  </span>
                )
              })}
            </MapContainer>
          )}
        </div>

        <div style={{ ...glass, padding: '16px 20px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Mes livreurs actifs</h2>
          {drivers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun livreur actif pour le moment.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {drivers.map(d => {
                const state = driverState(d)
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 180px', minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATE_COLOR[state], flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name?.trim() || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.phone} · {d.vehicleType ?? '—'}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: STATE_COLOR[state] }}>{STATE_LABEL[state]}</div>
                      {d.currentOrder ? (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {['PICKED_UP', 'IN_TRANSIT'].includes(d.currentOrder.status) ? 'Vers livraison' : 'Vers pickup'}
                        </div>
                      ) : d.latitude == null && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Position inconnue</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
