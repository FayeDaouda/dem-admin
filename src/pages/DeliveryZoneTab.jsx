import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Circle, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Save, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import MapBaseLayer from '../components/MapBaseLayer'

// Zone de livraison couverte par DEM (dem-backend : utils/delivery-zone.js).
// Boutique publique DEM Pro : une adresse hors du cercle est refusée, et le
// client le voit dès qu'il place son point. Aucune zone = aucune limite.

const pin = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#0077b6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
})

function ClickToMove({ onMove }) {
  useMapEvents({ click: e => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}

function FitCircle({ center, radiusKm }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000), { padding: [20, 20] })
  }, [map, center.lat, center.lng, radiusKm])
  return null
}

const round = n => Math.round(n * 1e5) / 1e5

export default function DeliveryZoneTab() {
  const [saved, setSaved] = useState(undefined) // undefined = chargement, null = aucune zone
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.get('/admin/delivery-zone')
      .then(({ data }) => {
        setSaved(data.zone)
        const z = data.zone ?? data.suggested
        setForm({ lat: z.center.lat, lng: z.center.lng, radiusKm: z.radiusKm })
      })
      .catch(e => setError(e.response?.data?.message || 'Chargement impossible.'))
  }, [])

  const center = useMemo(() => form && { lat: Number(form.lat), lng: Number(form.lng) }, [form])
  const valid = form && [center.lat, center.lng].every(Number.isFinite) && Number(form.radiusKm) >= 1 && Number(form.radiusKm) <= 200
  const dirty = form && (!saved || saved.center.lat !== center.lat || saved.center.lng !== center.lng || saved.radiusKm !== Number(form.radiusKm))

  async function save(zone) {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data } = await api.put('/admin/delivery-zone', { zone })
      setSaved(data.zone)
      setNotice(data.zone ? 'Zone enregistrée : appliquée aux nouvelles commandes de la boutique.' : 'Limite retirée : toutes les adresses sont acceptées.')
    } catch (e) {
      setError(e.response?.data?.message || 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (saved === undefined || !form) {
    return <div style={{ ...glass, padding: 20, color: 'var(--text-muted)' }}>{error || 'Chargement…'}</div>
  }

  const field = (key, label, step) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flex: '1 1 140px' }}>
      {label}
      <input type="number" step={step} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={glassInput} />
    </label>
  )

  return (
    <div style={{ ...glass, padding: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Zone de livraison</h2>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Boutique publique DEM Pro : une adresse hors de ce cercle est refusée, et le client en est averti dès qu'il place son point.
        Cliquez sur la carte ou faites glisser le point bleu pour déplacer le centre.{' '}
        <strong>{saved ? `Zone active : ${saved.radiusKm} km.` : 'Aucune zone active : toutes les adresses sont acceptées.'}</strong>
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {field('lat', 'Latitude du centre', '0.0001')}
        {field('lng', 'Longitude du centre', '0.0001')}
        {field('radiusKm', 'Rayon (km, 1 à 200)', '1')}
      </div>

      <div style={{ height: 380, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        {valid && (
          <MapContainer center={[center.lat, center.lng]} zoom={10} style={{ height: '100%', width: '100%' }}>
            <MapBaseLayer />
            <FitCircle center={center} radiusKm={Number(form.radiusKm)} />
            <ClickToMove onMove={(lat, lng) => setForm(f => ({ ...f, lat: round(lat), lng: round(lng) }))} />
            <Circle center={[center.lat, center.lng]} radius={Number(form.radiusKm) * 1000} pathOptions={{ color: '#0077b6', weight: 2, fillOpacity: 0.12 }} />
            <Marker
              position={[center.lat, center.lng]} icon={pin} draggable
              eventHandlers={{ dragend: e => { const p = e.target.getLatLng(); setForm(f => ({ ...f, lat: round(p.lat), lng: round(p.lng) })) } }}
            />
          </MapContainer>
        )}
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}
      {notice && <div style={{ fontSize: 12, color: '#15803d', background: 'rgba(34,197,94,.10)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>{notice}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button" disabled={!valid || !dirty || busy}
          onClick={() => save({ type: 'circle', center, radiusKm: Number(form.radiusKm) })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: valid && dirty ? 'var(--primary)' : 'var(--surface2)', color: valid && dirty ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: valid && dirty ? 'pointer' : 'default' }}
        ><Save size={15} /> Enregistrer la zone</button>
        {saved && (
          <button
            type="button" disabled={busy}
            onClick={() => { if (window.confirm('Retirer la limite ? Toutes les adresses seront acceptées.')) save(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,.35)', background: 'rgba(255,255,255,.5)', color: 'var(--danger)', fontSize: 13, cursor: 'pointer' }}
          ><Trash2 size={15} /> Retirer la limite</button>
        )}
      </div>
    </div>
  )
}
