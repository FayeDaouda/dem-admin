import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, ArrowUp, ArrowDown, Trash2, Check, History, AlertCircle, Zap, CalendarClock, Route, Sparkles,
  Info, CircleCheck, Bike, Store,
} from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { fcfa, phoneFmt, dakarInputToISO, isoToDakarInput, dateTime, TZ } from '../lib/format'
import { Button, Chip, Corners, PageHeader, Segmented, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import AddressSearch from '../ui/AddressSearch'
import { BatchMap } from '../ui/batchKit'
import { MAX_STOPS, MIN_STOPS, PKG_TYPES, batchTotal, sortedStops, stopTotal } from '../ui/batch'
import '../styles/batch.css'

// Nouvelle tournée groupée : un point de retrait, 2 à 5 destinataires, un
// seul coursier. Même création que l'app (POST /dem-pro/batch, voir
// dem_pro_batch_create_screen.dart). Le prix est calculé par le serveur à
// la création, arrêt par arrêt (distance depuis le retrait) : il s'affiche
// sur l'écran de confirmation. ?dupliquer=ID : reprise d'une tournée.

let uid = 0
const newStop = () => ({ key: `s${++uid}`, address: '', lat: null, lng: null, name: '', phone: '', landmark: '', pkg: 'small', fragile: false, detail: '' })
const digitsOf = (p) => String(p ?? '').replace(/\D/g, '').replace(/^221(?=\d{9}$)/, '').slice(0, 9)
const fmtPhone = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))
const phoneValid = (p) => /^7[015678]\d{7}$/.test(digitsOf(p))
const located = (s) => s.lat != null && s.lng != null
const km = (n) => `${String(n).replace('.', ',')} km`

// Description écrite à la création : « Petit colis · Fragile · précision »
// (le serveur y ajoute « Repère: … ») — relue pour « Recommander »
function parseDescription(desc) {
  const out = { pkg: 'small', fragile: false, landmark: '', detail: '' }
  const rest = []
  for (const part of String(desc ?? '').split(' · ').map(x => x.trim()).filter(Boolean)) {
    const lm = part.match(/^Repère\s*:\s*(.*)$/)
    const pkg = PKG_TYPES.find(([, label]) => label === part)
    if (lm) out.landmark = lm[1]
    else if (pkg) out.pkg = pkg[0]
    else if (part === 'Fragile') out.fragile = true
    else rest.push(part)
  }
  out.detail = rest.join(' · ')
  return out
}

