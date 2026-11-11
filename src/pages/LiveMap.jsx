import { useState, useEffect, useCallback, Component } from 'react'
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import MapBaseLayer from '../components/MapBaseLayer'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { connectSocket } from '../lib/socket'
import api from '../lib/api'
import Badge from '../components/Badge'
import { RefreshCw } from 'lucide-react'
import { pageWrap, pageScroll } from '../lib/glassStyles'
import { useResponsive } from '../lib/useResponsive'
import InfoTip from '../components/InfoTip'
import { PAGES } from '../lib/aide'
import { useAuth } from '../contexts/AuthContext'
import { canSee, isSuperRole, ACTION_ROLES } from '../lib/droits'
import DispatchPicker from '../components/DispatchPicker'
import { clientCharge } from '../lib/orderPrice'

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
const WAITING_ICON = makeIcon('#dc2626', '⏳') // course en attente d'un coursier
const DELIVERY_ICON = makeIcon('#22c55e', '🏁')

// Coordonnées utilisables par Leaflet : une latitude sans longitude (ou hors
// limites) fait planter toute la page (« Invalid LatLng »).
const isLat = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 90
const isLng = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 180
const hasPos = (lat, lng) => isLat(lat) && isLng(lng)

// Si la carte plante malgré tout, on garde la page et on propose de réessayer.
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('Carte live :', error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
        La carte n'a pas pu s'afficher.
        <button onClick={() => this.setState({ error: null })} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    )
  }
}

