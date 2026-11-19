import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Plus, Search, SearchX, Star, Pencil, Trash2, X, Library } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput, glassSolid, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import InlineConfirm from '../components/InlineConfirm'
import MapBaseLayer from '../components/MapBaseLayer'
import { useUrlTab } from '../lib/useUrlTab'

// Lieux (Opérations) — recherche d'adresse de l'app, depuis la 1.2.3 :
// le client trouve d'abord ces lieux connus (dès 2 lettres, fautes et
// surnoms compris), puis Google. Serveur : /admin/places, /admin/place-misses
// (Super + Service client + Ass. exécutive). Chaque changement est visible
// tout de suite dans l'app.

const CATEGORY_LABELS = {
  QUARTIER: 'Quartier',
  REPERE: 'Repère (rond-point, pont…)',
  TRANSPORT: 'Transport',
  MARCHE: 'Marché',
  SANTE: 'Santé',
  EDUCATION: 'École / université',
  SPORT: 'Sport',
  CULTURE: 'Culture / monument',
  LOISIRS: 'Loisirs / plage',
  RELIGION: 'Lieu de culte',
  COMMERCE: 'Commerce',
  HOTEL: 'Hôtel',
  ADMINISTRATION: 'Administration',
  AUTRE: 'Autre',
}

const TABS = [
  { key: 'catalogue', label: 'Catalogue', icon: Library },
  { key: 'introuvables', label: 'Adresses introuvables', icon: SearchX },
]

const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const fmtDate = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Lieux() {
  const [tab, setTab] = useUrlTab(TABS)
  const [editing, setEditing] = useState(null) // { place?, prefill?, fromMissId? }
  const [version, setVersion] = useState(0)    // recharge les deux onglets après une écriture
  const [openMisses, setOpenMisses] = useState(null)

  const tabs = TABS.map(t => t.key === 'introuvables' && openMisses
    ? { ...t, label: <>Adresses introuvables <span style={countPill}>{openMisses}</span></>, infoTitle: 'Adresses introuvables' }
    : t)

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Lieux"
        subtitle="Lieux connus que les clients trouvent en premier dans la recherche d'adresse, et ce qu'ils n'ont pas trouvé"
        actions={<button onClick={() => setEditing({})} style={btnPrimary}><Plus size={15} /> Ajouter un lieu</button>}
      />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {tab === 'catalogue'
          ? <Catalogue version={version} onEdit={place => setEditing({ place })} onChanged={() => setVersion(v => v + 1)} />
          : <Misses version={version} onOpenCount={setOpenMisses} onAdd={miss => setEditing({ prefill: { name: miss.query }, fromMissId: miss.id })} onChanged={() => setVersion(v => v + 1)} />}
        <MissCount version={version} onCount={setOpenMisses} />
      </div>
      {editing && (
        <PlaceModal {...editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setVersion(v => v + 1) }} />
      )}
    </div>
  )
}

// Compteur de l'onglet « Adresses introuvables », quel que soit l'onglet ouvert.
function MissCount({ version, onCount }) {
  useEffect(() => {
    api.get('/admin/place-misses', { params: { status: 'OPEN' } }).then(r => onCount(r.data.open)).catch(() => {})
  }, [version, onCount])
  return null
}

