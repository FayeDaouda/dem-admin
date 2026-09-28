import { useEffect, useState } from 'react'
import { TileLayer, useMap } from 'react-leaflet'
import GoogleMutant from 'leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs'
import {
  GOOGLE_MAPS_API_KEY,
  MAP_TILE_URL,
  MAP_TILE_ATTRIBUTION,
  loadGoogleMaps,
  onGoogleAuthFailure,
} from '../lib/mapTiles'

// Fond Google Maps rendu dans Leaflet (logo + attribution Google gérés par GoogleMutant)
function GoogleLayer() {
  const map = useMap()
  useEffect(() => {
    const layer = new GoogleMutant({ type: 'roadmap' })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map])
  return null
}

// Fond de carte : Google Maps si la clé est configurée et acceptée, sinon OSM.
export default function MapBaseLayer() {
  const [source, setSource] = useState(GOOGLE_MAPS_API_KEY ? 'loading' : 'osm')

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return
    let alive = true
    const fallback = () => { if (alive) setSource('osm') }
    const unsubscribe = onGoogleAuthFailure(fallback)
    loadGoogleMaps().then(() => { if (alive) setSource(s => (s === 'loading' ? 'google' : s)) }, fallback)
    return () => { alive = false; unsubscribe() }
  }, [])

  if (source === 'google') return <GoogleLayer />
  if (source === 'osm') return <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
  return null
}
