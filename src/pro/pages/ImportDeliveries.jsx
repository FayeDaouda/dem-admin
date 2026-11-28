import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  FileSpreadsheet, Upload, Download, Check, AlertCircle, Pencil, Ban, Undo2, Square, Play, Printer, MapPin,
  Users, Store, Zap, CalendarClock, ShieldCheck, Wine, FileClock, Trash2, MousePointerClick, RotateCcw, ArrowLeft,
  CircleCheck, CircleAlert, PauseCircle, Bike,
} from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi, { errMsg } from '../lib/proApi'
import { fcfa, phoneFmt, dakarInputToISO, isoToDakarInput, timeAgo, dakarDay, orderTotal, TZ } from '../lib/format'
import { Button, Corners, Empty, ErrorState, IconButton, Modal, PageHeader, Segmented, Skeleton, Spinner } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import AddressSearch from '../ui/AddressSearch'
import { PACKAGE_CATEGORIES, DEFAULT_CATEGORY, PROHIBITED_ITEMS, categoryOf } from '../ui/packageCategories'
import { downloadCsv } from '../ui/csv'
import { PrintLabelsModal } from '../ui/PrintLabelsButton'
import {
  FIELDS, MAX_ROWS, ImportFileError, readSpreadsheet, columnsOf, autoMap, buildRows, downloadTemplate,
  normPhone, phoneValid, parseAmount,
} from '../ui/importFile'
import '../styles/delivery.css'
import '../styles/import.css'

// ============================================================
//  Import de livraisons en masse (lot 3) — /livraisons/import
//
//  1. Fichier Excel (.xlsx) ou CSV, modèle à télécharger.
//  2. Correspondance des colonnes + réglages communs (point de retrait,
//     qui paie, type de colis par défaut, départ).
//  3. Vérification ligne par ligne : téléphone, adresse (meilleure
//     suggestion de /public/places/search, corrigeable, ou clic sur la
//     carte), prix officiel /orders/estimate (avec la catégorie).
//  4. Création UNE À UNE par POST /orders (même corps que Nouvelle
//     livraison), arrêt possible, reprise sans doublon : une ligne créée est
//     marquée (et gardée dans ce navigateur) et n'est jamais renvoyée ; une
//     ligne sans réponse du serveur est mise de côté (« à vérifier ») au
//     lieu d'être renvoyée d'office.
//  Cadence : le quota du serveur (500 requêtes / 15 min par compte) est
//  partagé avec le téléphone, et la recherche d'adresse a sa propre limite
//  (90 / min) : appels espacés, 100 lignes au plus par import.
// ============================================================

const STORE_KEY = 'dem-pro:import-livraisons'
const STORE_MAX_AGE = 3 * 86400e3
const store = {
  read() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
      if (!d || d.v !== 1 || !Array.isArray(d.rows) || !d.rows.length) return null
      if (!d.savedAt || Date.now() - Date.parse(d.savedAt) > STORE_MAX_AGE) { this.clear(); return null }
      return d
    } catch { return null }
  },
  write(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)) } catch { /* stockage indisponible */ } },
  clear() { try { localStorage.removeItem(STORE_KEY) } catch { /* stockage indisponible */ } },
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
// Écart minimal entre deux appels : recherche d'adresse (90 / min), autres
const PACE = { place: 750, api: 320 }

