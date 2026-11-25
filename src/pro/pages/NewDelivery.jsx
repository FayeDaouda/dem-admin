import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin, Search, Check, Minus, Plus, X, History, MousePointerClick, Lock, BadgeCheck, Clock, Users, Store, Zap, CalendarClock, AlertCircle,
  Wine, ShieldCheck, Ban, Tag, Gauge, FileClock, Trash2, Bike,
} from 'lucide-react'
import MapBaseLayer from '../../components/MapBaseLayer'
import proApi, { errMsg } from '../lib/proApi'
import { fcfa, phoneFmt, dakarInputToISO, isoToDakarInput, timeAgo, TZ } from '../lib/format'
import { Button, Chip, Corners, Modal, PageHeader, Segmented, Skeleton, Spinner } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { PACKAGE_CATEGORIES, DEFAULT_CATEGORY, PROHIBITED_ITEMS, categoryOf } from '../ui/packageCategories'
import '../styles/delivery.css'

// Nouvelle livraison (simple ou programmée) : même création que l'app
// (POST /orders, prix officiel /orders/estimate garanti à la création).
// ?commande=ID : commande reçue par le lien, pré-remplie (point de retrait et
// prix figés si le serveur les fournit). ?dupliquer=ID : reprise d'une
// livraison existante.
// Lot 2 (comme l'app 1.2.5) : type de colis (supplément éventuel compris
// dans le prix garanti), Fragile, « aucun objet interdit », Express, code
// promo (GET /orders/promo/preview), brouillon gardé dans le navigateur.
const newToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const fmtPhone = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))

// Codes d'erreur du serveur (lien de commande à prix figé)
const LOCK_ERRORS = {
  PICKUP_LOCKED: 'Cette commande part obligatoirement du point de retrait choisi à la commande de votre client.',
  PRICE_LOCKED: 'Le prix de cette commande est fixé : seule la livraison standard est possible.',
  APP_UPDATE_REQUIRED: 'Cette commande a été payée d\'avance : rechargez la page pour la valider avec la dernière version.',
}

// Description d'une livraison → repère et note (format écrit à la création)
function splitDescription(desc, items) {
  const out = { landmark: '', note: '' }
  if (!desc) return out
  const itemsText = (items ?? []).map(i => `${i.name} ×${i.quantity}`).join(', ')
  const rest = []
  for (const part of desc.split(' · ')) {
    const m = part.match(/^Repère\s*:\s*(.*)$/)
    if (m) out.landmark = m[1]
    else if (part !== itemsText) rest.push(part)
  }
  out.note = rest.join(' · ')
  return out
}

// Brouillon : la saisie en cours est gardée dans ce navigateur (comme l'app,
// dem_pro_draft_storage.dart) et proposée à la prochaine livraison.
// Stockage parfois indisponible (navigation privée, données bloquées) :
// chaque accès est protégé, la page marche sans.
const DRAFT_KEY = 'dem-pro:brouillon-livraison'
const DRAFT_MAX_AGE = 7 * 86400e3
const draftStore = {
  read() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
      if (!d || typeof d !== 'object') return null
      if (!d.savedAt || Date.now() - Date.parse(d.savedAt) > DRAFT_MAX_AGE) { this.clear(); return null }
      return d
    } catch { return null }
  },
  write(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: new Date().toISOString() })) } catch { /* stockage indisponible */ } },
  clear() { try { localStorage.removeItem(DRAFT_KEY) } catch { /* stockage indisponible */ } },
}

// Express : le serveur l'accepte pour DEM Pro, mais l'app 1.2.5 ne le
// propose pas aux commerçants — masqué ici aussi, tant que ce n'est pas décidé.
const SHOW_EXPRESS = false