// Centre auto sur les marqueurs. Zoom toujours plafonné : avec un seul point
// (ou des points confondus), fitBounds sans plafond vise un zoom infini tant
// que le fond Google n'est pas chargé, et Leaflet plante.
const FIT_MAX_ZOOM = 15
function AutoFit({ points }) {
  const map = useMap()
  // Recentre seulement si les points changent, pas à chaque rendu
  // (sinon la carte revient en place pendant qu'on la déplace).
  const key = points.map(p => p.join(',')).join(';')
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points)
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getCenter(), FIT_MAX_ZOOM)
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: FIT_MAX_ZOOM })
    }
  }, [key, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LiveMap() {
  const { isMobile } = useResponsive()
  const { user } = useAuth()
  // Proposer / attribuer / réattribuer depuis la carte (Super + Resp. flottes)
  const canDispatch = canSee(user?.adminRole, ACTION_ROLES.orderDispatch)
  const dispatchAll = canSee(user?.adminRole, ACTION_ROLES.orderDispatchAll) // sinon (Commercial) : courses DEM Pro
  const [dispatchOrder, setDispatchOrder] = useState(null)
  const [notice, setNotice] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showDrivers, setShowDrivers]   = useState(true)
  const [showOrders, setShowOrders]     = useState(true)
  const [showRoutes, setShowRoutes]     = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/admin/live')
      setSnapshot(res.data)
      setLoadError(false)
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const s = connectSocket()
    const refresh = () => fetch()

    const events = ['admin:order:new', 'admin:order:accepted', 'admin:order:pickedup',
      'admin:order:delivered', 'admin:order:cancelled']
    events.forEach(ev => s.on(ev, refresh))

    // Seulement nos écouteurs : la connexion partagée reste ouverte (bandeaux d'alerte).
    return () => events.forEach(ev => s.off(ev, refresh))
  }, [fetch])

  const drivers = snapshot?.availableDrivers ?? []
  const orders  = snapshot?.activeOrders ?? []

  // Tous les points pour le autofit
  const allPoints = [
    ...drivers.filter(d => hasPos(d.latitude, d.longitude)).map(d => [d.latitude, d.longitude]),
    ...orders.filter(o => hasPos(o.pickupLatitude, o.pickupLongitude)).map(o => [o.pickupLatitude, o.pickupLongitude]),
  ]

  // Centre de secours : Dakar
  const defaultCenter = [14.6937, -17.4441]

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center' }}>Carte en temps réel<InfoTip title="Carte en temps réel" text={PAGES['/map']} size={16} /></h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {drivers.length} driver{drivers.length !== 1 ? 's' : ''} en ligne · {orders.length} course{orders.length !== 1 ? 's' : ''} active{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['Coursiers', showDrivers, setShowDrivers, '#6366f1'],
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

      <div style={pageScroll}>
      {loadError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c', background: 'rgba(220,38,38,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
          Impossible de charger les positions. Cliquez sur Actualiser pour réessayer.
        </div>
      )}
      {notice && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>{notice}</div>
      )}
      {/* Map */}
      <div style={{ height: isMobile ? 320 : 480, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--text-muted)' }}>
            Chargement de la carte…
          </div>
        ) : (
          <MapErrorBoundary>
          <MapContainer
            center={defaultCenter}
            zoom={12}
            maxZoom={20}
            style={{ height: '100%', width: '100%' }}
          >
            <MapBaseLayer />

            {allPoints.length > 0 && <AutoFit points={allPoints} />}

            {/* Drivers en ligne */}
            {showDrivers && drivers.map(d => (
              hasPos(d.latitude, d.longitude) && (
                <Marker key={d.id} position={[d.latitude, d.longitude]} icon={DRIVER_ICON}>
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>{d.name ?? 'Coursier'}</strong><br />
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
                {hasPos(o.pickupLatitude, o.pickupLongitude) && (
                  <Marker position={[o.pickupLatitude, o.pickupLongitude]} icon={o.status === 'PENDING' ? WAITING_ICON : PICKUP_ICON}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>Pickup</strong> — <Badge status={o.status} /><br />
                        <span style={{ fontSize: 12, color: '#666' }}>{o.pickupAddress}</span><br />
                        <span style={{ fontSize: 12 }}>Client : {o.client?.name ?? '—'}</span><br />
                        {o.driver && <><span style={{ fontSize: 12 }}>Coursier : {o.driver.name ?? '—'}</span><br /></>}
                        {o.status === 'PENDING' && <><span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>En attente depuis {Math.max(0, Math.round((Date.now() - new Date(o.createdAt)) / 60000))} min</span><br /></>}
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{clientCharge(o).toLocaleString('fr-FR')} F</span>
                        {/* Colis récupéré : seul le Super Admin réattribue */}
                        {canDispatch && (dispatchAll || o.client?.role === 'DEM_PRO') && (o.status === 'PENDING' || (o.driver && (o.status === 'ACCEPTED' || isSuperRole(user?.adminRole)))) && (
                          <button onClick={() => setDispatchOrder(o)} style={{ display: 'block', marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff', background: o.driver ? '#7c3aed' : '#0077b6' }}>
                            {o.driver ? 'Réattribuer' : 'Proposer / attribuer'}
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* Point livraison */}
                {hasPos(o.deliveryLatitude, o.deliveryLongitude) && (
                  <Marker position={[o.deliveryLatitude, o.deliveryLongitude]} icon={DELIVERY_ICON}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>Livraison</strong><br />
                        <span style={{ fontSize: 12, color: '#666' }}>{o.deliveryAddress}</span><br />
                        {o.driver && <span style={{ fontSize: 12 }}>Coursier : {o.driver.name}</span>}
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* Ligne pickup → livraison */}
                {showRoutes && hasPos(o.pickupLatitude, o.pickupLongitude) && hasPos(o.deliveryLatitude, o.deliveryLongitude) && (
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
          </MapErrorBoundary>
        )}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
        <span>🏍 Driver disponible</span>
        <span>📦 Point de pickup</span>
        <span style={{ color: '#dc2626' }}>⏳ Course en attente d'un coursier</span>
        <span>🏁 Point de livraison</span>
        <span style={{ color: '#38bdf8' }}>— — Trajet estimé</span>
      </div>
      </div>

      {dispatchOrder && (
        <DispatchPicker
          order={dispatchOrder}
          onClose={() => setDispatchOrder(null)}
          onDone={({ text }) => { setDispatchOrder(null); setNotice(text); fetch() }}
        />
      )}
    </div>
  )
}