const shortRef = (id) => String(id ?? '').slice(0, 8).toUpperCase()
const fmtPhone = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))
const lower = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Devis encore valable (prix garanti 10 min ; marge avant l'envoi)
const fresh = (q) => {
  if (!q || q.price == null) return false
  const exp = q.quoteExpiresAt ? Date.parse(q.quoteExpiresAt) : (q.fetchedAt ?? 0) + 9 * 60_000
  return exp > Date.now() + 45_000
}
const quoteTotal = (q) => (q ? (q.totalClient ?? (Number(q.price) || 0) + (Number(q.demFee) || 0)) : null)

// Codes d'erreur du serveur à la création (mêmes textes que Nouvelle livraison)
const LOCK_ERRORS = {
  PICKUP_LOCKED: 'Cette commande part obligatoirement d\'un autre point de retrait.',
  PRICE_LOCKED: 'Le prix de cette commande est fixé : seule la livraison standard est possible.',
}

// ── État d'une ligne ─────────────────────────────────────────────────────────
function localIssues(r) {
  const out = []
  if (r.name.trim().length < 2) out.push('Nom du destinataire manquant')
  if (!phoneValid(r.phone)) out.push(r.phoneRaw ? 'Téléphone invalide (mobile sénégalais à 9 chiffres)' : 'Téléphone manquant')
  if (r.amountError) out.push(r.amountError)
  if (!r.place && !r.addressText) out.push('Adresse manquante')
  return out
}
function issuesOf(r) {
  const out = localIssues(r)
  if (!r.place && r.addressText) {
    if (r.geo === 'none') out.push('Adresse introuvable : choisissez-la sur la carte')
    else if (r.geo === 'error') out.push(r.geoError || 'Recherche d\'adresse impossible')
  }
  if (r.place && r.quoteState === 'error') out.push(r.quoteError || 'Prix impossible à calculer')
  return out
}
function stateOf(r) {
  if (r.status === 'created') return 'created'
  if (r.status === 'busy') return 'creating'
  if (r.status === 'unknown') return 'unknown'
  if (r.excluded) return 'excluded'
  if (r.status === 'failed') return 'failed'
  if (localIssues(r).length) return 'fix'
  if ((!r.place && (r.geo === 'idle' || r.geo === 'busy')) || (r.place && (r.quoteState === 'idle' || r.quoteState === 'busy'))) return 'checking'
  return issuesOf(r).length ? 'fix' : 'ok'
}
const STATE_META = {
  ok: { label: 'Prête', cls: 'is-ok' },
  fix: { label: 'À corriger', cls: 'is-warn' },
  checking: { label: 'Vérification', cls: 'is-wait' },
  excluded: { label: 'Exclue', cls: 'is-off' },
  creating: { label: 'Création…', cls: 'is-info' },
  created: { label: 'Créée', cls: 'is-ok' },
  failed: { label: 'Échec', cls: 'is-err' },
  unknown: { label: 'À vérifier', cls: 'is-warn' },
}
const reasonOf = (r, st) => (st === 'failed' || st === 'unknown' ? r.error : st === 'fix' ? issuesOf(r)[0] : null)

const needsGeo = (r) => !r.excluded && r.status === 'idle' && !r.place && !!r.addressText && r.geo === 'idle'
const needsQuote = (r) => !r.excluded && r.status === 'idle' && !!r.place && r.quoteState === 'idle'

// Adresse lisible d'une suggestion (« Pharmacie X, Sicap Liberté »)
const placeLabel = (s) => [s?.name, s?.secondary].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')

// L'adresse tapée apporte une précision que l'adresse trouvée n'a pas
const typedAdds = (r) => !!r.addressText && !!r.place && !lower(r.place.address).includes(lower(r.addressText))

// Corps de POST /orders — mêmes champs que Nouvelle livraison
function orderBody(r, q, pickup, s) {
  const items = r.itemsText || r.amount
    ? [{ name: (r.itemsText || 'Commande').slice(0, 200), quantity: 1, ...(r.amount ? { price: r.amount } : {}) }]
    : []
  const parts = []
  if (items.length) parts.push(items.map(i => `${i.name} ×${i.quantity}`).join(', '))
  if (r.note.trim()) parts.push(r.note.trim())
  if (r.landmark.trim()) parts.push(`Repère : ${r.landmark.trim()}`)
  if (typedAdds(r)) parts.push(`Adresse indiquée : ${r.addressText}`)
  const description = parts.join(' · ').slice(0, 500)
  const address = (r.place.address || '').length >= 3 ? r.place.address : r.addressText
  return {
    orderType: 'DELIVERY',
    priority: 'NORMAL',
    // Catégorie et Fragile à part ; confirmation « aucun objet interdit »
    // donnée une fois pour tout l'import, avant l'envoi
    packageCategory: r.category,
    isFragile: !!r.fragile,
    prohibitedItemsAck: true,
    pickupAddress: pickup.address,
    pickupLatitude: pickup.lat,
    pickupLongitude: pickup.lng,
    deliveryAddress: address,
    deliveryLatitude: r.place.lat,
    deliveryLongitude: r.place.lng,
    receiverName: r.name.trim(),
    receiverPhone: `+221${r.phone}`,
    ...(description ? { description } : {}),
    price: q.price,
    demFee: q.demFee,
    // Prix garanti : devis signé (10 min), recalculé juste avant s'il a expiré
    ...(q.quoteToken ? { quoteToken: q.quoteToken } : {}),
    ...(s.when === 'later' ? { scheduledAt: dakarInputToISO(s.scheduledAt) } : {}),
    paymentMode: s.payment,
    ...(pickup.id ? { proAddressId: pickup.id } : {}),
    ...(items.length ? { items } : {}),
  }
}

// Livraison créée, gardée pour les bons et le rapport
function slimOrder(o, body, s) {
  return {
    id: o.id,
    status: o.status ?? (s.when === 'later' ? 'SCHEDULED' : 'PENDING'),
    createdAt: o.createdAt ?? new Date().toISOString(),
    scheduledAt: o.scheduledAt ?? body.scheduledAt ?? null,
    receiverName: o.receiverName ?? body.receiverName,
    receiverPhone: o.receiverPhone ?? body.receiverPhone,
    deliveryAddress: o.deliveryAddress ?? body.deliveryAddress,
    description: o.description ?? body.description ?? null,
    items: Array.isArray(o.items) ? o.items : (body.items ?? []),
    price: o.price ?? body.price,
    demFee: o.demFee ?? body.demFee,
    discountAmount: o.discountAmount ?? 0,
    paymentMode: o.paymentMode ?? body.paymentMode,
    paymentStatus: o.paymentStatus ?? null,
    proPaymentMode: o.proPaymentMode ?? null,
    packageCategory: o.packageCategory ?? body.packageCategory,
    isFragile: o.isFragile ?? body.isFragile,
    priority: o.priority ?? 'NORMAL',
  }
}

// Heure de départ la plus proche acceptée (15 min), pour le champ date et heure
const minScheduleInput = () => isoToDakarInput(new Date(Date.now() + 15 * 60_000))

const STEPS = [['file', 'Fichier'], ['map', 'Colonnes et réglages'], ['check', 'Vérification'], ['create', 'Création']]

export default function ImportDeliveries() {
  const navigate = useNavigate()
  const notify = useNotify()
  const fileInput = useRef(null)

  const [phase, setPhase] = useState('file')
  const [saved, setSaved] = useState(() => store.read())
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [drag, setDrag] = useState(false)
  const [tplBusy, setTplBusy] = useState(false)
  const [source, setSource] = useState(null) // { fileName, rows }
  const [fileName, setFileName] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [map, setMap] = useState({})
  const [addresses, setAddresses] = useState(null)
  const [addrFailed, setAddrFailed] = useState(false)
  const [settings, setSettings] = useState({ pickupId: null, payment: 'cod', defaultCategory: DEFAULT_CATEGORY, when: 'now', scheduledAt: '' })
  const [rows, setRows] = useState([])
  const [campaign, setCampaign] = useState([])
  const [checking, setChecking] = useState(false)
  const [checkPause, setCheckPause] = useState(null) // { kind: 'quota' | 'network' }
  const [run, setRun] = useState({ running: false, stopping: false, halt: null })
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [ack, setAck] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [mapTried, setMapTried] = useState(false)

  // Références lues par les boucles (vérification, création)
  const rowsRef = useRef([])
  const settingsRef = useRef(settings)
  const addressesRef = useRef(null)
  const phaseRef = useRef(phase)
  const campaignRef = useRef(new Set())
  const alive = useRef(true)
  const checkingRef = useRef(false)
  const checkAgain = useRef(false)
  const creatingRef = useRef(false)
  const stopRef = useRef(false)
  const lastCall = useRef({ place: 0, api: 0 })
  const quoteCache = useRef(new Map())
  const geoCache = useRef(new Map())
  const fileNameRef = useRef('')
  settingsRef.current = settings
  addressesRef.current = addresses
  phaseRef.current = phase
  fileNameRef.current = fileName

  const commit = (next) => { rowsRef.current = next; setRows(next) }
  const patchRow = (uid, patch) => commit(rowsRef.current.map(r => (r.uid === uid ? { ...r, ...patch } : r)))
  const currentPickup = () => (addressesRef.current ?? []).find(a => a.id === settingsRef.current.pickupId) ?? null
  const pace = async (kind) => {
    const wait = lastCall.current[kind] + PACE[kind] - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall.current[kind] = Date.now()
  }

  // Sauvegarde dans ce navigateur (reprise sans doublon après rechargement)
  const persistNow = () => {
    const list = rowsRef.current
    if (!list.length) return
    if (!list.some(r => !r.excluded && r.status !== 'created')) { store.clear(); return }
    store.write({
      v: 1, savedAt: new Date().toISOString(), fileName: fileNameRef.current, settings: settingsRef.current,
      campaign: [...campaignRef.current], rows: list,
    })
  }

  // ── Chargement ─────────────────────────────────────────────────────────────
  const loadAddresses = () => {
    setAddrFailed(false)
    proApi.get('/dem-pro/addresses').then(r => {
      const list = r.data ?? []
      setAddresses(list)
      setSettings(s => (s.pickupId && list.some(a => a.id === s.pickupId)) ? s : { ...s, pickupId: list.find(a => a.isDefault)?.id ?? list[0]?.id ?? null })
    }).catch(() => { setAddresses([]); setAddrFailed(true) })
  }
  useEffect(() => {
    alive.current = true
    loadAddresses()
    return () => { alive.current = false; stopRef.current = true }
  }, [])

  // Sauvegarde différée à chaque changement (vérification, création)
  useEffect(() => {
    if ((phase !== 'check' && phase !== 'create') || !rows.length) return
    const t = setTimeout(persistNow, 500)
    return () => clearTimeout(t)
  }, [rows, settings, phase, campaign])

  // Fermeture de l'onglet pendant la création : prévenir
  useEffect(() => {
    if (!run.running) return
    const onLeave = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [run.running])

  // Vérification lancée à l'arrivée sur l'étape (et à la reprise d'un import)
  useEffect(() => {
    if (phase === 'check' || phase === 'create') runCheck()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pause « trop de recherches » : reprise automatique après 30 s
  useEffect(() => {
    if (checkPause?.kind !== 'quota') return
    const t = setTimeout(() => runCheck(), 30_000)
    return () => clearTimeout(t)
  }, [checkPause]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1. Fichier ─────────────────────────────────────────────────────────────
  const getTemplate = async () => {
    if (tplBusy) return
    setTplBusy(true)
    try { await downloadTemplate(); notify.success('Modèle téléchargé', 'Remplissez la feuille « Livraisons », une ligne par livraison.') }
    catch { notify.error('Modèle indisponible', 'Le fichier n\'a pas pu être créé. Réessayez dans un instant.') }
    finally { setTplBusy(false) }
  }

  const onFile = async (file) => {
    if (!file || reading) return
    setFileError(null)
    setReading(true)
    try {
      const data = await readSpreadsheet(file)
      setSource(data)
      setFileName(data.fileName)
      setHasHeader(true)
      setMap(autoMap(columnsOf(data.rows, true)))
      setMapTried(false)
      setPhase('map')
    } catch (e) {
      setFileError(e instanceof ImportFileError ? e.message : 'Ce fichier n\'a pas pu être lu. Vérifiez qu\'il s\'agit bien d\'un fichier Excel (.xlsx) ou CSV.')
    } finally {
      setReading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const resumeSaved = () => {
    const d = saved
    if (!d) return
    const restored = d.rows.map(r => ({
      ...r,
      geo: r.geo === 'busy' ? 'idle' : r.geo,
      quoteState: r.quoteState === 'busy' ? 'idle' : r.quoteState,
      // Envoi interrompu par le rechargement : peut-être créée, jamais renvoyée d'office
      ...(r.status === 'busy' ? { status: 'unknown', error: 'Envoi interrompu : cette livraison a peut-être été créée. Vérifiez dans Livraisons avant de la renvoyer.' } : {}),
    }))
    commit(restored)
    campaignRef.current = new Set(d.campaign ?? [])
    setCampaign(d.campaign ?? [])
    setSettings(s => ({ ...s, ...(d.settings ?? {}) }))
    setFileName(d.fileName ?? '')
    setSource(null)
    setSaved(null)
    const started = restored.some(r => r.status !== 'idle')
    setPhase(started ? 'create' : 'check')
  }
  const discardSaved = () => { store.clear(); setSaved(null) }

  // ── 2. Colonnes et réglages ────────────────────────────────────────────────
  const columns = useMemo(() => (source ? columnsOf(source.rows, hasHeader) : []), [source, hasHeader])
  const dataRows = useMemo(() => (source ? (hasHeader ? source.rows.slice(1) : source.rows) : []), [source, hasHeader])
  const sampleOf = (col) => {
    for (const r of dataRows.slice(0, 20)) { const v = String(r.cells[col] ?? '').trim(); if (v) return v.length > 28 ? `${v.slice(0, 27)}…` : v }
    return ''
  }
  const setField = (key, value) => setMap(m => {
    const next = { ...m }
    if (value === '') { delete next[key]; return next }
    const col = Number(value)
    // Une colonne ne sert qu'à un champ
    for (const k of Object.keys(next)) if (next[k] === col) delete next[k]
    next[key] = col
    return next
  })
  const toggleHeader = (on) => {
    setHasHeader(on)
    if (on && source) setMap(autoMap(columnsOf(source.rows, true)))
  }
  const pickup = (addresses ?? []).find(a => a.id === settings.pickupId) ?? null
  const scheduleOk = settings.when === 'now' || (settings.scheduledAt && Date.parse(dakarInputToISO(settings.scheduledAt)) > Date.now() + 15 * 60_000)
  const missingMap = FIELDS.filter(f => f.required && map[f.key] == null)
  const mapProblems = [
    ...missingMap.map(f => `la colonne « ${f.label} »`),
    !pickup && 'le point de retrait',
    pickup && (pickup.lat == null || pickup.lng == null) && 'un point de retrait placé sur la carte',
    !scheduleOk && 'une heure de départ au moins 15 minutes plus tard',
    dataRows.length === 0 && 'au moins une ligne de livraison',
  ].filter(Boolean)

  const startCheck = () => {
    setMapTried(true)
    if (mapProblems.length) return
    const built = buildRows(dataRows, map, { defaultCategory: settings.defaultCategory }).map(r => {
      const g = geoCache.current.get(lower(r.addressText))
      return g ? { ...r, ...g } : r
    })
    commit(built)
    campaignRef.current = new Set()
    setCampaign([])
    setFilter('all')
    setCheckPause(null)
    setRun({ running: false, stopping: false, halt: null })
    setPhase('check')
  }

  // ── 3. Vérification (une ligne à la fois) ──────────────────────────────────
  const resolvePlace = async (s) => {
    if (Number.isFinite(s?.lat) && Number.isFinite(s?.lng)) return { address: placeLabel(s), lat: s.lat, lng: s.lng }
    await pace('place')
    const d = await proApi.get('/public/places/details', { params: { placeId: s.id } })
    if (d.data?.lat == null) return null
    return { address: d.data.address || placeLabel(s), lat: d.data.lat, lng: d.data.lng }
  }

  const estimate = async (p, place, category) => {
    const key = `${p.lat},${p.lng}|${place.lat.toFixed(5)},${place.lng.toFixed(5)}|${category}`
    const c = quoteCache.current.get(key)
    if (fresh(c)) return c
    await pace('api')
    const r = await proApi.get('/orders/estimate', {
      params: { pickupLat: p.lat, pickupLng: p.lng, deliveryLat: place.lat, deliveryLng: place.lng, orderType: 'DELIVERY', priority: 'NORMAL', packageCategory: category },
    })
    const q = { ...r.data, fetchedAt: Date.now() }
    quoteCache.current.set(key, q)
    return q
  }

  const transient = (e) => !e?.response || e.response.status === 429

  const geocodeRow = async (r) => {
    patchRow(r.uid, { geo: 'busy', geoError: null })
    try {
      await pace('place')
      const res = await proApi.get('/public/places/search', { params: { q: r.addressText.slice(0, 120) } })
      const suggestions = (res.data?.results ?? []).filter(x => x?.id).slice(0, 5)
        .map(x => ({ id: x.id, name: x.name, secondary: x.secondary, lat: x.lat, lng: x.lng }))
      let patch
      if (!suggestions.length) patch = { geo: 'none', suggestions: [] }
      else {
        const place = await resolvePlace(suggestions[0])
        patch = place ? { geo: 'done', place, suggestions } : { geo: 'none', suggestions }
      }
      geoCache.current.set(lower(r.addressText), patch)
      patchRow(r.uid, { ...patch, quote: null, quoteState: 'idle', quoteError: null })
    } catch (e) {
      if (transient(e)) throw e
      patchRow(r.uid, { geo: 'error', geoError: errMsg(e, 'Recherche d\'adresse impossible.') })
    }
  }

  const quoteRow = async (r, p) => {
    if (p.lat == null || p.lng == null) {
      patchRow(r.uid, { quoteState: 'error', quoteError: 'Le point de retrait n\'a pas de position sur la carte.' })
      return
    }
    patchRow(r.uid, { quoteState: 'busy', quoteError: null })
    try {
      const q = await estimate(p, r.place, r.category)
      patchRow(r.uid, { quote: q, quoteState: 'done' })
    } catch (e) {
      if (transient(e)) throw e
      patchRow(r.uid, { quoteState: 'error', quoteError: errMsg(e, 'Le prix n\'a pas pu être calculé.') })
    }
  }

  async function runCheck() {
    checkAgain.current = true
    if (checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    setCheckPause(null)
    try {
      while (checkAgain.current) {
        checkAgain.current = false
        for (;;) {
          if (!alive.current || creatingRef.current || phaseRef.current === 'map' || phaseRef.current === 'file') return
          const p = currentPickup()
          const r = rowsRef.current.find(x => needsGeo(x) || (p && needsQuote(x)))
          if (!r) break
          if (needsGeo(r)) await geocodeRow(r)
          else await quoteRow(r, p)
        }
      }
    } catch (e) {
      if (alive.current) setCheckPause({ kind: e?.response?.status === 429 ? 'quota' : 'network' })
      commit(rowsRef.current.map(x => ({ ...x, geo: x.geo === 'busy' ? 'idle' : x.geo, quoteState: x.quoteState === 'busy' ? 'idle' : x.quoteState })))
    } finally {
      checkingRef.current = false
      if (alive.current) setChecking(false)
    }
  }

  const toggleExclude = (uid) => {
    const r = rowsRef.current.find(x => x.uid === uid)
    if (!r) return
    patchRow(uid, r.status === 'unknown' ? { excluded: true, status: 'idle', error: null } : { excluded: !r.excluded })
    if (r.excluded) setTimeout(() => runCheck(), 0)
  }

  const saveEdit = (uid, patch) => {
    const r = rowsRef.current.find(x => x.uid === uid)
    if (!r) return
    const placeChanged = !!patch.place && (!r.place || patch.place.lat !== r.place.lat || patch.place.lng !== r.place.lng)
    const next = {
      ...r, ...patch,
      excluded: false,
      ...(r.status === 'failed' ? { status: 'idle', error: null } : {}),
      ...(patch.place ? { geo: 'done', geoError: null } : {}),
    }
    if (placeChanged || patch.category !== r.category || r.quoteState === 'error') Object.assign(next, { quote: null, quoteState: 'idle', quoteError: null })
    commit(rowsRef.current.map(x => (x.uid === uid ? next : x)))
    setEditing(null)
    setTimeout(() => runCheck(), 0)
  }

  // Point de retrait de l'import supprimé entre-temps (reprise) : nouveau choix, prix recalculés
  const changePickup = (id) => {
    if (!id || creatingRef.current) return
    const next = { ...settingsRef.current, pickupId: id }
    settingsRef.current = next
    setSettings(next)
    commit(rowsRef.current.map(r => (r.status === 'created' || !r.place ? r : { ...r, quote: null, quoteState: 'idle', quoteError: null })))
    setTimeout(() => runCheck(), 0)
  }

  // Ligne sans réponse : renvoyer (après vérification dans Livraisons) ou écarter
  const resend = (uid) => { patchRow(uid, { status: 'idle', error: null }); campaignRef.current.add(uid) }

  // ── 4. Création (une à la fois) ────────────────────────────────────────────
  async function runCreate() {
    if (creatingRef.current) return
    creatingRef.current = true
    stopRef.current = false
    setRun({ running: true, stopping: false, halt: null })
    let halt = null
    let serverFails = 0
    let created = 0
    try {
      // Vérification en cours : on attend qu'elle rende la main
      while (checkingRef.current) await sleep(200)
      for (;;) {
        if (stopRef.current || !alive.current) break
        const r = rowsRef.current.find(x => campaignRef.current.has(x.uid) && stateOf(x) === 'ok')
        if (!r) break
        const s = settingsRef.current
        if (s.when === 'later' && !(Date.parse(dakarInputToISO(s.scheduledAt)) > Date.now() + 15 * 60_000)) { halt = { kind: 'schedule' }; break }
        const p = currentPickup()
        if (!p || p.lat == null) { halt = { kind: 'pickup' }; break }
        patchRow(r.uid, { status: 'busy', error: null })
        persistNow()
        let posting = false
        try {
          let q = r.quote
          if (!fresh(q)) {
            q = await estimate(p, r.place, r.category)
            patchRow(r.uid, { quote: q })
          }
          const body = orderBody(r, q, p, s)
          await pace('api')
          posting = true
          const res = await proApi.post('/orders', body)
          const order = res.data?.order ?? res.data ?? {}
          patchRow(r.uid, { status: 'created', orderId: order.id ?? null, order: slimOrder(order, body, s), error: null })
          persistNow()
          created++
          serverFails = 0
        } catch (e) {
          const st = e?.response?.status
          const code = e?.response?.data?.code
          if (st === 402 || code === 'DEM_PRO_PLAN_REQUIRED') { patchRow(r.uid, { status: 'idle' }); halt = { kind: 'plan', message: errMsg(e) }; break }
          if (st === 429) { patchRow(r.uid, { status: 'idle' }); halt = { kind: 'quota' }; break }
          if (!e?.response) {
            patchRow(r.uid, posting
              ? { status: 'unknown', error: 'Pas de réponse du serveur : cette livraison a peut-être été créée. Vérifiez dans Livraisons avant de la renvoyer.' }
              : { status: 'idle' })
            halt = { kind: 'network' }
            break
          }
          if (st === 401 || st === 403) { patchRow(r.uid, { status: 'idle' }); halt = { kind: 'auth', message: errMsg(e) }; break }
          patchRow(r.uid, { status: 'failed', error: LOCK_ERRORS[code] ?? errMsg(e, 'Livraison refusée par le serveur.') })
          if (st >= 500 && ++serverFails >= 3) { halt = { kind: 'server' }; break }
        }
      }
    } finally {
      creatingRef.current = false
      persistNow()
      if (alive.current) {
        setRun({ running: false, stopping: false, halt })
        if (created > 0) window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
      }
    }
  }

  const startCreate = () => {
    if (!ack || creatingRef.current) return
    const ids = rowsRef.current.filter(r => ['ok', 'created'].includes(stateOf(r))).map(r => r.uid)
    campaignRef.current = new Set([...campaignRef.current, ...ids])
    setCampaign([...campaignRef.current])
    setConfirmOpen(false)
    setPhase('create')
    runCreate()
  }
  const stop = () => { stopRef.current = true; setRun(r => ({ ...r, stopping: true })) }
  const retryFailed = () => {
    commit(rowsRef.current.map(r => (campaignRef.current.has(r.uid) && r.status === 'failed' ? { ...r, status: 'idle', error: null } : r)))
    runCreate()
  }

  const reset = () => {
    if (creatingRef.current) return
    store.clear()
    commit([])
    campaignRef.current = new Set()
    setCampaign([])
    setSource(null)
    setFileName('')
    setMap({})
    setAck(false)
    setRun({ running: false, stopping: false, halt: null })
    setCheckPause(null)
    setPhase('file')
  }

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const states = useMemo(() => rows.map(r => stateOf(r)), [rows])
  const count = (...keys) => states.filter(s => keys.includes(s)).length
  const readyRows = rows.filter((_, i) => states[i] === 'ok')
  const readyTotal = readyRows.reduce((s, r) => s + (quoteTotal(r.quote) ?? 0), 0)
  const checkTotal = rows.filter((r, i) => !r.excluded && states[i] !== 'created').length
  const checkDone = rows.filter((r, i) => !r.excluded && states[i] !== 'created' && states[i] !== 'checking').length
  const anyCreated = rows.some(r => r.status === 'created')
  const campaignSet = useMemo(() => new Set(campaign), [campaign])
  const inCampaign = rows.filter(r => campaignSet.has(r.uid))
  const campStates = inCampaign.map(r => stateOf(r))
  const createdRows = rows.filter(r => r.status === 'created' && r.order?.id)
  const nCreated = campStates.filter(s => s === 'created').length
  const nFailed = campStates.filter(s => s === 'failed').length
  const nUnknown = campStates.filter(s => s === 'unknown').length
  const nRemaining = campStates.filter(s => s === 'ok' || s === 'creating').length
  const nNotSent = rows.filter((r, i) => !campaignSet.has(r.uid) && states[i] !== 'created').length
  const finished = !run.running && nRemaining === 0
  const current = rows.find(r => r.status === 'busy')
  const editRow = rows.find(r => r.uid === editing) ?? null

  const filtered = rows.map((r, i) => [r, states[i]]).filter(([, st]) =>
    filter === 'all' ? true
      : filter === 'fix' ? ['fix', 'failed', 'unknown'].includes(st)
      : filter === 'ok' ? st === 'ok' || st === 'created'
      : st === 'excluded')

  const exportReport = () => {
    const head = ['Ligne du fichier', 'Destinataire', 'Téléphone', 'Adresse', 'Résultat', 'Référence', 'Montant livraison (FCFA)', 'Motif']
    downloadCsv(`rapport-import-livraisons-${dakarDay()}.csv`, head, rows.map((r, i) => {
      const st = states[i]
      return [
        r.line, r.name, r.phone ? phoneFmt(r.phone) : r.phoneRaw, r.order?.deliveryAddress ?? r.place?.address ?? r.addressText,
        STATE_META[st]?.label ?? st, r.orderId ? shortRef(r.orderId) : '', r.order ? orderTotal(r.order) : '',
        reasonOf(r, st) ?? (st === 'excluded' ? 'Exclue de l\'import' : ''),
      ]
    }))
  }

  const settingsSummary = [
    pickup?.label ?? 'Point de retrait',
    settings.payment === 'cod' ? 'Livraison payée par le client' : 'Livraison payée par la boutique',
    settings.when === 'now' ? 'Départ dès la création' : `Départ le ${new Date(dakarInputToISO(settings.scheduledAt)).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })}`,
  ]

  const phaseIndex = STEPS.findIndex(([k]) => k === phase)
  const description = phase === 'file'
    ? `Jusqu'à ${MAX_ROWS} livraisons d'un coup depuis Excel ou CSV : chaque adresse est cherchée sur la carte, chaque prix calculé, puis les livraisons sont créées une à une.`
    : fileName ? `Fichier « ${fileName} »` : 'Import en cours'

  return (
    <div className="im">
      <PageHeader
        eyebrow="Livraisons"
        title={<>Importer des livraisons<span className="dot">.</span></>}
        description={description}
        actions={<>
          {(phase === 'file' || phase === 'map') && (
            <Button variant="ghost" icon={FileSpreadsheet} loading={tplBusy} onClick={getTemplate}>Modèle Excel</Button>
          )}
          <Button variant="ghost" to="/livraisons">{phase === 'create' && finished ? 'Terminer' : 'Fermer'}</Button>
        </>}
      />

      <ol className="im-steps" aria-label="Étapes de l'import">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={`im-step ${i === phaseIndex ? 'is-on' : ''} ${i < phaseIndex ? 'is-done' : ''}`} aria-current={i === phaseIndex ? 'step' : undefined}>
            <span className="im-step-num" aria-hidden>{i < phaseIndex ? <Check size={13} /> : i + 1}</span>
            <span className="im-step-label">{label}</span>
          </li>
        ))}
      </ol>

      {/* ── 1. Fichier ── */}
      {phase === 'file' && (
        <>
          {saved && (
            <div className="dv-draft" role="region" aria-label="Import enregistré">
              <FileClock size={18} aria-hidden />
              <div className="dv-draft-txt">
                <strong>Reprendre l'import en cours ?</strong>
                <span className="muted">
                  {saved.fileName ? `« ${saved.fileName} » · ` : ''}
                  {saved.rows.filter(r => r.status === 'created').length} créée{saved.rows.filter(r => r.status === 'created').length > 1 ? 's' : ''} sur {saved.rows.filter(r => !r.excluded).length}
                  {saved.savedAt ? ` · enregistré ${timeAgo(saved.savedAt)}` : ''}
                </span>
              </div>
              <div className="dv-draft-actions">
                <Button variant="ghost" size="sm" icon={Trash2} onClick={discardSaved}>Oublier</Button>
                <Button size="sm" onClick={resumeSaved}>Reprendre</Button>
              </div>
            </div>
          )}
          <div className="im-file-grid">
            <div className={`card im-drop ${drag ? 'is-drag' : ''} ${fileError ? 'is-err' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) }}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]) }}>
              <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-hidden
                accept=".xlsx,.csv,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <span className="im-drop-ico" aria-hidden>{reading ? <Spinner size={24} /> : <Upload size={24} />}</span>
              <p className="im-drop-title">{reading ? 'Lecture du fichier…' : 'Déposez votre fichier ici'}</p>
              <p className="muted im-drop-sub">Excel (.xlsx) ou CSV · {MAX_ROWS} livraisons au plus</p>
              <Button icon={FileSpreadsheet} loading={reading} onClick={() => fileInput.current?.click()}>Choisir un fichier</Button>
              {fileError && <p className="nd-err im-drop-err" role="alert"><AlertCircle size={13} aria-hidden /> {fileError}</p>}
            </div>
            <aside className="card im-guide" aria-label="Colonnes attendues">
              <span className="label-caps">Colonnes attendues</span>
              <ul className="im-guide-list">
                {FIELDS.map(f => (
                  <li key={f.key}>
                    <span>{f.label}</span>
                    {f.required ? <em className="im-req">Obligatoire</em> : <span className="muted">Facultatif</span>}
                  </li>
                ))}
              </ul>
              <p className="muted im-guide-note">Vos titres de colonnes sont différents ? Vous les associerez à l'étape suivante.</p>
              <Button variant="ghost" size="sm" icon={Download} loading={tplBusy} onClick={getTemplate}>Télécharger le modèle</Button>
            </aside>
          </div>
        </>
      )}

      {/* ── 2. Colonnes et réglages ── */}
      {phase === 'map' && source && (
        <div className="im-map-grid">
          <section className="card im-panel" aria-labelledby="im-cols-title">
            <header className="im-panel-head">
              <h2 id="im-cols-title" className="section-title">Colonnes de votre fichier</h2>
              <p className="muted">
                {dataRows.length} ligne{dataRows.length > 1 ? 's' : ''} de livraison
                {dataRows.length > MAX_ROWS ? ` · seules les ${MAX_ROWS} premières seront importées` : ''}
              </p>
            </header>
            {dataRows.length > MAX_ROWS && (
              <div className="im-note is-warn" role="status">
                <AlertCircle size={16} aria-hidden />
                <span>Votre fichier compte {dataRows.length} lignes. Importez les {MAX_ROWS} premières maintenant, puis le reste dans un second fichier.</span>
              </div>
            )}
            <div className="im-panel-body">
              <label className={`dv-check ${hasHeader ? 'is-on' : ''}`}>
                <input type="checkbox" checked={hasHeader} onChange={e => toggleHeader(e.target.checked)} />
                <span className="dv-box" aria-hidden />
                <span className="dv-check-txt"><b>La première ligne contient les titres des colonnes</b><span>Décochez si votre fichier commence directement par une livraison.</span></span>
              </label>
              <div className="im-fields">
                {FIELDS.map(f => (
                  <FieldMap key={f.key} field={f} value={map[f.key]} columns={columns} sampleOf={sampleOf}
                    error={mapTried && f.required && map[f.key] == null} onChange={(v) => setField(f.key, v)} />
                ))}
              </div>
              {missingMap.length === 0 && dataRows.length > 0 && (
                <div className="im-preview">
                  <span className="label-caps">Aperçu</span>
                  <div className="im-preview-scroll">
                    <table className="im-preview-table">
                      <thead><tr><th>Destinataire</th><th>Téléphone</th><th>Adresse</th><th className="num-col">À encaisser</th></tr></thead>
                      <tbody>
                        {dataRows.slice(0, 3).map(r => {
                          const get = (k) => (map[k] != null ? String(r.cells[map[k]] ?? '').trim() : '')
                          const ph = normPhone(get('phone'))
                          const amt = parseAmount(get('amount'))
                          return (
                            <tr key={r.line}>
                              <td>{get('name') || <span className="muted">—</span>}</td>
                              <td className={phoneValid(ph) ? '' : 'im-bad'}>{phoneValid(ph) ? fmtPhone(ph) : get('phone') || '—'}</td>
                              <td>{get('address') || <span className="muted">—</span>}</td>
                              <td className={`num num-col ${amt.error ? 'im-bad' : ''}`}>{amt.error ? get('amount') : amt.value ? fcfa(amt.value) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card im-panel" aria-labelledby="im-set-title">
            <header className="im-panel-head">
              <h2 id="im-set-title" className="section-title">Réglages communs</h2>
              <p className="muted">Appliqués à toutes les livraisons du fichier.</p>
            </header>
            <div className="im-panel-body">
              <div className="im-group">
                <span className="label-caps nd-sub">Point de retrait</span>
                {addrFailed ? (
                  <ErrorState compact title="Adresses indisponibles" onRetry={loadAddresses} />
                ) : !addresses ? <Skeleton h={64} /> : addresses.length === 0 ? (
                  <p className="muted nd-help">Ajoutez une adresse de retrait dans <a className="link" href="#" onClick={(e) => { e.preventDefault(); navigate('/compte') }}>Compte</a> pour importer des livraisons.</p>
                ) : (
                  <div className="nd-picks im-picks" role="radiogroup" aria-label="Point de retrait">
                    {addresses.map(a => {
                      const on = a.id === settings.pickupId
                      return (
                        <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setSettings(s => ({ ...s, pickupId: a.id }))}
                          className={`nd-pick ${on ? 'is-on has-corners' : ''}`}>
                          {on && <Corners />}
                          <span className="nd-radio" aria-hidden />
                          <span className="nd-pick-txt"><b>{a.label}{a.isDefault && <em>Par défaut</em>}</b><span>{a.address}</span></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="im-group">
                <span className="label-caps nd-sub">Qui paie la livraison ?</span>
                <Segmented full label="Qui paie la livraison" value={settings.payment} onChange={(v) => setSettings(s => ({ ...s, payment: v }))}
                  options={[['cod', 'Le client', Users], ['merchant', 'Ma boutique', Store]]} />
                <p className="muted nd-help">{settings.payment === 'cod'
                  ? 'Chaque client règle sa livraison au coursier, avec le montant de ses articles.'
                  : 'Vous réglez les livraisons en ligne depuis le suivi. Le client ne paie que ses articles.'}</p>
              </div>
              <div className="im-group">
                <label className="label-caps nd-sub" htmlFor="im-cat">Type de colis par défaut</label>
                <select id="im-cat" className="input" value={settings.defaultCategory} onChange={e => setSettings(s => ({ ...s, defaultCategory: e.target.value }))}>
                  {PACKAGE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label} · {c.hint}</option>)}
                </select>
                <p className="muted nd-help">Pour les lignes sans colonne « Type de colis ».</p>
              </div>
              <div className="im-group">
                <span className="label-caps nd-sub">Départ</span>
                <Segmented full label="Départ" value={settings.when} onChange={(v) => setSettings(s => ({ ...s, when: v }))}
                  options={[['now', 'Dès la création', Zap], ['later', 'Programmer', CalendarClock]]} />
                {settings.when === 'later' ? (
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor="im-when" className="sr-only">Date et heure de retrait</label>
                    <input id="im-when" type="datetime-local" className="input" value={settings.scheduledAt}
                      min={minScheduleInput()}
                      onChange={e => setSettings(s => ({ ...s, scheduledAt: e.target.value }))}
                      aria-invalid={mapTried && !scheduleOk ? true : undefined} />
                    <p className="muted nd-help" style={{ marginTop: 4 }}>Heure de Dakar. Toutes les livraisons partiront à cette heure.</p>
                  </div>
                ) : <p className="muted nd-help">Un coursier proche part dès que chaque livraison est créée.</p>}
              </div>
            </div>
            <footer className="im-panel-foot">
              {mapTried && mapProblems.length > 0 && (
                <div className="nd-missing">
                  <span className="label-caps">À compléter</span>
                  <ul>{mapProblems.map(m => <li key={m}><AlertCircle size={13} aria-hidden /> {m.charAt(0).toUpperCase() + m.slice(1)}</li>)}</ul>
                </div>
              )}
              <div className="im-foot-actions">
                <Button variant="ghost" icon={ArrowLeft} onClick={() => setPhase('file')}>Autre fichier</Button>
                <Button size="lg" arrow="right" disabled={mapTried && mapProblems.length > 0} onClick={startCheck}>
                  Vérifier {Math.min(dataRows.length, MAX_ROWS)} ligne{Math.min(dataRows.length, MAX_ROWS) > 1 ? 's' : ''}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {/* ── 3. Vérification ── */}
      {phase === 'check' && (
        <>
          <div className="card im-sum">
            <div className="im-sum-counts">
              <SumStat tone="ok" icon={CircleCheck} value={count('ok')} label={count('ok') > 1 ? 'prêtes' : 'prête'} />
              <SumStat tone="warn" icon={CircleAlert} value={count('fix', 'failed', 'unknown')} label="à corriger" />
              {count('excluded') > 0 && <SumStat tone="off" icon={Ban} value={count('excluded')} label={count('excluded') > 1 ? 'exclues' : 'exclue'} />}
              {count('created') > 0 && <SumStat tone="ok" icon={Bike} value={count('created')} label={count('created') > 1 ? 'déjà créées' : 'déjà créée'} />}
            </div>
            <div className="im-sum-settings">
              <span className="muted">{settingsSummary.join(' · ')}</span>
              {source && !anyCreated && <button type="button" className="link im-link" onClick={() => setPhase('map')}>Modifier</button>}
            </div>
            {addresses && !pickup && (
              <div className="im-note is-warn" role="status">
                <AlertCircle size={16} aria-hidden />
                <span>Le point de retrait de cet import n'existe plus. Choisissez-en un pour calculer les prix.</span>
                <select className="input im-note-select" value="" onChange={e => changePickup(e.target.value)} aria-label="Point de retrait">
                  <option value="">Choisir…</option>
                  {addresses.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
            )}
            {(checking || checkDone < checkTotal) && !checkPause && (
              <div className="im-progress" aria-live="polite">
                <div className="im-progress-txt">
                  <span><Spinner size={14} /> Vérification des adresses et des prix</span>
                  <span className="num">{checkDone} / {checkTotal}</span>
                </div>
                <Bar value={checkDone} max={checkTotal} />
              </div>
            )}
            {checkPause && (
              <div className="im-note is-warn" role="status">
                <PauseCircle size={16} aria-hidden />
                <span>{checkPause.kind === 'quota'
                  ? 'Le serveur limite le nombre de recherches : la vérification reprend d\'elle-même dans 30 secondes.'
                  : 'Connexion perdue : la vérification est en pause.'}</span>
                <Button variant="ghost" size="sm" icon={Play} onClick={() => runCheck()}>Reprendre</Button>
              </div>
            )}
          </div>

          <div className="card im-table-card">
            <div className="dl-tabs" role="tablist" aria-label="Filtrer les lignes">
              {[['all', 'Toutes', rows.length], ['fix', 'À corriger', count('fix', 'failed', 'unknown')], ['ok', 'Prêtes', count('ok', 'created')], ['excluded', 'Exclues', count('excluded')]].map(([k, label, n]) => (
                <button key={k} type="button" role="tab" aria-selected={filter === k} className="dl-tab" onClick={() => setFilter(k)}>
                  {label}<span className="dl-count num">{n}</span>
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <Empty icon={filter === 'fix' ? CircleCheck : FileSpreadsheet} title={filter === 'fix' ? 'Rien à corriger' : 'Aucune ligne ici'}
                text={filter === 'fix' ? 'Toutes les lignes vérifiées sont prêtes.' : null} />
            ) : (
              <RowsTable items={filtered} onEdit={setEditing} onExclude={toggleExclude} onResend={resend} disabled={run.running} />
            )}
          </div>

          <div className="im-bar">
            <div className="im-bar-txt">
              <b className="num">{readyRows.length} livraison{readyRows.length > 1 ? 's' : ''} prête{readyRows.length > 1 ? 's' : ''}</b>
              <span className="muted">
                {readyRows.length > 0 ? <>Total estimé <span className="num">{fcfa(readyTotal)}</span></> : 'Corrigez ou excluez les lignes signalées.'}
                {count('fix', 'failed', 'unknown') > 0 && readyRows.length > 0 ? ` · ${count('fix', 'failed', 'unknown')} à corriger, non créée${count('fix', 'failed', 'unknown') > 1 ? 's' : ''}` : ''}
              </span>
            </div>
            <div className="im-bar-actions">
              {anyCreated && <Button variant="ghost" onClick={() => setPhase('create')}>Suivi de la création</Button>}
              <Button arrow="right" disabled={checking || readyRows.length === 0 || run.running} onClick={() => setConfirmOpen(true)}>
                Créer {readyRows.length} livraison{readyRows.length > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── 4. Création et rapport ── */}
      {phase === 'create' && (
        <>
          <div className={`card im-run ${finished ? 'is-done' : ''}`}>
            {run.running ? (
              <>
                <div className="im-run-head">
                  <div>
                    <span className="label-caps">Création en cours</span>
                    <p className="im-run-big num">{nCreated} <span>sur {inCampaign.length}</span></p>
                    <p className="muted im-run-sub" aria-live="polite">
                      {run.stopping ? 'Arrêt après la livraison en cours…' : current ? `Livraison pour ${current.name || 'votre client'} (ligne ${current.line})…` : 'Préparation…'}
                    </p>
                  </div>
                  <Button variant="ghost" icon={Square} disabled={run.stopping} onClick={stop}>Arrêter</Button>
                </div>
                <Bar value={nCreated + nFailed + nUnknown} max={inCampaign.length} />
                <p className="muted im-run-hint">Une livraison à la fois, pour ne pas saturer votre compte. Gardez cette page ouverte.</p>
              </>
            ) : finished ? (
              <>
                <div className="im-run-head">
                  <div>
                    <span className="label-caps">Import terminé</span>
                    <p className="im-run-big num">{nCreated} <span>livraison{nCreated > 1 ? 's' : ''} créée{nCreated > 1 ? 's' : ''}</span></p>
                    <p className="muted im-run-sub">
                      {nFailed + nUnknown === 0 ? 'Tout est parti. Les coursiers sont recherchés pour chaque livraison.' : 'Certaines lignes n\'ont pas été créées : voyez le motif ci-dessous.'}
                    </p>
                  </div>
                </div>
                <div className="im-report">
                  <ReportStat tone="ok" value={nCreated} label="Créées" />
                  <ReportStat tone="err" value={nFailed} label="Échouées" />
                  <ReportStat tone="warn" value={nUnknown} label="À vérifier" />
                  <ReportStat tone="off" value={nNotSent} label="Non envoyées" />
                </div>
                <div className="im-run-actions">
                  <Button icon={Printer} disabled={!createdRows.length} onClick={() => setPrintOpen(true)}>
                    Imprimer les bons{createdRows.length ? ` (${createdRows.length})` : ''}
                  </Button>
                  {nFailed > 0 && <Button variant="ghost" icon={RotateCcw} onClick={retryFailed}>Réessayer les échecs</Button>}
                  <Button variant="ghost" icon={Download} onClick={exportReport}>Rapport CSV</Button>
                  <Button variant="ghost" to="/livraisons">Voir mes livraisons</Button>
                  <Button variant="quiet" onClick={reset}>Nouvel import</Button>
                </div>
              </>
            ) : (
              <>
                <div className="im-run-head">
                  <div>
                    <span className="label-caps">{run.halt ? 'Import interrompu' : 'Import en pause'}</span>
                    <p className="im-run-big num">{nCreated} <span>sur {inCampaign.length}</span></p>
                    <p className="muted im-run-sub">{nRemaining} livraison{nRemaining > 1 ? 's' : ''} restante{nRemaining > 1 ? 's' : ''}. Les livraisons déjà créées ne seront pas renvoyées.</p>
                  </div>
                </div>
                <Bar value={nCreated + nFailed + nUnknown} max={inCampaign.length} />
                {run.halt && <HaltNote halt={run.halt} settings={settings} onSchedule={(v) => setSettings(s => ({ ...s, ...v }))} />}
                <div className="im-run-actions">
                  {run.halt?.kind !== 'plan' && <Button icon={Play} onClick={runCreate}>Reprendre</Button>}
                  {run.halt?.kind === 'plan' && <Button to="/compte" arrow="right">Voir les offres</Button>}
                  <Button variant="ghost" onClick={() => setPhase('check')}>Retour à la vérification</Button>
                  {createdRows.length > 0 && <Button variant="ghost" icon={Printer} onClick={() => setPrintOpen(true)}>Imprimer les bons ({createdRows.length})</Button>}
                  <Button variant="ghost" icon={Download} onClick={exportReport}>Rapport CSV</Button>
                </div>
              </>
            )}
          </div>

          <div className="card im-table-card">
            {inCampaign.length === 0 ? (
              <Empty icon={FileSpreadsheet} title="Aucune livraison envoyée" text="Revenez à la vérification pour choisir les lignes à créer."
                action={<Button variant="ghost" size="sm" onClick={() => setPhase('check')}>Retour à la vérification</Button>} />
            ) : (
              <RowsTable items={inCampaign.map((r, i) => [r, campStates[i]])} onEdit={(uid) => { setPhase('check'); setEditing(uid) }}
                onExclude={toggleExclude} onResend={(uid) => { resend(uid) }} disabled={run.running} showRef />
            )}
          </div>
        </>
      )}

      {/* Confirmation avant l'envoi */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} width={520}
        title={`Créer ${readyRows.length} livraison${readyRows.length > 1 ? 's' : ''} ?`}
        subtitle="Elles sont envoyées une à une : vous pouvez arrêter à tout moment, puis reprendre sans doublon."
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Pas maintenant</Button>
          <Button arrow="right" disabled={!ack || !readyRows.length} onClick={startCreate}>Créer {readyRows.length} livraison{readyRows.length > 1 ? 's' : ''}</Button>
        </>}>
        <dl className="nd-rows im-confirm">
          <div><dt>Retrait</dt><dd>{pickup ? `${pickup.label} · ${pickup.address}` : '—'}</dd></div>
          <div><dt>Paiement</dt><dd>{settingsSummary[1]}</dd></div>
          <div><dt>Départ</dt><dd>{settingsSummary[2]}</dd></div>
          <div><dt>Total estimé</dt><dd className="num"><b>{fcfa(readyTotal)}</b></dd></div>
        </dl>
        <div className={`dv-check dv-ack ${ack ? 'is-on' : ''}`} style={{ marginTop: 16 }}>
          <label className="dv-ack-main">
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
            <span className="dv-box" aria-hidden />
            <ShieldCheck size={16} className="dv-check-ico" aria-hidden />
            <span className="dv-check-txt"><b>Aucun objet interdit dans ces colis</b><span>Obligatoire pour lancer les livraisons.</span></span>
          </label>
          <button type="button" className="link dv-list-btn" onClick={() => setListOpen(o => !o)} aria-expanded={listOpen}>{listOpen ? 'Masquer la liste' : 'Voir la liste'}</button>
        </div>
        {listOpen && (
          <ul className="dv-banned" style={{ marginTop: 10 }}>
            {PROHIBITED_ITEMS.map(t => <li key={t}><Ban size={15} aria-hidden /> {t}</li>)}
          </ul>
        )}
        {settings.when === 'later' && !scheduleOk && (
          <p className="nd-err" role="alert" style={{ marginTop: 12 }}><AlertCircle size={13} aria-hidden /> L'heure de départ est trop proche : la création s'arrêtera. Modifiez-la dans les réglages.</p>
        )}
      </Modal>

      {editRow && (
        <RowEditor key={editRow.uid} row={editRow} pickup={pickup} resolvePlace={resolvePlace}
          onClose={() => setEditing(null)} onSave={(patch) => saveEdit(editRow.uid, patch)} />
      )}

      {printOpen && <PrintLabelsModal open orders={createdRows.map(r => r.order)} onClose={() => setPrintOpen(false)} />}
    </div>
  )
}

// ── Composants ───────────────────────────────────────────────────────────────

function Bar({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="im-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

function SumStat({ tone, icon, value, label }) {
  const Icon = icon
  return (
    <span className={`im-stat is-${tone}`}>
      <Icon size={16} aria-hidden />
      <b className="num">{value}</b> {label}
    </span>
  )
}

function ReportStat({ tone, value, label }) {
  return (
    <div className={`im-rstat is-${tone}`}>
      <span className="label-caps">{label}</span>
      <b className="num">{value}</b>
    </div>
  )
}

function HaltNote({ halt, settings, onSchedule }) {
  const text = {
    plan: `${halt.message ?? 'Votre offre ne permet pas de créer d\'autres livraisons.'} Choisissez une offre dans Compte, puis reprenez l'import.`,
    quota: 'Trop de requêtes pour votre compte en peu de temps (le téléphone compte aussi). Attendez quelques minutes, puis reprenez.',
    network: 'Connexion perdue. Vérifiez votre connexion, puis reprenez.',
    auth: halt.message ?? 'Votre session ne permet pas de créer ces livraisons.',
    server: 'Le serveur DEM ne répond pas correctement. Réessayez dans quelques minutes.',
    pickup: 'Le point de retrait choisi n\'est plus disponible. Revenez à la vérification.',
    schedule: 'L\'heure de départ est trop proche (15 minutes au moins). Choisissez une nouvelle heure ou un départ immédiat.',
  }[halt.kind] ?? 'L\'import s\'est arrêté.'
  return (
    <div className={`im-note ${halt.kind === 'plan' || halt.kind === 'auth' ? 'is-err' : 'is-warn'}`} role="alert">
      <AlertCircle size={16} aria-hidden />
      <span>{text}</span>
      {halt.kind === 'schedule' && (
        <div className="im-note-form">
          <label htmlFor="im-resched" className="sr-only">Nouvelle heure de départ</label>
          <input id="im-resched" type="datetime-local" className="input" value={settings.scheduledAt}
            min={minScheduleInput()} onChange={e => onSchedule({ scheduledAt: e.target.value })} />
          <Button variant="ghost" size="sm" icon={Zap} onClick={() => onSchedule({ when: 'now' })}>Partir dès la création</Button>
        </div>
      )}
    </div>
  )
}

// Choix d'une colonne pour un champ (exemple de valeur affiché)
function FieldMap({ field, value, columns, sampleOf, error, onChange }) {
  const id = useId()
  return (
    <div className={`im-field ${value != null ? 'is-set' : ''}`}>
      <label htmlFor={id} className="im-field-name">
        {field.label}
        {field.required ? <em className="im-req">Obligatoire</em> : null}
      </label>
      <select id={id} className="input im-select" value={value ?? ''} onChange={e => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}>
        <option value="">{field.required ? '— Choisir une colonne —' : '— Aucune —'}</option>
        {columns.map(c => {
          const ex = sampleOf(c.index)
          const text = c.title ? `${c.letter} · ${c.title}${ex ? ` (ex. ${ex})` : ''}` : `Colonne ${c.letter}${ex ? ` · ${ex}` : ''}`
          return <option key={c.index} value={c.index}>{text}</option>
        })}
      </select>
      {error && <span className="nd-err"><AlertCircle size={13} aria-hidden /> Choisissez la colonne correspondante.</span>}
    </div>
  )
}

// Tableau des lignes (vérification et création) ; cartes sur téléphone
function RowsTable({ items, onEdit, onExclude, onResend, disabled, showRef }) {
  const actions = (r, st) => {
    const editable = !disabled && ['fix', 'ok', 'failed', 'excluded'].includes(st)
    return (
      <div className="im-actions">
        {st === 'unknown' && !disabled && <>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onResend(r.uid)} title="Après avoir vérifié dans Livraisons qu'elle n'existe pas">Renvoyer</Button>
          <IconButton icon={Ban} label="Écarter cette ligne" size="sm" variant="plain" onClick={() => onExclude(r.uid)} />
        </>}
        {editable && st !== 'excluded' && <IconButton icon={Pencil} label={`Corriger la ligne ${r.line}`} size="sm" variant="plain" onClick={() => onEdit(r.uid)} />}
        {editable && <IconButton icon={st === 'excluded' ? Undo2 : Ban} label={st === 'excluded' ? 'Remettre dans l\'import' : 'Exclure de l\'import'} size="sm" variant="plain" onClick={() => onExclude(r.uid)} />}
      </div>
    )
  }
  return (
    <>
      <ul className="im-mlist pro-only-sm">
        {items.map(([r, st]) => (
          <li key={r.uid} className={`im-mcard ${st === 'excluded' ? 'is-off' : ''}`}>
            <div className="im-mcard-top">
              <span className="mono im-line">L{r.line}</span>
              <StateBadge st={st} />
            </div>
            <div className="im-mcard-name">{r.name || <span className="im-bad">Nom manquant</span>}</div>
            <div className="muted im-mcard-sub">{phoneValid(r.phone) ? fmtPhone(r.phone) : <span className="im-bad">{r.phoneRaw || 'Téléphone manquant'}</span>}</div>
            <div className="im-mcard-addr">{r.place?.address ?? r.addressText ?? '—'}</div>
            <div className="im-mcard-foot">
              <span className="muted num">{r.amount ? `À encaisser ${fcfa(r.amount)}` : 'Rien à encaisser'}</span>
              <span className="num im-price">{st === 'created' && r.order ? fcfa(orderTotal(r.order)) : r.quote ? fcfa(quoteTotal(r.quote)) : '—'}</span>
            </div>
            {reasonOf(r, st) && <p className={`im-reason ${st === 'failed' ? 'is-err' : ''}`}>{reasonOf(r, st)}</p>}
            {actions(r, st)}
          </li>
        ))}
      </ul>
      <div className="pro-hide-only-sm">
        <table className="im-table">
          <colgroup>
            <col className="c-line" /><col className="c-who" /><col className="c-addr" /><col className="c-pkg" />
            <col className="c-amt" /><col className="c-price" /><col className="c-state" /><col className="c-act" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="c-line">Ligne</th>
              <th scope="col">Destinataire</th>
              <th scope="col">Adresse</th>
              <th scope="col" className="c-pkg">Colis</th>
              <th scope="col" className="num-col c-amt">À encaisser</th>
              <th scope="col" className="num-col">Livraison</th>
              <th scope="col">{showRef ? 'Résultat' : 'État'}</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map(([r, st]) => {
              const cat = categoryOf(r.category)
              const reason = reasonOf(r, st)
              return (
                <tr key={r.uid} className={`${st === 'excluded' ? 'is-off' : ''} ${st === 'creating' ? 'is-busy' : ''}`}>
                  <td className="c-line"><span className="mono im-line">{r.line}</span></td>
                  <td>
                    <div className="im-name">{r.name || <span className="im-bad">Nom manquant</span>}</div>
                    <div className="im-sub">{phoneValid(r.phone) ? fmtPhone(r.phone) : <span className="im-bad">{r.phoneRaw || 'Téléphone manquant'}</span>}</div>
                  </td>
                  <td>
                    {r.place ? (
                      <>
                        <div className="im-ellipsis" title={r.place.address}><MapPin size={12} aria-hidden className="im-pin" /> {r.place.address}</div>
                        {typedAdds(r) && <div className="im-sub im-ellipsis" title={r.addressText}>Fichier : {r.addressText}</div>}
                      </>
                    ) : (
                      <div className="im-ellipsis muted" title={r.addressText}>{r.addressText || '—'}</div>
                    )}
                    {r.landmark && <div className="im-sub im-ellipsis" title={r.landmark}>Repère : {r.landmark}</div>}
                  </td>
                  <td className="c-pkg">
                    <div className="im-ellipsis">{cat?.label ?? '—'}</div>
                    {r.fragile && <span className="dv-tag"><Wine size={11} aria-hidden /> Fragile</span>}
                    {r.categoryUnknown && <div className="im-sub im-warn-txt" title={`« ${r.categoryUnknown} » non reconnu`}>« {r.categoryUnknown} » ?</div>}
                  </td>
                  <td className="num num-col c-amt">{r.amount ? fcfa(r.amount) : <span className="muted">—</span>}</td>
                  <td className="num num-col">
                    {st === 'created' && r.order ? <b>{fcfa(orderTotal(r.order))}</b>
                      : r.quoteState === 'busy' ? <Spinner size={14} />
                      : r.quote ? fcfa(quoteTotal(r.quote)) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <StateBadge st={st} />
                    {st === 'created' && r.orderId && <div className="im-sub mono">{shortRef(r.orderId)}</div>}
                    {reason && <div className={`im-reason ${st === 'failed' ? 'is-err' : ''}`} title={reason}>{reason}</div>}
                  </td>
                  <td className="c-act">{actions(r, st)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function StateBadge({ st }) {
  const m = STATE_META[st] ?? { label: st, cls: 'is-off' }
  return (
    <span className={`im-badge ${m.cls}`}>
      {st === 'checking' || st === 'creating' ? <Spinner size={11} /> : <span className="badge-dot" aria-hidden />}
      {m.label}
    </span>
  )
}

// ── Correction d'une ligne ───────────────────────────────────────────────────
function RowEditor({ row, pickup, resolvePlace, onClose, onSave }) {
  const [name, setName] = useState(row.name)
  const [phone, setPhone] = useState(row.phone || row.phoneRaw)
  const [place, setPlace] = useState(row.place)
  const [landmark, setLandmark] = useState(row.landmark)
  const [amount, setAmount] = useState(row.amount != null ? String(row.amount) : (row.amountRaw ?? ''))
  const [itemsText, setItemsText] = useState(row.itemsText)
  const [note, setNote] = useState(row.note)
  const [category, setCategory] = useState(row.category)
  const [fragile, setFragile] = useState(!!row.fragile)
  const [picking, setPicking] = useState(null)
  const [pickError, setPickError] = useState(null)
  const [tried, setTried] = useState(false)

  const digits = normPhone(phone).slice(0, 9)
  const phoneOk = phoneValid(digits)
  const amt = parseAmount(amount)
  const errors = {
    name: tried && name.trim().length < 2 ? 'Indiquez le nom du destinataire (2 lettres au moins).' : null,
    phone: tried && !phoneOk ? 'Mobile sénégalais : 70, 75, 76, 77 ou 78, puis 7 chiffres.' : null,
    place: tried && !place ? 'Choisissez l\'adresse dans la liste, cherchez-la, ou cliquez sur la carte.' : null,
    amount: tried && amt.error ? amt.error : null,
  }
  const ok = name.trim().length >= 2 && phoneOk && !!place && !amt.error

  const chooseSuggestion = async (s) => {
    if (picking) return
    setPicking(s.id); setPickError(null)
    try {
      const p = await resolvePlace(s)
      if (p) setPlace(p)
      else setPickError('Position introuvable pour ce lieu : cliquez sur la carte.')
    } catch (e) { setPickError(errMsg(e, 'Position introuvable : cliquez sur la carte.')) }
    finally { setPicking(null) }
  }

  const save = () => {
    setTried(true)
    if (!ok) return
    onSave({
      name: name.trim().slice(0, 100), phone: digits, phoneRaw: phone, place, landmark: landmark.trim().slice(0, 160),
      amount: amt.value ?? null, amountError: null, amountRaw: amount, itemsText: itemsText.trim().slice(0, 200), note: note.trim().slice(0, 300),
      category, categoryUnknown: null, fragile,
    })
  }

  const others = (row.suggestions ?? []).filter(s => !place || placeLabel(s) !== place.address)

  return (
    <Modal open onClose={onClose} width={820} title={`Corriger la ligne ${row.line}`}
      subtitle={row.addressText ? `Adresse du fichier : « ${row.addressText} »` : 'Aucune adresse dans le fichier.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button disabled={tried && !ok} onClick={save}>Enregistrer la ligne</Button>
      </>}>
      <div className="im-edit">
        <div className="im-edit-form">
          <div className="nd-cols">
            <EditField label="Nom du destinataire" error={errors.name}>
              {(p) => <input {...p} className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />}
            </EditField>
            <EditField label="Téléphone" error={errors.phone}>
              {(p) => (
                <div className="nd-phone">
                  <span className="nd-prefix">+221</span>
                  <input {...p} className="input" inputMode="numeric" autoComplete="off" value={phoneOk ? fmtPhone(digits) : phone}
                    onChange={e => setPhone(e.target.value)} placeholder="77 123 45 67" />
                  {phoneOk && <Check size={16} className="nd-ok" aria-hidden />}
                </div>
              )}
            </EditField>
          </div>

          <div className="im-edit-addr">
            <span className="nd-label">Adresse de livraison</span>
            <AddressSearch value={place} onPick={(p) => { setPlace(p); setPickError(null) }} onClear={() => setPlace(null)} error={errors.place} />
            {others.length > 0 && (
              <div className="im-sugg">
                <span className="label-caps nd-sub">Autres résultats pour cette adresse</span>
                <ul>
                  {others.map(s => (
                    <li key={s.id}>
                      <button type="button" onClick={() => chooseSuggestion(s)} disabled={!!picking}>
                        {picking === s.id ? <Spinner size={14} /> : <MapPin size={14} aria-hidden />}
                        <span><b>{s.name}</b>{s.secondary && <small>{s.secondary}</small>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pickError && <span className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> {pickError}</span>}
          </div>

          <EditField label="Repère (conseillé)">
            {(p) => <input {...p} className="input" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Ex. face pharmacie, portail bleu" />}
          </EditField>

          <div className="nd-cols">
            <EditField label="Montant à encaisser (F)" error={errors.amount}>
              {(p) => <input {...p} className="input" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Vide si rien à encaisser" />}
            </EditField>
            <EditField label="Articles">
              {(p) => <input {...p} className="input" value={itemsText} onChange={e => setItemsText(e.target.value)} placeholder="Ex. 2 robes wax" />}
            </EditField>
          </div>
          <div className="nd-cols">
            <EditField label="Type de colis">
              {(p) => (
                <select {...p} className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  {PACKAGE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              )}
            </EditField>
            <EditField label="Note pour le coursier">
              {(p) => <input {...p} className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex. appeler avant de passer" />}
            </EditField>
          </div>
          <label className={`dv-check ${fragile ? 'is-on' : ''}`}>
            <input type="checkbox" checked={fragile} onChange={e => setFragile(e.target.checked)} />
            <span className="dv-box" aria-hidden />
            <Wine size={16} className="dv-check-ico" aria-hidden />
            <span className="dv-check-txt"><b>Fragile</b><span>Le coursier est prévenu d'en prendre soin.</span></span>
          </label>
        </div>
        <div className="im-edit-map">
          <PickMap pickup={pickup} drop={place} onPick={(p) => { setPlace(p); setPickError(null) }} />
        </div>
      </div>
    </Modal>
  )
}

function EditField({ label, error, children }) {
  const id = useId()
  const errId = `${id}-err`
  return (
    <div className="field">
      <label htmlFor={id}><span className="nd-label">{label}</span></label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errId : undefined })}
      {error && <span id={errId} className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> {error}</span>}
    </div>
  )
}

// Carte : retrait (A) et livraison (B) ; un clic place la livraison
const pinIcon = (bg, label) => L.divIcon({
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:grid;place-items:center;color:#fff;font:700 11px 'DM Sans',sans-serif">${label}</div>`,
})

function ClickToPick({ onPick }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng
      let address = 'Point placé sur la carte'
      try { const r = await proApi.get('/public/places/reverse-geocode', { params: { lat, lng } }); if (r.data?.address) address = r.data.address } catch { /* sans adresse */ }
      onPick({ address, lat, lng })
    },
  })
  return null
}

function FitTo({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const v = JSON.parse(key).filter(Boolean)
    map.invalidateSize()
    if (v.length === 2) map.fitBounds(L.latLngBounds(v).pad(0.35), { animate: false })
    else if (v.length === 1) map.setView(v[0], 14, { animate: false })
  }, [map, key])
  return null
}

function PickMap({ pickup, drop, onPick }) {
  const a = pickup?.lat != null ? [pickup.lat, pickup.lng] : null
  const b = drop ? [drop.lat, drop.lng] : null
  return (
    <MapContainer center={b ?? a ?? [14.7167, -17.4677]} zoom={13} style={{ height: '100%', width: '100%', cursor: 'crosshair' }} zoomControl attributionControl={false}>
      <MapBaseLayer />
      <ClickToPick onPick={onPick} />
      {a && <Marker position={a} icon={pinIcon('#021520', 'A')} />}
      {b && <Marker position={b} icon={pinIcon('#0086C8', 'B')} />}
      <FitTo points={[a, b]} />
      <div className="nd-map-hint"><MousePointerClick size={13} aria-hidden /> Cliquez pour placer le point de livraison</div>
    </MapContainer>
  )
}