// ── Catalogue ────────────────────────────────────────────────────────────────
function Catalogue({ version, onEdit, onChanged }) {
  const [places, setPlaces] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/admin/places').then(r => setPlaces(r.data.places)).catch(e => setError(e.response?.data?.message ?? 'Liste indisponible.'))
  }, [version])

  const shown = useMemo(() => {
    if (!places) return []
    const f = fold(q.trim())
    return places.filter(p => (!category || p.category === category)
      && (!f || fold(p.name).includes(f) || p.aliases.some(a => fold(a).includes(f)) || fold(p.area).includes(f)))
  }, [places, q, category])

  async function patch(place, data) {
    setPlaces(list => list.map(p => (p.id === place.id ? { ...p, ...data } : p)))
    try { await api.patch(`/admin/places/${place.id}`, data) } catch (e) {
      setError(e.response?.data?.message ?? 'Modification refusée.')
      onChanged()
    }
  }

  async function remove(place) {
    setBusy(true)
    try { await api.delete(`/admin/places/${place.id}`); setConfirmDelete(null); onChanged() } catch (e) {
      setError(e.response?.data?.message ?? 'Suppression refusée.')
    } finally { setBusy(false) }
  }

  if (error && !places) return <div style={errorBox}>{error}</div>
  if (!places) return <div style={muted}>Chargement…</div>

  const popularCount = places.filter(p => p.popular && p.active).length

  return (
    <div style={{ ...glass, padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, surnom ou quartier" style={{ ...glassInput, paddingLeft: 30 }} />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...glassInput, width: 'auto' }}>
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          {shown.length} lieu{shown.length > 1 ? 'x' : ''} · {popularCount} proposé{popularCount > 1 ? 's' : ''} avant toute frappe (★)
        </span>
      </div>
      {error && <div style={errorBox}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={th}>Lieu</th>
            <th style={th}>Catégorie</th>
            <th style={th} title="Proposé avant toute frappe, en puce « Lieux connus »">★</th>
            <th style={{ ...th, textAlign: 'right' }} title="Fois où un client l'a choisi">Choisi</th>
            <th style={th}>Visible</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {shown.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,119,182,.08)', opacity: p.active ? 1 : 0.5 }}>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {p.area || 'Dakar'}{p.aliases.length > 0 && <> · aussi : {p.aliases.slice(0, 4).join(', ')}{p.aliases.length > 4 ? '…' : ''}</>}
                </div>
                {confirmDelete === p.id && (
                  <InlineConfirm danger busy={busy} confirmLabel="Supprimer"
                    lines={[`Supprimer « ${p.name} » du catalogue ?`, "Les clients le trouveront encore par Google, s'il y figure. Pour le cacher un temps, décochez plutôt « Visible »."]}
                    onConfirm={() => remove(p)} onCancel={() => setConfirmDelete(null)} />
                )}
              </td>
              <td style={td}>{CATEGORY_LABELS[p.category] ?? p.category}</td>
              <td style={td}>
                <button onClick={() => patch(p, { popular: !p.popular })} title={p.popular ? 'Retirer des lieux proposés' : 'Proposer avant toute frappe'} style={iconBtn}>
                  <Star size={16} color={p.popular ? '#f59e0b' : '#94a3b8'} fill={p.popular ? '#f59e0b' : 'none'} />
                </button>
              </td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.pickCount}</td>
              <td style={td}>
                <input type="checkbox" checked={p.active} onChange={() => patch(p, { active: !p.active })} aria-label={`Visible dans l'app : ${p.name}`} />
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button onClick={() => onEdit(p)} title="Modifier" style={iconBtn}><Pencil size={15} /></button>
                <button onClick={() => setConfirmDelete(p.id)} title="Supprimer" style={iconBtn}><Trash2 size={15} color="var(--danger)" /></button>
              </td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={6} style={{ ...td, ...muted }}>Aucun lieu ne correspond.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ── Adresses introuvables ────────────────────────────────────────────────────
function Misses({ version, onAdd, onChanged, onOpenCount }) {
  const [status, setStatus] = useState('OPEN')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/admin/place-misses', { params: { status } })
      .then(r => { setData(r.data); onOpenCount(r.data.open) })
      .catch(e => setError(e.response?.data?.message ?? 'Liste indisponible.'))
  }, [status, onOpenCount])
  useEffect(() => { load() }, [load, version])

  async function setMissStatus(miss, next) {
    try { await api.patch(`/admin/place-misses/${miss.id}`, { status: next }); onChanged() } catch (e) {
      setError(e.response?.data?.message ?? 'Modification refusée.')
    }
  }

  return (
    <div style={{ ...glass, padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...glassInput, width: 'auto' }}>
          <option value="OPEN">À traiter</option>
          <option value="ADDED">Ajoutées au catalogue</option>
          <option value="IGNORED">Ignorées</option>
        </select>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Ce que les clients ont tapé avant de quitter la recherche sans rien choisir (carte, position ou abandon). Les plus fréquentes d'abord.
        </span>
      </div>
      {error && <div style={errorBox}>{error}</div>}
      {!data ? <div style={muted}>Chargement…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Recherche tapée</th>
              <th style={{ ...th, textAlign: 'right' }}>Fois</th>
              <th style={th}>Dernière fois</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {data.misses.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid rgba(0,119,182,.08)' }}>
                <td style={{ ...td, fontWeight: 600 }}>« {m.query} »</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.count}</td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtDate(m.lastAt)}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {m.status === 'OPEN' && <>
                    <button onClick={() => onAdd(m)} style={btnSmall('#0077b6')}><Plus size={13} /> Ajouter au catalogue</button>{' '}
                    <button onClick={() => setMissStatus(m, 'IGNORED')} style={btnSmall('#64748b')}>Ignorer</button>
                  </>}
                  {m.status === 'IGNORED' && <button onClick={() => setMissStatus(m, 'OPEN')} style={btnSmall('#64748b')}>Remettre à traiter</button>}
                  {m.status === 'ADDED' && <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Ajoutée</span>}
                </td>
              </tr>
            ))}
            {data.misses.length === 0 && (
              <tr><td colSpan={4} style={{ ...td, ...muted }}>
                {status === 'OPEN' ? 'Rien à traiter : les clients trouvent ce qu’ils cherchent.' : 'Aucune recherche.'}
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Ajouter / modifier un lieu ───────────────────────────────────────────────
const DAKAR = { lat: 14.6937, lng: -17.4441 }
const pin = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#0077b6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
})
const round = n => Math.round(n * 1e6) / 1e6