export default function NewDelivery() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [params] = useSearchParams()
  const requestId = params.get('commande') // commande reçue par le lien, à livrer
  const dupId = params.get('dupliquer')    // livraison à reprendre
  const [request, setRequest] = useState(null)
  const [addresses, setAddresses] = useState(null)
  const [recent, setRecent] = useState([])
  const [products, setProducts] = useState([])
  const [pickupId, setPickupId] = useState(null)
  const [drop, setDrop] = useState(null) // { address, lat, lng }
  const [landmark, setLandmark] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [items, setItems] = useState([]) // { productId?, name, quantity, price? }
  const [note, setNote] = useState('')
  const [payment, setPayment] = useState('cod')
  const [when, setWhen] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  // Calcul du prix impossible : message affiché à la place du prix, avec « Réessayer »
  const [estimateError, setEstimateError] = useState(null)
  const [estimateTry, setEstimateTry] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState({})
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [dupFrom, setDupFrom] = useState(null)
  // Colis (comme l'app : petit colis par défaut, confirmation obligatoire)
  const [category, setCategory] = useState(DEFAULT_CATEGORY)
  const [fragile, setFragile] = useState(false)
  const [ack, setAck] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [surcharges, setSurcharges] = useState({}) // catégorie → supplément (F)
  const [priority, setPriority] = useState('NORMAL') // NORMAL | EXPRESS
  // Code promo : `promoCode` = code saisi ET accepté par le serveur
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoCode, setPromoCode] = useState(null)
  const [promoError, setPromoError] = useState(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [discount, setDiscount] = useState(null) // { amount, label, codeNotUsed }
  // Brouillon proposé à l'ouverture (nouvelle livraison seulement)
  const [draft, setDraft] = useState(() => (requestId || dupId ? null : draftStore.read()))
  const draftReady = useRef(!!(requestId || dupId) || !draft) // pas d'écrasement avant le choix

  useEffect(() => {
    proApi.get('/dem-pro/addresses').then(r => {
      setAddresses(r.data ?? [])
      setPickupId(id => id ?? (r.data ?? []).find(a => a.isDefault)?.id ?? r.data?.[0]?.id ?? null)
    }).catch(() => setAddresses([]))
    proApi.get('/dem-pro/me/recent-destinations').then(r => setRecent(r.data ?? [])).catch(() => {})
    proApi.get('/dem-pro/products').then(r => setProducts((r.data ?? []).filter(p => !p.locked))).catch(() => {})
    // Suppléments par catégorie (0 par défaut) : affichés sur chaque type ;
    // le prix garanti les inclut déjà (estimation envoyée avec la catégorie)
    proApi.get('/orders/package-categories').then(r => {
      setSurcharges(Object.fromEntries((r.data?.categories ?? []).map(c => [c.key, Math.max(0, Math.round(Number(c.surcharge) || 0))])))
    }).catch(() => {})
  }, [])

  // Commande reçue : client, adresse, repère, articles et note pré-remplis
  useEffect(() => {
    if (!requestId) return
    proApi.get('/dem-pro/order-requests').then(r => {
      const req = (r.data ?? []).find(x => x.id === requestId)
      if (!req) return
      setRequest(req)
      if (req.customerName) setName(req.customerName)
      if (req.customerPhone) setPhone(req.customerPhone.replace(/^\+221/, ''))
      if (req.deliveryLatitude != null) setDrop({ address: req.deliveryAddress, lat: req.deliveryLatitude, lng: req.deliveryLongitude })
      if (req.landmark) setLandmark(req.landmark)
      if (req.notes) setNote(req.notes)
      setItems((req.items ?? []).map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity ?? 1, price: i.price ?? undefined })))
      if (req.pickupAddressId) setPickupId(req.pickupAddressId)
      if (req.deliveryPayment === 'WITH_ORDER' && !req.paymentTiming) setPayment('merchant')
    }).catch(() => {})
  }, [requestId])

  // Dupliquer : reprise d'une livraison existante (nouvel horaire « maintenant »)
  useEffect(() => {
    if (!dupId || requestId) return
    proApi.get(`/orders/${dupId}`).then(r => {
      const o = r.data?.order ?? r.data
      if (!o) return
      setDupFrom(o)
      if (o.receiverName) setName(o.receiverName)
      if (o.receiverPhone) setPhone(o.receiverPhone.replace(/^\+221/, ''))
      if (o.deliveryLatitude != null) setDrop({ address: o.deliveryAddress, lat: o.deliveryLatitude, lng: o.deliveryLongitude })
      const its = Array.isArray(o.items) ? o.items : []
      setItems(its.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity ?? 1, price: i.price ?? undefined })))
      const { landmark: lm, note: nt } = splitDescription(o.description, its)
      setLandmark(lm); setNote(nt)
      if (o.proAddressId) setPickupId(o.proAddressId)
      if (o.paymentMode === 'merchant' || o.paymentMode === 'cod') setPayment(o.paymentMode)
      if (categoryOf(o.packageCategory)) setCategory(o.packageCategory)
      setFragile(o.isFragile === true)
      if (o.priority === 'EXPRESS') setPriority('EXPRESS')
    }).catch(() => notify.error('Livraison introuvable', 'Impossible de reprendre cette livraison.'))
  }, [dupId, requestId, notify])

  // Commande au prix figé (serveur récent) : point de retrait et prix imposés
  const locked = !!(request && (request.pickupAddressId || request.pickupAddress || request.deliveryQuote || request.paymentTiming))
  const frozenQuote = locked && request.deliveryQuote?.price != null ? request.deliveryQuote : null
  const lockedPickup = useMemo(() => {
    if (!locked) return null
    const known = (addresses ?? []).find(a => a.id === request.pickupAddressId)
    if (known) return known
    if (request.pickupLatitude == null) return null
    return { id: request.pickupAddressId ?? null, label: 'Point de retrait', address: request.pickupAddress, lat: request.pickupLatitude, lng: request.pickupLongitude }
  }, [locked, request, addresses])

  const pickup = lockedPickup ?? (addresses ?? []).find(a => a.id === pickupId)
  const payer = locked ? 'cod' : payment
  // Prix figé par la commande du client : livraison standard seulement
  const speed = locked || !SHOW_EXPRESS ? 'NORMAL' : priority

  // Prix officiel dès que départ et arrivée sont connus (sauf prix figé).
  // Catégorie et vitesse font partie du devis signé (quoteToken) : chaque
  // changement relance le calcul, le prix affiché reste celui facturé.
  useEffect(() => {
    if (frozenQuote) return
    setEstimateError(null)
    if (!pickup || !drop) { setEstimate(null); return }
    // Adresse de retrait enregistrée sans position : le serveur refuserait
    if (pickup.lat == null || pickup.lng == null) {
      setEstimate(null)
      setEstimateError('Ce point de retrait n\'a pas de position sur la carte. Modifiez-le dans Compte, ou choisissez-en un autre.')
      return
    }
    let alive = true
    setEstimating(true)
    setEstimate(null) // l'ancien prix disparaît tout de suite quand le trajet change
    proApi.get('/orders/estimate', { params: { pickupLat: pickup.lat, pickupLng: pickup.lng, deliveryLat: drop.lat, deliveryLng: drop.lng, orderType: 'DELIVERY', priority: speed, packageCategory: category } })
      .then(r => { if (alive) setEstimate(r.data) })
      .catch((e) => { if (alive) { setEstimate(null); setEstimateError(errMsg(e, 'Le prix n\'a pas pu être calculé.')) } })
      .finally(() => alive && setEstimating(false))
    return () => { alive = false }
  }, [pickup, drop, frozenQuote, estimateTry, category, speed])

  // Réduction : code saisi (s'il est accepté) sinon promotion automatique ou
  // avantage fidélité — même aperçu que l'app ; le serveur refait toujours
  // le calcul à la création. Relu à chaque nouveau prix.
  const promoSeen = useRef('')
  useEffect(() => {
    if (locked || !estimate?.price) { setDiscount(null); return }
    const key = `${estimate.quoteToken ?? estimate.price}|${promoCode ?? ''}`
    if (promoSeen.current === key) return
    promoSeen.current = key
    let alive = true
    let done = false
    proApi.get('/orders/promo/preview', { params: { price: estimate.price, demFee: estimate.demFee ?? 0, ...(promoCode ? { code: promoCode } : {}) } })
      .finally(() => { done = true })
      .then(r => {
        if (!alive) return
        const amount = Math.round(Number(r.data?.discountAmount) || 0)
        setDiscount(amount > 0 ? { amount, label: r.data?.promoCode ?? null, codeNotUsed: !!r.data?.codeNotUsed } : null)
      })
      .catch((e) => {
        if (!alive) return
        setDiscount(null)
        // Le code ne s'applique plus à ce prix (minimum non atteint…)
        if (promoCode) { setPromoCode(null); setPromoError(errMsg(e, 'Ce code ne s\'applique pas à cette livraison.')) }
      })
    // Interrompu avant la réponse : le prochain passage relira l'aperçu
    return () => { alive = false; if (!done) promoSeen.current = '' }
  }, [estimate, promoCode, locked])

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code || !estimate?.price || promoBusy) return
    setPromoBusy(true); setPromoError(null)
    try {
      const r = await proApi.get('/orders/promo/preview', { params: { price: estimate.price, demFee: estimate.demFee ?? 0, code } })
      const amount = Math.round(Number(r.data?.discountAmount) || 0)
      if (amount <= 0) { setPromoError('Ce code ne donne pas de réduction sur cette livraison.'); return }
      promoSeen.current = `${estimate.quoteToken ?? estimate.price}|${code}`
      setPromoCode(code)
      setDiscount({ amount, label: r.data?.promoCode ?? code, codeNotUsed: !!r.data?.codeNotUsed })
      notify.success('Code promo appliqué', r.data?.codeNotUsed ? 'Votre avantage fidélité, plus intéressant, est gardé.' : `${fcfa(amount)} de réduction.`)
    } catch (e) {
      setPromoError(errMsg(e, 'Code promo invalide.'))
    } finally { setPromoBusy(false) }
  }
  const removePromo = () => { setPromoCode(null); setPromoInput(''); setPromoError(null) }

  const quote = frozenQuote
    ? { price: frozenQuote.price, demFee: frozenQuote.demFee ?? 0, totalClient: frozenQuote.total ?? frozenQuote.price + (frozenQuote.demFee ?? 0), distanceKm: frozenQuote.distanceKm }
    : estimate
  const gross = quote ? (quote.totalClient ?? quote.price + quote.demFee) : null
  const discountAmount = !frozenQuote && discount && gross != null ? Math.min(discount.amount, gross) : 0
  const total = gross != null ? gross - discountAmount : null
  const surcharge = !frozenQuote ? Math.round(Number(estimate?.packageSurcharge) || 0) : 0

  // ── Brouillon : enregistré 600 ms après chaque saisie (comme l'app) ──
  useEffect(() => {
    if (!draftReady.current || requestId || dupId) return
    const t = setTimeout(() => {
      if (!drop && !phone.trim() && !name.trim()) return
      draftStore.write({
        pickupId, drop, landmark, name, phone, items, note, payment, category, fragile, priority,
      })
    }, 600)
    return () => clearTimeout(t)
  }, [requestId, dupId, pickupId, drop, landmark, name, phone, items, note, payment, category, fragile, priority])

  const resumeDraft = () => {
    const d = draft
    if (!d) return
    if (d.pickupId) setPickupId(d.pickupId)
    if (d.drop?.lat != null && d.drop?.lng != null) setDrop({ address: d.drop.address ?? 'Point placé sur la carte', lat: d.drop.lat, lng: d.drop.lng })
    setLandmark(String(d.landmark ?? ''))
    setName(String(d.name ?? ''))
    setPhone(String(d.phone ?? ''))
    setItems(Array.isArray(d.items) ? d.items.filter(i => i?.name).slice(0, 10).map(i => ({ productId: i.productId, name: String(i.name), quantity: Math.max(1, Math.min(99, Number(i.quantity) || 1)), price: i.price ?? undefined })) : [])
    setNote(String(d.note ?? ''))
    if (d.payment === 'cod' || d.payment === 'merchant') setPayment(d.payment)
    if (categoryOf(d.category)) setCategory(d.category)
    setFragile(d.fragile === true)
    if (d.priority === 'EXPRESS') setPriority('EXPRESS')
    draftReady.current = true
    setDraft(null)
  }
  const discardDraft = () => { draftStore.clear(); draftReady.current = true; setDraft(null) }

  const phoneDigits = phone.replace(/\D/g, '').replace(/^221(?=\d{9}$)/, '').slice(0, 9)
  const phoneOk = /^7[015678]\d{7}$/.test(phoneDigits)
  const nameOk = name.trim().length >= 2
  const minSchedule = new Date(Date.now() + 15 * 60_000)
  // Heure saisie = heure de Dakar
  const scheduleOk = when === 'now' || (scheduledAt && Date.parse(dakarInputToISO(scheduledAt)) > Date.now() + 15 * 60_000)

  const missing = [
    !pickup && 'le point de retrait',
    !nameOk && 'le nom du client',
    !phoneOk && 'le téléphone du client',
    !drop && 'l\'adresse de livraison',
    !scheduleOk && 'l\'heure de départ',
    !ack && 'la confirmation « aucun objet interdit »',
    pickup && drop && !frozenQuote && !estimating && !estimate && 'le prix (voir ci-dessus)',
  ].filter(Boolean)
  const ready = missing.length === 0 && !!quote && !estimating

  const showErr = (k) => touched[k] || triedSubmit
  const errors = {
    name: showErr('name') && !nameOk ? 'Indiquez le nom du client (2 lettres au moins).' : null,
    phone: showErr('phone') && !phoneOk ? 'Numéro mobile sénégalais : 70, 75, 76, 77 ou 78, puis 7 chiffres.' : null,
    drop: triedSubmit && !drop ? 'Choisissez l\'adresse, ou cliquez sur la carte.' : null,
    schedule: (showErr('schedule') || scheduledAt) && when === 'later' && !scheduleOk ? 'Choisissez une heure au moins 15 minutes plus tard.' : null,
    ack: triedSubmit && !ack ? 'Confirmez que le colis ne contient aucun objet interdit.' : null,
  }

  const submit = async () => {
    setTriedSubmit(true)
    if (!ready || submitting) return
    // Prix garanti 10 min : passé ce délai, nouveau calcul AVANT l'envoi,
    // pour que le commerçant voie le prix réellement facturé (comme l'app)
    if (!frozenQuote && estimate?.quoteExpiresAt && Date.parse(estimate.quoteExpiresAt) < Date.now() + 30_000) {
      setEstimateTry(n => n + 1)
      notify.info('Prix recalculé', 'Le prix affiché datait de plus de 10 minutes. Vérifiez-le, puis relancez.')
      return
    }
    setSubmitting(true)
    const parts = []
    if (items.length) parts.push(items.map(i => `${i.name} ×${i.quantity}`).join(', '))
    if (note.trim()) parts.push(note.trim())
    if (landmark.trim()) parts.push(`Repère : ${landmark.trim()}`)
    try {
      const res = await proApi.post('/orders', {
        orderType: 'DELIVERY',
        priority: speed,
        // Catégorie et Fragile à part (comme l'app) ; confirmation exigée
        // par le serveur dès qu'une catégorie est envoyée
        packageCategory: category,
        isFragile: fragile,
        prohibitedItemsAck: ack,
        pickupAddress: pickup.address,
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        deliveryAddress: drop.address,
        deliveryLatitude: drop.lat,
        deliveryLongitude: drop.lng,
        receiverName: name.trim(),
        receiverPhone: `+221${phoneDigits}`,
        ...(parts.length ? { description: parts.join(' · ') } : {}),
        price: quote.price,
        demFee: quote.demFee,
        // Prix garanti : le devis signé affiché (10 min) prime sur un recalcul
        ...(!frozenQuote && estimate?.quoteToken ? { quoteToken: estimate.quoteToken } : {}),
        ...(when === 'later' ? { scheduledAt: dakarInputToISO(scheduledAt) } : {}),
        paymentMode: payer,
        ...(pickup.id ? { proAddressId: pickup.id } : {}),
        ...(request ? { orderRequestId: request.id } : {}),
        // Code saisi et accepté seulement (une promotion automatique est
        // retrouvée par le serveur lui-même)
        ...(!locked && promoCode ? { promoCode } : {}),
        ...(items.length ? { items: items.map(i => ({ name: i.name, quantity: i.quantity, ...(i.price ? { price: i.price } : {}), ...(i.productId ? { productId: i.productId } : {}) })) } : {}),
      })
      const order = res.data.order ?? res.data
      // Ancien parcours : le serveur relie déjà la demande via orderRequestId ;
      // la confirmation explicite reste pour les serveurs qui ne le font pas.
      if (request) await proApi.post(`/dem-pro/order-requests/${request.id}/confirm`, { orderId: order.id }).catch(() => {})
      if (!request && !dupId) draftStore.clear()
      notify.success(when === 'later' ? 'Livraison programmée' : 'Livraison lancée', when === 'later' ? 'Elle partira à l\'heure choisie.' : 'Nous cherchons un coursier proche. Vous serez prévenu en direct.')
      window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
      navigate(`/livraisons?id=${order.id}`)
    } catch (e) {
      const code = e?.response?.data?.code
      if (code === 'DEM_PRO_PLAN_REQUIRED') notify.error('Offre requise', `${errMsg(e)} Choisissez une offre dans Compte.`)
      else notify.error('Livraison non créée', LOCK_ERRORS[code] ?? errMsg(e))

    } finally { setSubmitting(false) }
  }

  const title = request ? 'Livrer la commande' : dupFrom ? 'Dupliquer la livraison' : 'Nouvelle livraison'
  const description = request
    ? `Commande de ${request.customerName || 'votre client'}, pré-remplie. Vérifiez puis lancez la livraison.`
    : dupFrom
      ? `Reprise de la livraison pour ${dupFrom.receiverName || 'votre client'}. Modifiez ce qui change, puis lancez-la.`
      : 'Un coursier DEM récupère le colis à votre point de retrait et le livre à votre client.'
  const submitLabel = `${when === 'later' ? 'Programmer la livraison' : 'Lancer la livraison'}${total != null ? ` · ${fcfa(total)}` : ''}`
  const paidOnline = request && (request.paidAt || request.paymentTiming === 'NOW')

  return (
    <div className="nd">
      <PageHeader
        eyebrow={request ? 'Commande reçue' : 'Livraisons'}
        title={<>{title}<span className="dot">.</span></>}
        description={description}
        actions={<Button variant="ghost" to={request ? '/commandes' : '/livraisons'}>{!request && !dupFrom && (drop || phone.trim() || name.trim()) ? 'Fermer' : 'Annuler'}</Button>}
      />

      {draft && (
        <div className="dv-draft" role="region" aria-label="Brouillon enregistré">
          <FileClock size={18} aria-hidden />
          <div className="dv-draft-txt">
            <strong>Reprendre votre brouillon ?</strong>
            <span className="muted">
              {[draft.name, draft.drop?.address].filter(Boolean).join(' · ') || 'Livraison commencée'}
              {draft.savedAt ? ` · enregistré ${timeAgo(draft.savedAt)}` : ''}
            </span>
          </div>
          <div className="dv-draft-actions">
            <Button variant="ghost" size="sm" icon={Trash2} onClick={discardDraft}>Effacer</Button>
            <Button size="sm" onClick={resumeDraft}>Reprendre</Button>
          </div>
        </div>
      )}

      {locked && (
        <div className="nd-banner has-corners" role="status">
          <Corners />
          <BadgeCheck size={18} aria-hidden />
          <div>
            <strong>{paidOnline ? 'Payée en ligne par votre client' : 'Paiement à l\'arrivée du coursier'}</strong>
            <span className="muted">
              {paidOnline
                ? 'Articles et livraison sont réglés. Le coursier ne demandera rien à votre client.'
                : 'Votre client paie le coursier à la livraison, en ligne ou en espèces.'}
            </span>
          </div>
        </div>
      )}

      <div className="nd-grid">
        <div className="card nd-form">
          {/* 1. Retrait */}
          <Section title="Point de retrait" hint={locked ? 'Fixé à la commande de votre client' : 'Où le coursier récupère le colis'}>
            {locked && lockedPickup ? (
              <div className="nd-pick is-on is-locked has-corners">
                <Corners />
                <Lock size={16} aria-hidden />
                <span className="nd-pick-txt"><b>{lockedPickup.label}</b><span>{lockedPickup.address}</span></span>
                <span className="nd-lock-note">Point de retrait fixé à la commande du client</span>
              </div>
            ) : !addresses ? <Skeleton h={64} /> : addresses.length === 0 ? (
              <p className="muted nd-help">Ajoutez une adresse de retrait dans <a className="link" href="#" onClick={(e) => { e.preventDefault(); navigate('/compte') }}>Compte</a> pour lancer une livraison.</p>
            ) : (
              <div className="nd-picks" role="radiogroup" aria-label="Point de retrait">
                {addresses.map(a => {
                  const on = a.id === pickup?.id
                  return (
                    <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setPickupId(a.id)}
                      className={`nd-pick ${on ? 'is-on has-corners' : ''}`}>
                      {on && <Corners />}
                      <span className="nd-radio" aria-hidden />
                      <span className="nd-pick-txt"><b>{a.label}{a.isDefault && <em>Par défaut</em>}</b><span>{a.address}</span></span>
                    </button>
                  )
                })}
              </div>
            )}
          </Section>

          {/* 2. Client */}
          <Section title="Votre client" hint="Le coursier l'appelle à l'arrivée">
            <div className="nd-cols">
              <Field label="Nom" error={errors.name}>
                {(p) => <input {...p} className="input" value={name} autoComplete="off" onChange={e => setName(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, name: true }))} placeholder="Ex. Fatou Sow" />}
              </Field>
              <Field label="Téléphone" error={errors.phone}>
                {(p) => (
                  <div className="nd-phone">
                    <span className="nd-prefix">+221</span>
                    <input {...p} className="input" inputMode="numeric" autoComplete="off" value={fmtPhone(phoneDigits)}
                      onChange={e => setPhone(e.target.value)} onBlur={() => setTouched(t => ({ ...t, phone: true }))} placeholder="77 123 45 67" />
                    {phoneOk && <Check size={16} className="nd-ok" aria-hidden />}
                  </div>
                )}
              </Field>
            </div>
            {recent.length > 0 && !request && (
              <div className="nd-chips-block">
                <span className="label-caps nd-sub"><History size={13} aria-hidden /> Clients récents</span>
                <div className="nd-chips">
                  {recent.slice(0, 6).map(r => {
                    const on = !!r.receiverPhone && phoneDigits && r.receiverPhone.endsWith(phoneDigits) && drop?.address === r.address
                    return (
                      <Chip key={`${r.receiverPhone}-${r.address}`} selected={on} title={`${r.receiverName ?? ''} · ${phoneFmt(r.receiverPhone)} · ${r.address}`}
                        onClick={() => {
                          if (r.receiverName) setName(r.receiverName)
                          if (r.receiverPhone) setPhone(r.receiverPhone.replace(/^\+221/, ''))
                          if (r.lat != null) setDrop({ address: r.address, lat: r.lat, lng: r.lng })
                        }}>{r.receiverName ?? r.address}</Chip>
                    )
                  })}
                </div>
              </div>
            )}
          </Section>

          {/* 3. Adresse */}
          <Section title="Adresse de livraison" hint={frozenQuote ? 'Adresse donnée par votre client · le prix en dépend' : 'Cherchez un quartier, une rue ou un lieu connu, ou cliquez sur la carte'}>
            <PlaceSearch value={drop} onPick={setDrop} onClear={() => setDrop(null)} error={errors.drop} readOnly={!!frozenQuote && !!drop} />
            <div style={{ marginTop: 16 }}>
              <Field label="Repère (conseillé)">
                {(p) => <input {...p} className="input" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Ex. face pharmacie, 2e étage, portail bleu" />}
              </Field>
            </div>
          </Section>

          {/* 4. Colis */}
          <Section title="Colis" hint="Type, articles et consignes · affichés au coursier et sur le reçu">
            <span className="nd-label dv-label">Type de colis</span>
            <div className="dv-cats" role="radiogroup" aria-label="Type de colis">
              {PACKAGE_CATEGORIES.map(c => {
                const on = category === c.key
                const extra = surcharges[c.key] ?? 0
                const Icon = c.icon
                return (
                  <button key={c.key} type="button" role="radio" aria-checked={on}
                    className={`dv-cat ${on ? 'is-on' : ''}`} onClick={() => setCategory(c.key)}>
                    <span className="dv-cat-ico" aria-hidden><Icon size={18} /></span>
                    <span className="dv-cat-txt">
                      <b>{c.label}</b>
                      <span>{c.hint}</span>
                    </span>
                    {extra > 0 && !frozenQuote && <span className="dv-cat-extra num">+{fcfa(extra)}</span>}
                  </button>
                )
              })}
            </div>

            <div className="dv-checks">
              <label className={`dv-check ${fragile ? 'is-on' : ''}`}>
                <input type="checkbox" checked={fragile} onChange={e => setFragile(e.target.checked)} />
                <span className="dv-box" aria-hidden />
                <Wine size={16} className="dv-check-ico" aria-hidden />
                <span className="dv-check-txt"><b>Fragile</b><span>Le coursier est prévenu d'en prendre soin.</span></span>
              </label>
              <div className={`dv-check dv-ack ${ack ? 'is-on' : ''} ${errors.ack ? 'is-err' : ''}`}>
                <label className="dv-ack-main">
                  <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)}
                    aria-invalid={errors.ack ? true : undefined} aria-describedby={errors.ack ? 'dv-ack-err' : undefined} />
                  <span className="dv-box" aria-hidden />
                  <ShieldCheck size={16} className="dv-check-ico" aria-hidden />
                  <span className="dv-check-txt"><b>Aucun objet interdit dans le colis</b><span>Obligatoire pour lancer la livraison.</span></span>
                </label>
                <button type="button" className="link dv-list-btn" onClick={() => setListOpen(true)}>Voir la liste</button>
              </div>
              {errors.ack && <span id="dv-ack-err" className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> {errors.ack}</span>}
            </div>

            {(products.length > 0 || items.length > 0) && (
              <span className="nd-label dv-label" style={{ marginTop: 22 }}>Articles <span className="muted dv-opt">facultatif</span></span>
            )}
            {products.length > 0 && (
              <div className="nd-chips" style={{ marginBottom: items.length ? 12 : 16 }}>
                {products.slice(0, 16).map(p => {
                  const it = items.find(i => i.productId === p.id)
                  return (
                    <Chip key={p.id} selected={!!it} icon={it ? Check : Plus}
                      onClick={() => setItems(list => it ? list.filter(i => i.productId !== p.id) : [...list, { productId: p.id, name: p.name, quantity: 1, price: p.defaultPrice ?? undefined }])}>
                      {p.name}
                    </Chip>
                  )
                })}
              </div>
            )}
            {items.length > 0 && (
              <ul className="nd-items">
                {items.map(it => (
                  <li key={it.productId ?? it.name}>
                    <span className="nd-item-name">{it.name}</span>
                    {it.price ? <span className="muted num">{fcfa(it.price)}</span> : null}
                    <Qty value={it.quantity} name={it.name} onChange={(q) => setItems(list => list.map(x => x === it ? { ...x, quantity: q } : x))} />
                    <button type="button" className="nd-x" aria-label={`Retirer ${it.name}`} onClick={() => setItems(list => list.filter(x => x !== it))}><X size={14} aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
            <div style={products.length || items.length ? undefined : { marginTop: 22 }}>
              <Field label="Description et consignes">
                {(p) => <input {...p} className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex. 1 sac, à remettre en main propre" />}
              </Field>
            </div>
          </Section>

          {/* 5. Paiement et horaire */}
          <Section title="Paiement et horaire" last>
            {SHOW_EXPRESS && <div className="nd-group dv-speed">
              <span className="label-caps nd-sub">Type de livraison</span>
              <Segmented full label="Type de livraison" value={speed} onChange={setPriority} disabled={locked}
                options={[['NORMAL', 'Standard', Bike], ['EXPRESS', 'Express', Gauge]]} />
              <p className="muted nd-help">{locked
                ? 'Livraison standard : c\'est le prix accepté par votre client.'
                : speed === 'EXPRESS'
                  ? 'Le coursier le plus proche part en priorité. Le prix est plus élevé.'
                  : 'Le meilleur prix, avec un coursier disponible près de vous.'}</p>
            </div>}
            <div className="nd-cols">
              <div className="nd-group">
                <span className="label-caps nd-sub">Qui paie la livraison ?</span>
                <Segmented full label="Qui paie la livraison" value={payer} onChange={setPayment} disabled={locked}
                  options={[['cod', 'Le client', Users], ['merchant', 'Ma boutique', Store]]} />
                <p className="muted nd-help">{locked
                  ? 'Imposé : votre client a accepté ce prix à la commande.'
                  : payer === 'cod' ? 'Votre client règle la livraison au coursier, en ligne ou en espèces.' : 'Vous réglez la livraison en ligne depuis le suivi. Rien n\'est demandé à votre client.'}</p>
              </div>
              <div className="nd-group">
                <span className="label-caps nd-sub">Quand ?</span>
                <Segmented full label="Quand" value={when} onChange={setWhen}
                  options={[['now', 'Maintenant', Zap], ['later', 'Programmer', CalendarClock]]} />
                {when === 'later' ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Date et heure de retrait" error={errors.schedule}>
                      {(p) => <input {...p} type="datetime-local" className="input" value={scheduledAt}
                        min={isoToDakarInput(minSchedule)}
                        onChange={e => setScheduledAt(e.target.value)} onBlur={() => setTouched(t => ({ ...t, schedule: true }))} />}
                    </Field>
                  </div>
                ) : <p className="muted nd-help">Un coursier proche part tout de suite.</p>}
              </div>
            </div>
          </Section>
        </div>

        {/* Résumé collant */}
        <aside className="nd-summary" aria-label="Résumé de la livraison">
          <div className="card nd-sum-card">
            <div className="nd-map">
              <PickMap pickup={pickup} drop={drop} onPick={frozenQuote && drop ? null : setDrop} />
            </div>
            <div className="nd-sum-body">
              <dl className="nd-rows">
                <div><dt>Retrait</dt><dd>{pickup?.label ?? <span className="muted">À choisir</span>}</dd></div>
                <div><dt>Livraison</dt><dd>{drop?.address ?? <span className="muted">À choisir</span>}</dd></div>
                <div><dt>Départ</dt><dd>{when === 'now' ? 'Dès maintenant' : scheduledAt ? new Date(dakarInputToISO(scheduledAt)).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : <span className="muted">À programmer</span>}</dd></div>
                <div><dt>Colis</dt><dd>{[categoryOf(category)?.label, fragile && 'Fragile', speed === 'EXPRESS' && 'Express'].filter(Boolean).join(' · ')}</dd></div>
              </dl>
              <div className="nd-price" aria-live="polite">
                {estimating && !frozenQuote ? <Skeleton h={64} /> : quote ? (
                  <>
                    {frozenQuote && <span className="nd-frozen"><Lock size={12} aria-hidden /> Prix accepté par le client</span>}
                    <div className="nd-line"><span>Livraison{quote.distanceKm != null ? ` · ${String(quote.distanceKm).replace('.', ',')} km` : ''}</span><span className="num">{fcfa(quote.price)}</span></div>
                    {surcharge > 0 && <div className="nd-line dv-subline"><span>dont supplément {categoryOf(category)?.label.toLowerCase()}</span><span className="num">{fcfa(surcharge)}</span></div>}
                    {quote.demFee > 0 && <div className="nd-line"><span>Frais de service</span><span className="num">{fcfa(quote.demFee)}</span></div>}
                    {discountAmount > 0 && (
                      <div className="nd-line dv-discount">
                        <span><Tag size={12} aria-hidden /> {discount.label ? `Réduction · ${discount.label}` : 'Réduction'}</span>
                        <span className="num">− {fcfa(discountAmount)}</span>
                      </div>
                    )}
                    <div className="nd-total"><span>Total</span><span className="num">{fcfa(total)}</span></div>
                    <p className="muted nd-help">{payer === 'cod' ? (paidOnline ? 'Déjà réglé par votre client.' : 'Payé par votre client à la livraison.') : 'Payé par votre boutique, en ligne depuis le suivi.'}</p>
                  </>
                ) : estimateError ? (
                  <div role="alert" style={{ display: 'grid', gap: 8 }}>
                    <p className="nd-help" style={{ margin: 0, color: 'var(--p-danger)', fontWeight: 600 }}><AlertCircle size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {estimateError}</p>
                    {pickup?.lat != null && <Button variant="ghost" size="sm" onClick={() => setEstimateTry(n => n + 1)}>Réessayer le calcul</Button>}
                  </div>
                ) : (
                  <p className="muted nd-help" style={{ margin: 0 }}><Clock size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {!pickup ? 'Le prix s\'affiche dès que le point de retrait et l\'adresse de livraison sont choisis.' : 'Le prix s\'affiche dès que l\'adresse de livraison est choisie.'}</p>
                )}
              </div>
              {!locked && (
                <PromoBox open={promoOpen || !!promoCode} onOpen={() => setPromoOpen(true)}
                  value={promoInput} onChange={(v) => { setPromoInput(v); setPromoError(null) }}
                  applied={promoCode} discount={discount} error={promoError} busy={promoBusy}
                  canApply={!!estimate?.price && !estimating} onApply={applyPromo} onRemove={removePromo} />
              )}
              <Button size="lg" arrow="right" loading={submitting} disabled={submitting || (triedSubmit && !ready)} onClick={submit} className="nd-submit">
                {submitLabel}
              </Button>
              {missing.length > 0 && (
                <div className="nd-missing">
                  <span className="label-caps">À compléter</span>
                  <ul>{missing.map(m => <li key={m}><AlertCircle size={13} aria-hidden /> {m.charAt(0).toUpperCase() + m.slice(1)}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile : total + bouton toujours à portée */}
      <div className="nd-mbar">
        <div className="nd-mbar-total">
          <span className="label-caps">Total</span>
          <span className="num">{total != null ? fcfa(total) : '—'}</span>
        </div>
        <Button arrow="right" loading={submitting} disabled={submitting || (triedSubmit && !ready)} onClick={submit}>
          {when === 'later' ? 'Programmer' : 'Lancer'}
        </Button>
      </div>

      <Modal open={listOpen} onClose={() => setListOpen(false)} title="Ce que DEM ne transporte pas" width={480}
        subtitle="Un colis qui en contient peut être refusé par le coursier, sans remboursement."
        footer={<>
          <Button variant="ghost" onClick={() => setListOpen(false)}>Fermer</Button>
          {!ack && <Button onClick={() => { setAck(true); setListOpen(false) }}>Mon colis n'en contient pas</Button>}
        </>}>
        <ul className="dv-banned">
          {PROHIBITED_ITEMS.map(t => <li key={t}><Ban size={15} aria-hidden /> {t}</li>)}
        </ul>
      </Modal>
    </div>
  )
}

// Code promo : replié par défaut (comme le champ « Code promo (optionnel) »
// de l'app), vérifié par le serveur sur le prix affiché
function PromoBox({ open, onOpen, value, onChange, applied, discount, error, busy, canApply, onApply, onRemove }) {
  const id = useId()
  if (!open) {
    return (
      <button type="button" className="link dv-promo-open" onClick={onOpen}>
        <Tag size={14} aria-hidden /> J'ai un code promo
      </button>
    )
  }
  if (applied) {
    return (
      <div className="dv-promo is-applied" role="status">
        <Tag size={15} aria-hidden />
        <span className="dv-promo-txt">
          <b>Code {applied}</b>
          <span className="muted">{discount?.codeNotUsed ? 'Votre avantage fidélité, plus intéressant, est appliqué à la place.' : discount ? `${fcfa(discount.amount)} de réduction` : 'Vérification…'}</span>
        </span>
        <button type="button" className="nd-x" aria-label="Retirer le code promo" onClick={onRemove}><X size={14} aria-hidden /></button>
      </div>
    )
  }
  return (
    <div className="dv-promo">
      <label htmlFor={id} className="sr-only">Code promo</label>
      <div className="dv-promo-row">
        <input id={id} className="input" value={value} maxLength={40} autoComplete="off" spellCheck={false}
          placeholder="Code promo" onChange={e => onChange(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onApply() } }}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
        <Button variant="ghost" size="sm" loading={busy} disabled={!value.trim() || !canApply} onClick={onApply}>Appliquer</Button>
      </div>
      {error && <span id={`${id}-err`} className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> {error}</span>}
      {!canApply && !error && <span className="muted nd-help" style={{ marginTop: 0 }}>Le code se vérifie une fois le prix affiché.</span>}
    </div>
  )
}

function Section({ title, hint, children, last }) {
  return (
    <section className={`nd-sec ${last ? 'is-last' : ''}`}>
      <header className="nd-sec-head">
        <h2 className="section-title">{title}</h2>
        {hint && <p className="muted">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

// Champ avec libellé et erreur sous le champ (aria-invalid / aria-describedby)
function Field({ label, error, children }) {
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

function Qty({ value, onChange, name }) {
  return (
    <div className="nd-qty" role="group" aria-label={`Quantité ${name}`}>
      <button type="button" aria-label="Retirer un" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}><Minus size={13} aria-hidden /></button>
      <span className="num" aria-live="polite">{value}</span>
      <button type="button" aria-label="Ajouter un" onClick={() => onChange(Math.min(99, value + 1))}><Plus size={13} aria-hidden /></button>
    </div>
  )
}

// Recherche d'adresse (Google via le serveur DEM, comme dans l'app)
export function PlaceSearch({ value, onPick, onClear, error, readOnly }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const token = useRef(newToken())
  const inputId = useId()
  useEffect(() => {
    const input = q.trim()
    if (input.length < 3) return
    let alive = true
    const t = setTimeout(() => {
      setLoading(true)
      proApi.get('/public/places/autocomplete', { params: { input, sessionToken: token.current } })
        .then(r => alive && setResults(r.data.predictions ?? [])).catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false))
    }, 280)
    return () => { alive = false; clearTimeout(t) }
  }, [q])
  const pick = async (p) => {
    setOpen(false)
    try {
      const r = await proApi.get('/public/places/details', { params: { placeId: p.place_id, sessionToken: token.current } })
      token.current = newToken()
      if (r.data.lat != null) { onPick({ address: r.data.address ?? p.description, lat: r.data.lat, lng: r.data.lng }); setQ(''); setResults([]) }
    } catch { /* adresse introuvable */ }
  }
  const shown = q.trim().length >= 3 ? results : []
  return (
    <div className="nd-place">
      {value && (
        <div className="nd-picked">
          <MapPin size={16} aria-hidden />
          <span>{value.address}</span>
          {readOnly ? <Lock size={14} className="nd-lock" aria-label="Adresse fixée" /> : onClear && <button type="button" className="nd-x" aria-label="Changer d'adresse" onClick={onClear}><X size={14} aria-hidden /></button>}
        </div>
      )}
      {!readOnly && <>
      <label htmlFor={inputId} className="sr-only">Adresse de livraison</label>
      <div className="nd-search">
        <Search size={16} aria-hidden />
        <input id={inputId} className="input" value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { setQ(e.target.value); setOpen(true) }} aria-invalid={error ? true : undefined}
          placeholder={value ? 'Changer d\'adresse…' : 'Quartier, rue, lieu connu…'} autoComplete="off" />
        {loading && <span className="nd-spin"><Spinner size={16} /></span>}
      </div>
      {error && <span className="nd-err" role="alert"><AlertCircle size={13} aria-hidden /> {error}</span>}
      {open && shown.length > 0 && (
        <div className="nd-results" role="listbox">
          {shown.slice(0, 6).map(p => (
            <button key={p.place_id} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
              <MapPin size={15} aria-hidden />
              <span><b>{p.structured_formatting?.main_text ?? p.description}</b><small>{p.structured_formatting?.secondary_text ?? ''}</small></span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 3 && !loading && shown.length === 0 && (
        <p className="muted nd-help">Aucun résultat : cliquez sur la carte pour placer le point de livraison.</p>
      )}
      </>}
    </div>
  )
}

// Carte : départ, arrivée ; un clic place l'arrivée (adresse retrouvée)
const pinIcon = (bg, label) => L.divIcon({
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);display:grid;place-items:center;color:#fff;font:700 11px 'DM Sans',sans-serif">${label}</div>`,
})

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

// Recadre la carte quand un point change (clé texte : pas de nouvel objet à chaque rendu)
function FitTo({ points }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    const v = JSON.parse(key).filter(Boolean)
    // La taille du conteneur peut changer après le premier rendu (mise en page)
    map.invalidateSize()
    if (v.length === 2) map.fitBounds(L.latLngBounds(v).pad(0.35), { animate: false })
    else if (v.length === 1) map.setView(v[0], 14, { animate: false })
  }, [map, key])
  return null
}

function PickMap({ pickup, drop, onPick }) {
  const a = pickup ? [pickup.lat, pickup.lng] : null
  const b = drop ? [drop.lat, drop.lng] : null
  return (
    <MapContainer center={a ?? [14.7167, -17.4677]} zoom={13} style={{ height: '100%', width: '100%', cursor: onPick ? 'crosshair' : 'grab' }} zoomControl={false} attributionControl={false}>
      <MapBaseLayer />
      {onPick && <ClickToPick onPick={onPick} />}
      {a && b && <Polyline positions={[a, b]} pathOptions={{ color: '#021520', weight: 2, dashArray: '6 6' }} />}
      {a && <Marker position={a} icon={pinIcon('#021520', 'A')} />}
      {b && <Marker position={b} icon={pinIcon('#0086C8', 'B')} />}
      <FitTo points={[a, b]} />
      {onPick && <div className="nd-map-hint"><MousePointerClick size={13} aria-hidden /> Cliquez sur la carte pour placer le point de livraison</div>}
    </MapContainer>
  )
}
