import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, MapPin, Phone, StickyNote, Lock, X, Package, Truck, ChefHat, PackageCheck, Check } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { dateTime, fcfa, phoneFmt, timeAgo } from '../lib/format'
import { Button, Card, Drawer, Empty, ErrorState, IconButton, Modal, PageHeader, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Commandes reçues par le lien de la boutique, par étape — mêmes étapes que
// l'app 1.2.5 (dem_pro_order_requests_screen.dart) et que le serveur
// (dem_pro.service.js:requestStep) :
//   NEW → (Accepter) CONFIRMED → PREPARING → READY → (Lancer la livraison)
//   IN_DELIVERY → DELIVERED ; refusée ou annulée : CANCELLED.
const TABS = [
  ['new', 'Nouvelles', ['NEW']],
  ['active', 'En cours', ['CONFIRMED', 'PREPARING', 'READY']],
  ['delivery', 'En livraison', ['IN_DELIVERY']],
  ['done', 'Terminées', ['DELIVERED', 'CANCELLED']],
]
const DELIVERED = new Set(['DELIVERED', 'COMPLETED'])
// Étape : donnée par le serveur ; à défaut (ancien serveur), déduite du statut
const stepOf = (r) => r.step ?? ({
  PENDING: 'NEW',
  ACCEPTED: r.prepStage === 'READY' ? 'READY' : r.prepStage === 'PREPARING' ? 'PREPARING' : 'CONFIRMED',
  CONFIRMED: DELIVERED.has(r.orderStatus) ? 'DELIVERED' : 'IN_DELIVERY',
}[r.status ?? 'PENDING'] ?? 'CANCELLED')
const STEP_LABEL = {
  NEW: 'Nouvelle', CONFIRMED: 'Acceptée', PREPARING: 'En préparation', READY: 'Prête',
  IN_DELIVERY: 'En livraison', DELIVERED: 'Livrée', CANCELLED: 'Refusée ou annulée',
}
const PREP = ['CONFIRMED', 'PREPARING', 'READY']

const itemCount = (r) => (r.items ?? []).reduce((s, it) => s + (Number(it.quantity) || 1), 0)
const articlesTotal = (r) => r.productAmount ?? r.total ?? (r.items ?? []).reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0)
// Prix complet (lien au prix complet) : livraison figée à la commande du client
const deliveryOf = (r) => r.deliveryQuote ?? r.delivery ?? null
const grandTotal = (r) => r.totalAmount ?? (deliveryOf(r) ? articlesTotal(r) + (Number(deliveryOf(r).total) || 0) : null)
const lastAt = (r) => r.readyAt ?? r.preparingAt ?? r.acceptedAt ?? r.updatedAt ?? r.createdAt

// Paiement : vert payé en ligne, gris à l'arrivée (normal), orange en attente
function PayBadge({ r }) {
  const paid = !!r.paidAt
  const later = r.paymentTiming !== 'NOW'
  const tone = paid ? { background: 'var(--p-success-bg)', color: 'var(--p-success)' }
    : later ? { background: 'var(--p-slate-bg)', color: 'var(--p-slate)' }
    : { background: 'var(--p-warning-bg)', color: 'var(--p-warning)' }
  return <span className="badge" style={tone}><span className="badge-dot" aria-hidden />{paid ? 'Payée en ligne' : later ? 'Paiement à l’arrivée' : 'Paiement en attente'}</span>
}

function StepBadge({ step }) {
  const tone = step === 'DELIVERED' ? { background: 'var(--p-success-bg)', color: 'var(--p-success)' }
    : step === 'CANCELLED' ? { background: 'var(--p-danger-bg)', color: 'var(--p-danger)' }
    : step === 'NEW' ? { background: 'var(--p-info-bg)', color: 'var(--p-info)' }
    : { background: 'var(--p-slate-bg)', color: 'var(--p-slate)' }
  return <span className="badge" style={tone}><span className="badge-dot" aria-hidden />{STEP_LABEL[step] ?? step}</span>
}

