import { useEffect, useId, useRef, useState } from 'react'
import { MapPin, Search, X, AlertCircle } from 'lucide-react'
import proApi from '../lib/proApi'
import { Spinner } from './ui'

// Recherche d'adresse à Dakar (Google via le serveur DEM : /public/places/*,
// comme l'app et Nouvelle livraison). Flèches haut/bas + Entrée pour choisir.
// value : { address, lat, lng } | null — onPick reçoit le même format.
const newToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export default function AddressSearch({ value, onPick, onClear, error, label = 'Adresse de livraison' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const [failed, setFailed] = useState(false)
  const token = useRef(newToken())
  const inputId = useId()
  const listId = useId()

  useEffect(() => {
    const input = q.trim()
    if (input.length < 3) return
    let alive = true
    const t = setTimeout(() => {
      setLoading(true)
      proApi.get('/public/places/autocomplete', { params: { input, sessionToken: token.current } })
        .then(r => { if (alive) { setResults(r.data?.predictions ?? []); setHi(-1) } })
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false))
    }, 280)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  const pick = async (p) => {
    setOpen(false)
    setFailed(false)
    try {
      const r = await proApi.get('/public/places/details', { params: { placeId: p.place_id, sessionToken: token.current } })
      token.current = newToken()
      if (r.data?.lat != null) { onPick({ address: r.data.address ?? p.description, lat: r.data.lat, lng: r.data.lng }); setQ(''); setResults([]) }
      else setFailed(true)
    } catch { setFailed(true) }
  }

  const shown = q.trim().length >= 3 ? results.slice(0, 6) : []
  const onKey = (e) => {
    if (!open || !shown.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => (i + 1) % shown.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => (i <= 0 ? shown.length - 1 : i - 1)) }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(shown[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="nd-place">
      {value && (
        <div className="nd-picked">
          <MapPin size={16} aria-hidden />
          <span>{value.address}</span>
          {onClear && <button type="button" className="nd-x" aria-label="Changer d'adresse" onClick={onClear}><X size={14} aria-hidden /></button>}
        </div>
      )}
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <div className="nd-search">
        <Search size={16} aria-hidden />
        <input id={inputId} className="input" value={q} autoComplete="off"
          role="combobox" aria-expanded={open && shown.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={hi >= 0 ? `${listId}-${hi}` : undefined} aria-invalid={error ? true : undefined}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey}
          onChange={e => { setQ(e.target.value); setOpen(true); setFailed(false) }}
          placeholder={value ? 'Changer d\'adresse…' : 'Quartier, rue, lieu connu…'} />
        {loading && <span className="nd-spin"><Spinner size={16} /></span>}
      </div>
      {error && <span className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> {error}</span>}
      {failed && <span className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> Adresse introuvable. Essayez un autre lieu, ou cliquez sur la carte.</span>}
      {open && shown.length > 0 && (
        <div className="nd-results" role="listbox" id={listId}>
          {shown.map((p, i) => (
            <button key={p.place_id} id={`${listId}-${i}`} type="button" role="option" aria-selected={i === hi}
              style={i === hi ? { background: 'var(--p-soft)' } : undefined}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(p)}>
              <MapPin size={15} aria-hidden />
              <span><b>{p.structured_formatting?.main_text ?? p.description}</b><small>{p.structured_formatting?.secondary_text ?? ''}</small></span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 3 && !loading && shown.length === 0 && (
        <p className="muted nd-help">Aucun résultat : cliquez sur la carte pour placer ce point.</p>
      )}
    </div>
  )
}
