import { useState, useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import api from '../lib/api'
import { glassInput, glassSolid } from '../lib/glassStyles'

// Adresse à Dakar avec suggestions (proxy serveur /public/places, comme la
// boutique publique) ; `value` : { address, lat, lng } une fois choisie.
export default function AddressField({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState(value?.address ?? '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const session = useRef(Math.random().toString(36).slice(2))

  useEffect(() => {
    const q = input.trim()
    if (q.length < 3 || q === value?.address) return
    const t = setTimeout(() => {
      api.get('/public/places/autocomplete', { params: { input: q, sessionToken: session.current } })
        .then(r => { setSuggestions(r.data?.predictions ?? []); setOpen(true) })
        .catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(t)
  }, [input, value?.address])

  async function pick(p) {
    setOpen(false); setError('')
    try {
      const { data } = await api.get('/public/places/details', { params: { placeId: p.place_id, sessionToken: session.current } })
      if (data.lat == null) throw new Error()
      const address = p.description ?? data.address
      setInput(address)
      onChange({ address, lat: data.lat, lng: data.lng })
      session.current = Math.random().toString(36).slice(2)
    } catch {
      setError('Adresse introuvable : choisissez une autre suggestion.')
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <input
        value={input}
        onChange={e => { setInput(e.target.value); if (value) onChange(null) }}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        style={{ ...glassInput, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', borderColor: value ? 'rgba(22,163,74,.5)' : undefined }}
      />
      {value && <div style={{ fontSize: 11, color: '#15803d', marginTop: 3 }}>✓ Position trouvée</div>}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{error}</div>}
      {open && suggestions.length > 0 && (
        <div style={{ ...glassSolid, position: 'absolute', zIndex: 10, left: 0, right: 0, marginTop: 4, padding: 4, maxHeight: 220, overflowY: 'auto' }}>
          {suggestions.map(p => (
            <button key={p.place_id} type="button" onMouseDown={() => pick(p)} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '8px 10px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, borderRadius: 6,
            }}>
              <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }} /> {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