function ClickToMove({ onMove }) {
  useMapEvents({ click: e => onMove(e.latlng.lat, e.latlng.lng) })
  return null
}
function Recenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], Math.max(map.getZoom(), 15)) }, [map, lat, lng])
  return null
}

function PlaceModal({ place, prefill, fromMissId, onClose, onSaved }) {
  const init = place ?? prefill ?? {}
  const [form, setForm] = useState({
    name: init.name ?? '',
    category: init.category ?? 'REPERE',
    area: init.area ?? '',
    aliases: (init.aliases ?? []).join(', '),
    popular: !!init.popular,
    lat: init.lat ?? '',
    lng: init.lng ?? '',
  })
  const [candidates, setCandidates] = useState(null)
  const [looking, setLooking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const lat = Number(form.lat), lng = Number(form.lng)
  const hasPos = form.lat !== '' && form.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng)
  const valid = form.name.trim() && hasPos

  async function lookup() {
    setLooking(true); setError('')
    try {
      const { data } = await api.get('/admin/places/lookup', { params: { q: `${form.name} ${form.area}`.trim() } })
      setCandidates(data.candidates)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Recherche Google indisponible.')
    } finally { setLooking(false) }
  }

  function applyCandidate(c) {
    setForm(f => ({ ...f, lat: round(c.lat), lng: round(c.lng), area: f.area || c.address }))
    setCandidates(null)
  }

  async function save() {
    setSaving(true); setError('')
    const body = {
      name: form.name.trim(),
      category: form.category,
      area: form.area.trim(),
      aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
      popular: form.popular,
      lat, lng,
    }
    try {
      if (place) await api.patch(`/admin/places/${place.id}`, body)
      else await api.post('/admin/places', { ...body, fromMissId })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Enregistrement refusé.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glassSolid, width: 640, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto', padding: '22px 24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{place ? 'Modifier le lieu' : 'Ajouter un lieu'}</h2>
          <button onClick={onClose} style={iconBtn} aria-label="Fermer"><X size={18} /></button>
        </div>
        {fromMissId && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            Ce que le client a tapé (« {prefill?.name} ») sera ajouté aux surnoms : il retrouvera ce lieu en le retapant. Corrigez le nom si besoin.
          </div>
        )}

        <div style={grid2}>
          <label style={lbl}>Nom affiché
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Marché Sandaga" style={glassInput} />
          </label>
          <label style={lbl}>Catégorie
            <select value={form.category} onChange={e => set('category', e.target.value)} style={glassInput}>
              {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label style={lbl}>Quartier ou précision (2ᵉ ligne)
            <input value={form.area} onChange={e => set('area', e.target.value)} placeholder="Dakar-Plateau, Dakar" style={glassInput} />
          </label>
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <input type="checkbox" checked={form.popular} onChange={e => set('popular', e.target.checked)} />
            Proposé avant toute frappe (★)
          </label>
        </div>
        <label style={{ ...lbl, marginTop: 10 }}>Surnoms et fautes courantes, séparés par des virgules
          <input value={form.aliases} onChange={e => set('aliases', e.target.value)} placeholder="sandaga, sandanga, marche sandaga" style={glassInput} />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 400 }}>Accents, majuscules et petites fautes sont déjà tolérés : notez surtout les autres noms du lieu.</span>
        </label>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ ...lbl, flex: '1 1 120px' }}>Latitude
            <input value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="14.6723" style={glassInput} inputMode="decimal" />
          </label>
          <label style={{ ...lbl, flex: '1 1 120px' }}>Longitude
            <input value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="-17.4410" style={glassInput} inputMode="decimal" />
          </label>
          <button type="button" onClick={lookup} disabled={!form.name.trim() || looking} style={btnSmall('#0077b6')}>
            <MapPin size={13} /> {looking ? 'Recherche…' : 'Trouver sur Google'}
          </button>
        </div>
        {candidates && (
          <div style={{ marginTop: 8, border: '1px solid rgba(0,119,182,.15)', borderRadius: 8 }}>
            {candidates.length === 0 && <div style={{ ...muted, padding: 10 }}>Google ne trouve rien : placez le point sur la carte.</div>}
            {candidates.map((c, i) => (
              <button key={i} type="button" onClick={() => applyCandidate(c)} style={candidateRow}>
                <strong>{c.name}</strong> <span style={{ color: 'var(--text-muted)' }}>{c.address}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 260, borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
          <MapContainer center={hasPos ? [lat, lng] : [DAKAR.lat, DAKAR.lng]} zoom={hasPos ? 15 : 12} style={{ height: '100%', width: '100%' }}>
            <MapBaseLayer />
            <ClickToMove onMove={(a, b) => setForm(f => ({ ...f, lat: round(a), lng: round(b) }))} />
            {hasPos && <>
              <Recenter lat={lat} lng={lng} />
              <Marker position={[lat, lng]} icon={pin} draggable
                eventHandlers={{ dragend: e => { const p = e.target.getLatLng(); setForm(f => ({ ...f, lat: round(p.lat), lng: round(p.lng) })) } }} />
            </>}
          </MapContainer>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>Cliquez sur la carte ou faites glisser le point pour le placer exactement à l’entrée du lieu.</div>

        {error && <div style={{ ...errorBox, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={!valid || saving} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: valid ? 1 : 0.5 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

const th = { ...stickyTh, textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const td = { padding: '9px 10px', verticalAlign: 'middle' }
const muted = { color: 'var(--text-muted)', fontSize: 13 }
const errorBox = { fontSize: 12.5, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-flex', color: 'var(--text-muted)' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnOutline = { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnSmall = color => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}55`, background: color + '12', color })
const countPill = { marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 999, padding: '0 7px', fontSize: 11, fontWeight: 700 }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }
const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }
const candidateRow = { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid rgba(0,119,182,.08)', background: 'none', cursor: 'pointer', fontSize: 12.5 }