// Barre Acceptée → En préparation → Prête
function PrepProgress({ step }) {
  const at = PREP.indexOf(step)
  return (
    <ol className="rq-prog" aria-label={`Étape : ${STEP_LABEL[step]}`}>
      {PREP.map((s, i) => (
        <li key={s} className={i <= at ? 'on' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="rq-prog-dot" aria-hidden>{i < at ? <Check size={10} /> : null}</span>{STEP_LABEL[s]}
        </li>
      ))}
    </ol>
  )
}

// Action principale selon l'étape (tableau, carte et panneau)
function nextAction(step) {
  if (step === 'NEW') return { kind: 'accept', label: 'Accepter', icon: Check }
  if (step === 'CONFIRMED') return { kind: 'PREPARING', label: 'Commencer la préparation', icon: ChefHat }
  if (step === 'PREPARING') return { kind: 'READY', label: 'Marquer prête', icon: PackageCheck }
  if (step === 'READY') return { kind: 'launch', label: 'Lancer la livraison', icon: Truck }
  return null
}

export default function Requests() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [all, setAll] = useState(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState('new')
  const [openId, setOpenId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  // Une réponse en retard n'écrase jamais une plus récente
  const load = useCallback(async () => {
    const n = ++seq.current
    try {
      const r = await proApi.get('/dem-pro/order-requests')
      if (n === seq.current) { setAll(r.data ?? []); setFailed(false) }
    } catch { if (n === seq.current) setFailed(true) }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const groups = useMemo(() => Object.fromEntries(TABS.map(([k, , steps]) => [k, (all ?? []).filter(r => steps.includes(stepOf(r)))])), [all])
  const list = groups[tab] ?? []
  const opened = (all ?? []).find(r => r.id === openId) ?? null
  const launch = (r) => navigate(`/livraisons/nouvelle?commande=${r.id}`)

  const replace = (row) => setAll(prev => (prev ?? []).map(x => (x.id === row.id ? { ...x, ...row } : x)))

  const act = async (r) => {
    const a = nextAction(stepOf(r))
    if (!a || busyId) return
    if (a.kind === 'launch') return launch(r)
    setBusyId(r.id)
    try {
      const res = a.kind === 'accept'
        ? await proApi.post(`/dem-pro/order-requests/${r.id}/accept`)
        : await proApi.post(`/dem-pro/order-requests/${r.id}/stage`, { stage: a.kind })
      replace(res.data ?? {})
      if (a.kind === 'accept') {
        notify.success('Commande acceptée', 'Elle passe dans « En cours ». Lancez la livraison quand elle est prête.')
        window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
      }
      load()
    } catch (e) {
      notify.error('Action impossible', errMsg(e))
      load()
    } finally { setBusyId(null) }
  }

  const reject = async () => {
    if (busy) return
    setBusy(true)
    try {
      await proApi.post(`/dem-pro/order-requests/${rejecting.id}/reject`)
      notify.success(stepOf(rejecting) === 'NEW' ? 'Commande refusée' : 'Commande annulée', rejecting.paidAt ? 'Votre client est remboursé automatiquement.' : 'Votre client est prévenu par SMS.')
      setRejecting(null); setOpenId(null); load(); window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
    } catch (e) { notify.error('La commande n’a pas été refusée', errMsg(e)) } finally { setBusy(false) }
  }

  const nNew = groups.new?.length ?? 0
  const nActive = groups.active?.length ?? 0
  const description = !all ? null
    : nNew || nActive ? [nNew && `${nNew} nouvelle${nNew > 1 ? 's' : ''}`, nActive && `${nActive} en cours`].filter(Boolean).join(' · ') + ' · reçues sur le lien de votre boutique'
    : 'Passées par vos clients sur le lien de votre boutique. Elles arrivent ici en direct.'

  const rowActions = (r) => {
    const step = stepOf(r)
    const a = nextAction(step)
    if (!a) return null
    const cancelable = step === 'NEW' || PREP.includes(step)
    return (
      <>
        {cancelable && <Button variant="quiet" size="sm" onClick={() => setRejecting(r)}>{step === 'NEW' ? 'Refuser' : 'Annuler'}</Button>}
        {step === 'NEW' && <Button variant="ghost" size="sm" onClick={() => launch(r)}>Livrer tout de suite</Button>}
        {PREP.includes(step) && step !== 'READY' && <Button variant="ghost" size="sm" onClick={() => launch(r)}>Lancer la livraison</Button>}
        <Button size="sm" icon={a.icon} loading={busyId === r.id} onClick={() => act(r)}>{a.label}</Button>
      </>
    )
  }

  const emptyText = {
    new: ['Aucune nouvelle commande', 'Partagez le lien de votre boutique : chaque nouvelle commande apparaît ici, avec une notification.'],
    active: ['Aucune commande en cours', 'Les commandes acceptées restent ici pendant la préparation, jusqu’au lancement de la livraison.'],
    delivery: ['Aucune commande en livraison', null],
    done: ['Aucune commande terminée', null],
  }[tab]

  return (
    <div>
      <PageHeader eyebrow="Commandes reçues" title={<>Vos commandes<span className="dot">.</span></>} description={description} />

      <Card className="dl-card" style={{ padding: 0 }}>
        <div className="dl-tabs" role="tablist" aria-label="Commandes par étape">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className="dl-tab" onClick={() => setTab(k)}>
              {label}{all && <span className="dl-count num">{groups[k]?.length ?? 0}</span>}
            </button>
          ))}
        </div>

        {failed && !all ? <ErrorState title="Impossible de charger vos commandes" onRetry={load} />
          : !all ? <div style={{ padding: 20, display: 'grid', gap: 10 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={56} />)}</div>
          : list.length === 0 ? (
            <Empty icon={Inbox} title={emptyText[0]} text={emptyText[1]}
              action={tab === 'new' && <Button variant="ghost" size="sm" to="/boutique" arrow="right">Voir le lien de ma boutique</Button>} />
          ) : (
            <>
              {/* Téléphone et tablette : cartes */}
              <ul className="dl-mlist rq-narrow">
                {list.map(r => (
                  <li key={r.id} className={`dl-mcard ${openId === r.id ? 'is-open' : ''}`}>
                    <button type="button" className="dl-mcard-main" onClick={() => setOpenId(r.id)}>
                      <span className="dl-mcard-top"><StepBadge step={stepOf(r)} /><span className="dl-amount-m num">{fcfa(grandTotal(r) ?? articlesTotal(r))}</span></span>
                      <span className="dl-mcard-mid"><span className="dl-name">{r.customerName || 'Client'}</span></span>
                      <span className="dl-mcard-bot muted" style={{ fontSize: 12.5 }}>
                        {itemCount(r)} article{itemCount(r) > 1 ? 's' : ''} · <PayBadge r={r} /> · {dateTime(lastAt(r))}
                      </span>
                    </button>
                    {PREP.includes(stepOf(r)) && <div style={{ padding: '0 16px 10px' }}><PrepProgress step={stepOf(r)} /></div>}
                    {nextAction(stepOf(r)) && <div className="rq-card-actions">{rowActions(r)}</div>}
                  </li>
                ))}
              </ul>

              {/* Ordinateur : tableau */}
              <table className="dl-table rq-table rq-wide">
                <colgroup>
                  <col /><col className="c-items" /><col className="c-pay" /><col className="c-amount" /><col className="c-date" />
                  {(tab === 'new' || tab === 'active') && <col className="c-actions" />}
                </colgroup>
                <thead>
                  <tr>
                    <th>Client</th><th>Articles</th><th>{tab === 'active' ? 'Étape' : 'Paiement'}</th><th className="num-col">Total</th>
                    <th>{tab === 'new' ? 'Reçue' : 'Mise à jour'}</th>
                    {(tab === 'new' || tab === 'active') && <th><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id} className={`dl-row ${openId === r.id ? 'is-open' : ''}`} tabIndex={0}
                      onClick={() => setOpenId(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(r.id) }}>
                      <td>
                        <div className="dl-name dl-ellipsis">{r.customerName || 'Client'}</div>
                        <div className="dl-sub muted dl-ellipsis">{r.deliveryAddress}</div>
                      </td>
                      <td>{itemCount(r)} article{itemCount(r) > 1 ? 's' : ''}</td>
                      <td>{tab === 'active' ? <StepBadge step={stepOf(r)} /> : tab === 'done' ? <StepBadge step={stepOf(r)} /> : <PayBadge r={r} />}</td>
                      <td className="num-col">
                        <div className="dl-amount num">{fcfa(grandTotal(r) ?? articlesTotal(r))}</div>
                        {grandTotal(r) == null && <div className="dl-sub muted">articles</div>}
                      </td>
                      <td><span className="dl-date" title={timeAgo(lastAt(r))}>{dateTime(tab === 'new' ? r.createdAt : lastAt(r))}</span></td>
                      {(tab === 'new' || tab === 'active') && (
                        <td className="rq-actions" onClick={(e) => e.stopPropagation()}>{rowActions(r)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
      </Card>

      <RequestDrawer r={opened} onClose={() => setOpenId(null)} actions={opened ? rowActions(opened) : null} />

      <Modal open={!!rejecting} onClose={() => setRejecting(null)}
        title={rejecting && stepOf(rejecting) !== 'NEW' ? 'Annuler cette commande ?' : 'Refuser cette commande ?'}
        subtitle={rejecting?.paidAt
          ? `Elle a été payée en ligne : votre client est remboursé automatiquement (${fcfa(grandTotal(rejecting) ?? articlesTotal(rejecting))}).`
          : 'Votre client ne sera pas livré. Il est prévenu par SMS.'}
        footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Garder la commande</Button><Button variant="danger" loading={busy} onClick={reject}>{rejecting && stepOf(rejecting) !== 'NEW' ? 'Annuler la commande' : 'Refuser la commande'}</Button></>} />
    </div>
  )
}

function RequestDrawer({ r, onClose, actions }) {
  const delivery = r ? deliveryOf(r) : null
  const total = r ? grandTotal(r) : null
  const pickup = r?.pickupAddress ?? null
  const step = r ? stepOf(r) : null
  return (
    <Drawer open={!!r} onClose={onClose} width={520} label="Détail de la commande">
      {r && (
        <>
          <div className="dl-dhead">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="label-caps">Commande reçue</span>
              <div className="dl-dtitle">{r.customerName || 'Client'}</div>
              <div className="dl-dmeta"><StepBadge step={step} /><PayBadge r={r} /><span className="muted">Reçue le {dateTime(r.createdAt)}</span></div>
            </div>
            <IconButton icon={X} label="Fermer" size="sm" variant="plain" onClick={onClose} />
          </div>

          <div className="scroll-y dl-dbody">
            {PREP.includes(step) && <section className="dl-sec"><PrepProgress step={step} /></section>}
            <section className="dl-sec">
              <h3 className="label-caps dl-sec-title">Articles</h3>
              <ul className="rq-items">
                {(r.items ?? []).map((it, i) => (
                  <li key={i}>
                    {it.image ? <img src={it.image} alt="" loading="lazy" /> : <span className="rq-thumb" aria-hidden><Package size={16} /></span>}
                    <span className="rq-item-name">{it.name} <span className="muted">×{it.quantity ?? 1}</span></span>
                    <span className="num">{fcfa((it.price ?? 0) * (it.quantity ?? 1))}</span>
                  </li>
                ))}
              </ul>
              <div className="dl-row-price"><span className="muted">Total articles</span><span className="num">{fcfa(articlesTotal(r))}</span></div>
              {delivery && <div className="dl-row-price"><span className="muted">Livraison{delivery.pickupArea ? ` depuis ${delivery.pickupArea}` : ''}</span><span className="num">{fcfa(delivery.total ?? (Number(delivery.price) || 0) + (Number(delivery.demFee) || 0))}</span></div>}
              {total != null
                ? <div className="dl-total"><span>Total</span><span className="num">{fcfa(total)}</span></div>
                : <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>La livraison est calculée quand vous la lancez.</div>}
              {r.paymentTiming && (
                <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  {r.paymentTiming === 'NOW' ? (r.paidAt ? 'Payée en ligne par le client.' : 'Paiement en ligne en attente.') : 'Le client paie à l’arrivée du coursier.'}
                </div>
              )}
            </section>

            <section className="dl-sec">
              <h3 className="label-caps dl-sec-title">Client</h3>
              <div className="rq-line"><Phone size={15} aria-hidden /><a className="link" href={`tel:${r.customerPhone}`}>{phoneFmt(r.customerPhone)}</a></div>
              <div className="rq-line"><MapPin size={15} aria-hidden /><span>{r.deliveryAddress}{r.landmark ? ` · ${r.landmark}` : ''}</span></div>
              {r.notes && <div className="rq-line"><StickyNote size={15} aria-hidden /><span>{r.notes}</span></div>}
              {pickup && <div className="rq-line"><Lock size={15} aria-hidden /><span>Point de retrait fixé : {typeof pickup === 'string' ? pickup : pickup.label ?? pickup.address}</span></div>}
            </section>

            {(step === 'DELIVERED' || step === 'CANCELLED' || step === 'IN_DELIVERY') && (
              <section className="dl-sec muted" style={{ fontSize: 13 }}>
                {STEP_LABEL[step]}{r.handledByName ? ` · par ${r.handledByName}` : ''} · {dateTime(lastAt(r))}.
              </section>
            )}
          </div>

          {actions && (
            <div className="dl-dfoot rq-dfoot">
              {actions}
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