export default function NewBatch() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [params] = useSearchParams()
  const dupId = params.get('dupliquer')
  const [addresses, setAddresses] = useState(null)
  const [recent, setRecent] = useState([])
  const [pickupId, setPickupId] = useState(null)
  const [stops, setStops] = useState(() => [newStop(), newStop()])
  const [active, setActive] = useState(0) // arrêt placé par un clic sur la carte
  const [notes, setNotes] = useState('')
  const [when, setWhen] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [touched, setTouched] = useState({})
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [planBlocked, setPlanBlocked] = useState(null)
  const [dupFrom, setDupFrom] = useState(null)
  const [created, setCreated] = useState(null)
  const [suggest, setSuggest] = useState(null) // ordre conseillé (route-order)

  useEffect(() => {
    proApi.get('/dem-pro/addresses').then(r => {
      setAddresses(r.data ?? [])
      setPickupId(id => id ?? (r.data ?? []).find(a => a.isDefault)?.id ?? r.data?.[0]?.id ?? null)
    }).catch(() => setAddresses([]))
    proApi.get('/dem-pro/me/recent-destinations').then(r => setRecent(r.data ?? [])).catch(() => {})
  }, [])

  // Recommander : mêmes destinataires, nouvel horaire « maintenant »
  useEffect(() => {
    if (!dupId) return
    proApi.get(`/dem-pro/batch/${dupId}`).then(r => {
      const b = r.data
      const orders = sortedStops(b).slice(0, MAX_STOPS)
      if (orders.length < MIN_STOPS) return
      setDupFrom(b)
      setStops(orders.map(o => ({
        ...newStop(),
        address: o.deliveryAddress ?? '',
        lat: o.deliveryLatitude ?? null,
        lng: o.deliveryLongitude ?? null,
        name: o.receiverName ?? '',
        phone: digitsOf(o.receiverPhone),
        ...parseDescription(o.description),
      })))
      if (b.notes) setNotes(b.notes)
    }).catch(() => notify.error('Tournée introuvable', 'Impossible de reprendre cette tournée.'))
  }, [dupId, notify])

  // Recommander : même point de retrait si c'est une adresse enregistrée
  useEffect(() => {
    if (!dupFrom || !addresses?.length) return
    const same = addresses.find(a => a.lat != null && Math.abs(a.lat - dupFrom.pickupLatitude) < 1e-5 && Math.abs(a.lng - dupFrom.pickupLongitude) < 1e-5)
    if (same) setPickupId(same.id)
  }, [dupFrom, addresses])

  const pickup = (addresses ?? []).find(a => a.id === pickupId)
  const pickupOk = !!pickup && pickup.lat != null && pickup.lng != null

  const patch = (i, p) => setStops(list => list.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const move = (i, dir) => setStops(list => {
    const j = i + dir
    if (j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const remove = (i) => { setStops(list => list.filter((_, j) => j !== i)); setActive(a => (a === i ? Math.max(0, i - 1) : a > i ? a - 1 : a)) }
  const add = () => { if (stops.length < MAX_STOPS) { setStops(list => [...list, newStop()]); setActive(stops.length) } }

  // ── Ordre conseillé (le prix ne dépend pas de l'ordre) ────────────────────
  const allLocated = stops.length >= MIN_STOPS && stops.every(located)
  const routeKey = pickupOk && allLocated ? JSON.stringify([[pickup.lat, pickup.lng], ...stops.map(s => [s.lat, s.lng])]) : ''
  useEffect(() => {
    if (!routeKey) { setSuggest(null); return }
    let alive = true
    const [[plat, plng], ...pts] = JSON.parse(routeKey)
    const t = setTimeout(() => {
      proApi.post('/orders/batch/route-order', {
        pickupLatitude: plat, pickupLongitude: plng,
        stops: pts.map(([lat, lng]) => ({ deliveryLatitude: lat, deliveryLongitude: lng })),
      }).then(r => { if (alive) setSuggest({ key: routeKey, ...r.data }) })
        .catch(() => { if (alive) setSuggest(null) }) // un plus, jamais un blocage
    }, 700)
    return () => { alive = false; clearTimeout(t) }
  }, [routeKey])
  const route = suggest?.key === routeKey ? suggest : null
  const applyOrder = () => {
    if (!route?.improved || !Array.isArray(route.order)) return
    setStops(list => route.order.map(i => list[i]).filter(Boolean))
    notify.success('Ordre conseillé appliqué', `Trajet plus court de ${km(route.savingKm)}${route.savingMin ? ` · environ ${route.savingMin} min gagnées` : ''}.`)
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const minSchedule = new Date(Date.now() + 15 * 60_000)
  const scheduleOk = when === 'now' || (scheduledAt && Date.parse(dakarInputToISO(scheduledAt)) > Date.now() + 15 * 60_000)
  const missing = [
    !pickup && 'le point de retrait',
    pickup && !pickupOk && 'un point de retrait placé sur la carte',
    ...stops.flatMap((s, i) => [
      !located(s) && `l'adresse de l'arrêt ${i + 1}`,
      !phoneValid(s.phone) && `le téléphone de l'arrêt ${i + 1}`,
    ]),
    !scheduleOk && 'l\'heure de départ',
  ].filter(Boolean)
  const ready = missing.length === 0

  const submit = async () => {
    setTriedSubmit(true)
    if (!ready || submitting) return
    setSubmitting(true)
    setPlanBlocked(null)
    try {
      const res = await proApi.post('/dem-pro/batch', {
        pickupAddress: pickup.address?.trim().length >= 3 ? pickup.address : `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`,
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        ...(notes.trim() ? { notes: notes.trim().slice(0, 500) } : {}),
        ...(when === 'later' ? { scheduledAt: dakarInputToISO(scheduledAt) } : {}),
        stops: stops.map(s => {
          const desc = [PKG_TYPES.find(([k]) => k === s.pkg)?.[1], s.fragile && 'Fragile', s.detail.trim()].filter(Boolean).join(' · ')
          return {
            deliveryAddress: s.address?.trim().length >= 3 ? s.address.trim().slice(0, 300) : 'Point placé sur la carte',
            deliveryLatitude: s.lat,
            deliveryLongitude: s.lng,
            ...(s.name.trim() ? { receiverName: s.name.trim().slice(0, 100) } : {}),
            receiverPhone: `+221${digitsOf(s.phone)}`,
            ...(s.landmark.trim() ? { landmark: s.landmark.trim().slice(0, 200) } : {}),
            ...(desc ? { description: desc.slice(0, 500) } : {}),
          }
        }),
      })
      setCreated(res.data)
      notify.success(res.data?.scheduledAt ? 'Tournée programmée' : 'Tournée lancée',
        res.data?.scheduledAt ? 'Elle partira à l\'heure choisie.' : 'Nous cherchons un coursier proche. Vous serez prévenu en direct.')
      window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
      window.scrollTo({ top: 0 })
    } catch (e) {
      if (e?.response?.data?.code === 'DEM_PRO_PLAN_REQUIRED') {
        setPlanBlocked(errMsg(e))
        notify.error('Offre requise', `${errMsg(e)} Choisissez une offre dans Compte.`)
      } else notify.error('Tournée non créée', errMsg(e))
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setCreated(null); setStops([newStop(), newStop()]); setNotes(''); setWhen('now'); setScheduledAt('')
    setTouched({}); setTriedSubmit(false); setActive(0); setDupFrom(null)
    if (dupId) navigate('/tournees/nouvelle', { replace: true })
  }

  if (created) return <Created batch={created} onNew={reset} onTrack={() => navigate(`/tournees?id=${created.id}`)} />

  const placed = stops.filter(located).length
  const departLabel = when === 'now' ? 'Dès maintenant'
    : scheduledAt ? new Date(dakarInputToISO(scheduledAt)).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })
    : <span className="muted">À programmer</span>
  const submitLabel = `${when === 'later' ? 'Programmer la tournée' : 'Lancer la tournée'} · ${stops.length} arrêts`
  const mapHint = stops[active] ? `Cliquez sur la carte pour placer l'arrêt ${active + 1}` : null

  return (
    <div className="nd bt-new">
      <PageHeader
        eyebrow="Tournées groupées"
        title={<>{dupFrom ? 'Recommander la tournée' : 'Nouvelle tournée'}<span className="dot">.</span></>}
        description={dupFrom
          ? `Mêmes destinataires que la tournée du ${dateTime(dupFrom.createdAt)}. Vérifiez puis lancez-la.`
          : 'Un seul coursier récupère tous les colis à votre point de retrait et les livre l\'un après l\'autre, de 2 à 5 destinataires.'}
        actions={<Button variant="ghost" to="/tournees">Annuler</Button>}
      />

      {planBlocked && (
        <div className="bt-alert" role="alert">
          <AlertCircle size={18} aria-hidden />
          <div>
            <strong>Offre DEM Pro requise</strong>
            <span>{planBlocked}</span>
          </div>
          <Button size="sm" variant="ghost" to="/compte">Choisir une offre</Button>
        </div>
      )}

      <div className="nd-grid">
        <div className="card nd-form">
          {/* 1. Retrait */}
          <Section title="Point de retrait" hint="Le coursier y récupère tous les colis de la tournée">
            {!addresses ? <Skeleton h={64} /> : addresses.length === 0 ? (
              <p className="muted nd-help">Ajoutez une adresse de retrait dans <a className="link" href="#" onClick={(e) => { e.preventDefault(); navigate('/compte') }}>Compte</a> pour lancer une tournée.</p>
            ) : (
              <>
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
                {pickup && !pickupOk && (
                  <span className="nd-err" role="alert" style={{ marginTop: 10 }}><AlertCircle size={13} aria-hidden /> Ce point de retrait n'a pas de position sur la carte. Modifiez-le dans Compte, ou choisissez-en un autre.</span>
                )}
              </>
            )}
          </Section>

          {/* 2. Arrêts */}
          <Section title={`Destinataires · ${stops.length} sur ${MAX_STOPS}`} hint="Dans l'ordre de passage du coursier. Le téléphone est obligatoire : le coursier appelle à l'arrivée.">
            <ol className="bt-stops">
              {stops.map((s, i) => (
                <StopCard key={s.key} index={i} stop={s} count={stops.length} active={active === i}
                  recent={recent} showErrors={triedSubmit} touched={touched[s.key] ?? {}}
                  onTouch={(f) => setTouched(t => ({ ...t, [s.key]: { ...t[s.key], [f]: true } }))}
                  onFocus={() => setActive(i)}
                  onChange={(p) => patch(i, p)}
                  onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => remove(i)} />
              ))}
            </ol>
            {stops.length < MAX_STOPS ? (
              <button type="button" className="bt-add" onClick={add}>
                <Plus size={16} aria-hidden /> Ajouter un destinataire
                <span className="muted">{MAX_STOPS - stops.length} de plus possible{MAX_STOPS - stops.length > 1 ? 's' : ''}</span>
              </button>
            ) : (
              <p className="muted nd-help"><Info size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> 5 destinataires au plus par tournée. Pour plus de colis, lancez une deuxième tournée.</p>
            )}
          </Section>

          {/* 3. Instructions et horaire */}
          <Section title="Instructions et horaire" last>
            <div className="nd-cols">
              <Field label="Instructions pour le coursier (facultatif)">
                {(p) => <textarea {...p} className="input bt-textarea" rows={3} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ex. demandez Awa à l'accueil, colis prêts au comptoir" />}
              </Field>
              <div className="nd-group">
                <span className="label-caps nd-sub">Quand ?</span>
                <Segmented full label="Quand" value={when} onChange={setWhen}
                  options={[['now', 'Maintenant', Zap], ['later', 'Programmer', CalendarClock]]} />
                {when === 'later' ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Date et heure de retrait" error={(touched.schedule || triedSubmit || scheduledAt) && !scheduleOk ? 'Choisissez une heure au moins 15 minutes plus tard.' : null}>
                      {(p) => <input {...p} type="datetime-local" className="input" value={scheduledAt} min={isoToDakarInput(minSchedule)}
                        onChange={e => setScheduledAt(e.target.value)} onBlur={() => setTouched(t => ({ ...t, schedule: true }))} />}
                    </Field>
                  </div>
                ) : <p className="muted nd-help">Un coursier proche part tout de suite.</p>}
              </div>
            </div>
          </Section>
        </div>

        {/* Résumé collant */}
        <aside className="nd-summary" aria-label="Résumé de la tournée">
          <div className="card nd-sum-card">
            <div className="nd-map bt-map">
              <BatchMap pickup={pickupOk ? pickup : null}
                stops={stops.map((s, i) => (located(s) ? { lat: s.lat, lng: s.lng, state: i === active ? 'active' : undefined } : null))}
                onPick={stops[active] ? (pt) => patch(active, { address: pt.address, lat: pt.lat, lng: pt.lng }) : null}
                hint={mapHint} />
            </div>
            <div className="nd-sum-body">
              <dl className="nd-rows">
                <div><dt>Retrait</dt><dd>{pickup?.label ?? <span className="muted">À choisir</span>}</dd></div>
                <div><dt>Arrêts</dt><dd>{placed} sur {stops.length} placé{placed > 1 ? 's' : ''}</dd></div>
                <div><dt>Départ</dt><dd>{departLabel}</dd></div>
              </dl>

              {route && (
                <div className={`bt-route ${route.improved ? 'is-better' : ''}`} aria-live="polite">
                  {route.improved ? (
                    <>
                      <span className="bt-route-head"><Sparkles size={14} aria-hidden /> Ordre plus court conseillé</span>
                      <p>Arrêts {route.order.map(n => n + 1).join(' → ')} : {km(route.best.distanceKm)} au lieu de {km(route.current?.distanceKm ?? route.best.distanceKm)}{route.savingMin ? `, environ ${route.savingMin} min de moins` : ''}.</p>
                      <Button size="sm" variant="ghost" icon={Route} onClick={applyOrder}>Appliquer cet ordre</Button>
                    </>
                  ) : (
                    <>
                      <span className="bt-route-head"><Check size={14} aria-hidden /> Bon ordre de passage</span>
                      <p>Trajet estimé : {km(route.best.distanceKm)} · environ {route.best.durationMin} min de route.</p>
                    </>
                  )}
                </div>
              )}

              <div className="nd-price bt-price">
                <span className="label-caps">Prix</span>
                <p>Calculé par DEM à l'envoi, pour chaque arrêt, selon la distance depuis votre point de retrait. Vous le voyez tout de suite après, arrêt par arrêt.</p>
                <p className="muted">Chaque destinataire règle son arrêt au coursier, à la livraison.</p>
              </div>

              <Button size="lg" arrow="right" loading={submitting} disabled={submitting || (triedSubmit && !ready)} onClick={submit} className="nd-submit">
                {submitLabel}
              </Button>
              {missing.length > 0 && (
                <div className="nd-missing">
                  <span className="label-caps">À compléter</span>
                  <ul>{missing.slice(0, 6).map(m => <li key={m}><AlertCircle size={13} aria-hidden /> {m.charAt(0).toUpperCase() + m.slice(1)}</li>)}</ul>
                  {missing.length > 6 && <p className="muted nd-help">et {missing.length - 6} autre{missing.length - 6 > 1 ? 's' : ''} point{missing.length - 6 > 1 ? 's' : ''}</p>}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile : bouton toujours à portée */}
      <div className="nd-mbar">
        <div className="nd-mbar-total">
          <span className="label-caps">Tournée</span>
          <span className="num">{stops.length} arrêts</span>
        </div>
        <Button arrow="right" loading={submitting} disabled={submitting || (triedSubmit && !ready)} onClick={submit}>
          {when === 'later' ? 'Programmer' : 'Lancer'}
        </Button>
      </div>
    </div>
  )
}

// ── Un destinataire ─────────────────────────────────────────────────────────
function StopCard({ index, stop: s, count, active, recent, showErrors, touched, onTouch, onFocus, onChange, onUp, onDown, onRemove }) {
  const digits = digitsOf(s.phone)
  const phoneOk = phoneValid(s.phone)
  const err = {
    phone: (touched.phone || showErrors) && !phoneOk ? 'Numéro mobile sénégalais : 70, 75, 76, 77 ou 78, puis 7 chiffres.' : null,
    drop: showErrors && !located(s) ? 'Choisissez l\'adresse, ou cliquez sur la carte.' : null,
  }
  const empty = !s.name && !digits && !located(s)
  const n = index + 1
  return (
    <li className={`bt-stop ${active ? 'is-active' : ''}`} onFocusCapture={onFocus} onPointerDown={onFocus} aria-label={`Arrêt ${n}`}>
      <header className="bt-stop-head">
        <span className={`bt-num ${located(s) && phoneOk ? 'is-ok' : ''}`} aria-hidden>{n}</span>
        <div className="bt-stop-title">
          <b>Arrêt {n}</b>
          <span className="muted">{s.name || (located(s) ? s.address : 'Destinataire à renseigner')}</span>
        </div>
        <div className="bt-stop-tools">
          <button type="button" className="nd-x" aria-label={`Monter l'arrêt ${n}`} title="Monter" disabled={index === 0} onClick={onUp}><ArrowUp size={15} aria-hidden /></button>
          <button type="button" className="nd-x" aria-label={`Descendre l'arrêt ${n}`} title="Descendre" disabled={index === count - 1} onClick={onDown}><ArrowDown size={15} aria-hidden /></button>
          {count > MIN_STOPS && <button type="button" className="nd-x bt-del" aria-label={`Retirer l'arrêt ${n}`} title="Retirer" onClick={onRemove}><Trash2 size={15} aria-hidden /></button>}
        </div>
      </header>

      <div className="bt-stop-body">
        {empty && recent.length > 0 && (
          <div className="bt-recent">
            <span className="label-caps nd-sub"><History size={13} aria-hidden /> Clients récents</span>
            <div className="nd-chips">
              {recent.slice(0, 6).map(r => (
                <Chip key={`${r.receiverPhone}-${r.address}`} title={`${r.receiverName ?? ''} · ${phoneFmt(r.receiverPhone)} · ${r.address}`}
                  onClick={() => onChange({
                    name: r.receiverName ?? '',
                    phone: digitsOf(r.receiverPhone),
                    ...(r.lat != null ? { address: r.address, lat: r.lat, lng: r.lng } : {}),
                  })}>{r.receiverName ?? r.address}</Chip>
              ))}
            </div>
          </div>
        )}

        <div className="nd-cols">
          <Field label="Nom (conseillé)">
            {(p) => <input {...p} className="input" value={s.name} maxLength={100} autoComplete="off" onChange={e => onChange({ name: e.target.value })} placeholder="Ex. Fatou Sow" />}
          </Field>
          <Field label="Téléphone" error={err.phone}>
            {(p) => (
              <div className="nd-phone">
                <span className="nd-prefix">+221</span>
                <input {...p} className="input" inputMode="numeric" autoComplete="off" value={fmtPhone(digits)}
                  onChange={e => onChange({ phone: e.target.value })} onBlur={() => onTouch('phone')} placeholder="77 123 45 67" />
                {phoneOk && <Check size={16} className="nd-ok" aria-hidden />}
              </div>
            )}
          </Field>
        </div>

        <div className="bt-field">
          <span className="nd-label" aria-hidden>Adresse de livraison</span>
          <AddressSearch label={`Adresse de livraison, arrêt ${n}`} value={located(s) ? { address: s.address, lat: s.lat, lng: s.lng } : null}
            onPick={(pt) => onChange({ address: pt.address, lat: pt.lat, lng: pt.lng })}
            onClear={() => onChange({ address: '', lat: null, lng: null })} error={err.drop} />
        </div>

        <div className="nd-cols">
          <Field label="Repère (conseillé)">
            {(p) => <input {...p} className="input" value={s.landmark} maxLength={200} onChange={e => onChange({ landmark: e.target.value })} placeholder="Ex. face pharmacie, portail bleu" />}
          </Field>
          <Field label="Contenu (facultatif)">
            {(p) => <input {...p} className="input" value={s.detail} maxLength={200} onChange={e => onChange({ detail: e.target.value })} placeholder="Ex. 2 robes, 1 sac" />}
          </Field>
        </div>

        <div className="bt-pkg">
          <span className="label-caps nd-sub">Colis</span>
          <div className="bt-pkg-row">
            <Segmented label={`Type de colis, arrêt ${n}`} value={s.pkg} onChange={(v) => onChange({ pkg: v })} options={PKG_TYPES} />
            <Chip selected={s.fragile} icon={s.fragile ? Check : Plus} onClick={() => onChange({ fragile: !s.fragile })}>Fragile</Chip>
          </div>
        </div>
      </div>
    </li>
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

// ── Confirmation : prix réel calculé par le serveur ─────────────────────────
function Created({ batch, onNew, onTrack }) {
  const stops = sortedStops(batch)
  const later = !!batch.scheduledAt
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  const discount = stops.reduce((t, o) => t + (Number(o.discountAmount) || 0), 0)
  const fees = Number(batch.demFee) || 0
  const total = batchTotal(batch)
  // totalPrice est déjà net de la réduction : prix des livraisons avant réduction
  const deliveries = total - fees + discount
  return (
    <div className="bt-done anim-in">
      <div className="card bt-done-card has-corners">
        <Corners />
        <div className="bt-done-head" ref={ref} tabIndex={-1}>
          <span className="bt-done-ico" aria-hidden>{later ? <CalendarClock size={22} /> : <CircleCheck size={22} />}</span>
          <div>
            <p className="eyebrow" style={{ margin: '0 0 10px' }}>Tournée groupée</p>
            <h1 className="page-title">{later ? 'Tournée programmée' : 'Tournée lancée'}<span className="dot">.</span></h1>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>
              {later ? `Le coursier passera le ${dateTime(batch.scheduledAt)} à votre point de retrait.` : 'Nous cherchons un coursier proche. Vous serez prévenu dès qu\'il accepte.'}
            </p>
          </div>
        </div>

        <div className="bt-done-route">
          <div className="bt-done-pick"><Store size={15} aria-hidden /><span>{batch.pickupAddress}</span></div>
          <ol className="bt-done-stops">
            {stops.map((o, i) => (
              <li key={o.id}>
                <span className="bt-num" aria-hidden>{i + 1}</span>
                <span className="bt-done-stop-txt">
                  <b>{o.receiverName || `Destinataire ${i + 1}`}{o.receiverPhone && <span className="muted"> · {phoneFmt(o.receiverPhone)}</span>}</b>
                  <span className="muted">{o.deliveryAddress}</span>
                </span>
                <span className="num bt-done-amount">{fcfa(stopTotal(o))}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bt-done-sum">
          <div className="nd-line"><span>Livraisons · {stops.length} arrêts</span><span className="num">{fcfa(deliveries)}</span></div>
          {discount > 0 && <div className="nd-line"><span>Réduction</span><span className="num">− {fcfa(discount)}</span></div>}
          {fees > 0 && <div className="nd-line"><span>Frais de service</span><span className="num">{fcfa(fees)}</span></div>}
          <div className="nd-total"><span>Total de la tournée</span><span className="num">{fcfa(total)}</span></div>
          <p className="muted nd-help">Chaque destinataire règle le montant de son arrêt au coursier, à la livraison.</p>
        </div>

        <div className="bt-done-actions">
          <Button arrow="right" icon={Bike} onClick={onTrack}>Suivre la tournée</Button>
          <Button variant="ghost" icon={Plus} onClick={onNew}>Nouvelle tournée</Button>
        </div>
      </div>
    </div>
  )
}
