import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, MapPin, Phone, CheckCircle2, XCircle, StickyNote, Lock, X, Package } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { dateTime, fcfa, phoneFmt, timeAgo } from '../lib/format'
import { Button, Card, Drawer, Empty, ErrorState, IconButton, Modal, PageHeader, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Commandes reçues par le lien de commande : à valider (livraison
// pré-remplie) ou à refuser — même file que l'app.
const TABS = [['PENDING', 'À traiter'], ['CONFIRMED', 'Validées'], ['REJECTED', 'Refusées']]
const statusOf = (r) => r.status ?? 'PENDING'
const itemCount = (r) => (r.items ?? []).reduce((s, it) => s + (Number(it.quantity) || 1), 0)
const articlesTotal = (r) => r.productAmount ?? r.total ?? (r.items ?? []).reduce((s, it) => s + (it.price ?? 0) * (it.quantity ?? 1), 0)
// Prix complet (nouveau serveur) : livraison figée à la commande du client
const deliveryOf = (r) => r.deliveryQuote ?? r.delivery ?? null
const grandTotal = (r) => r.totalAmount ?? (deliveryOf(r) ? articlesTotal(r) + (Number(deliveryOf(r).total) || 0) : null)
// Date de traitement : champ dédié s'il existe, sinon la dernière mise à jour
const handledAt = (r) => r.handledAt ?? r.confirmedAt ?? r.rejectedAt ?? (statusOf(r) !== 'PENDING' ? r.updatedAt : null)

function PayBadge({ r }) {
  const paid = !!r.paidAt
  const later = r.paymentTiming !== 'NOW'
  return (
    <span className="badge" style={paid
      ? { background: 'var(--p-success-bg)', color: 'var(--p-success)' }
      : { background: 'var(--p-warning-bg)', color: 'var(--p-warning)' }}>
      <span className="badge-dot" aria-hidden />{paid ? 'Payée en ligne' : later ? 'À l’arrivée' : 'En attente'}
    </span>
  )
}

export default function Requests() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [all, setAll] = useState(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState('PENDING')
  const [openId, setOpenId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await proApi.get('/dem-pro/order-requests')
      setAll(r.data ?? []); setFailed(false)
    } catch { setFailed(true) }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, (all ?? []).filter(r => statusOf(r) === k).length])), [all])
  const list = useMemo(() => (all ?? []).filter(r => statusOf(r) === tab), [all, tab])
  const opened = (all ?? []).find(r => r.id === openId) ?? null
  const validate = (r) => navigate(`/livraisons/nouvelle?commande=${r.id}`)

  const reject = async () => {
    setBusy(true)
    try {
      await proApi.post(`/dem-pro/order-requests/${rejecting.id}/reject`)
      notify.success('Commande refusée', rejecting.paidAt ? 'Votre client est remboursé automatiquement.' : null)
      setRejecting(null); setOpenId(null); load(); window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
    } catch (e) { notify.error('La commande n’a pas été refusée', errMsg(e)) } finally { setBusy(false) }
  }

  const pending = counts.PENDING ?? 0
  return (
    <div>
      <PageHeader
        eyebrow="Commandes reçues"
        title={<>Vos commandes<span className="dot">.</span></>}
        description={all ? (pending ? `${pending} commande${pending > 1 ? 's' : ''} à valider · passées sur votre lien de commande` : 'Passées par vos clients sur votre lien de commande. Elles arrivent ici en direct.') : null}
      />

      <Card className="dl-card" style={{ padding: 0 }}>
        <div className="dl-tabs" role="tablist" aria-label="Filtrer les commandes">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className="dl-tab" onClick={() => setTab(k)}>
              {label}{all && <span className="dl-count num">{counts[k]}</span>}
            </button>
          ))}
        </div>

        {failed && !all ? <ErrorState title="Impossible de charger vos commandes" onRetry={load} />
          : !all ? <div style={{ padding: 20, display: 'grid', gap: 10 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={52} />)}</div>
          : list.length === 0 ? (
            <Empty icon={Inbox} title={tab === 'PENDING' ? 'Aucune commande en attente' : 'Rien ici pour le moment'}
              text={tab === 'PENDING' ? 'Partagez votre lien de commande : chaque nouvelle commande apparaît ici, avec une notification.' : null}
              action={tab === 'PENDING' && <Button variant="ghost" size="sm" to="/boutique" arrow="right">Voir mon lien de commande</Button>} />
          ) : (
            <>
              {/* Téléphone : cartes */}
              <ul className="dl-mlist pro-only-sm">
                {list.map(r => (
                  <li key={r.id} className={`dl-mcard ${openId === r.id ? 'is-open' : ''}`}>
                    <button type="button" className="dl-mcard-main" onClick={() => setOpenId(r.id)}>
                      <span className="dl-mcard-top"><PayBadge r={r} /><span className="dl-amount-m num">{fcfa(grandTotal(r) ?? articlesTotal(r))}</span></span>
                      <span className="dl-mcard-mid"><span className="dl-name">{r.customerName || 'Client'}</span></span>
                      <span className="dl-mcard-bot muted" style={{ fontSize: 12.5 }}>
                        {itemCount(r)} article{itemCount(r) > 1 ? 's' : ''} · {dateTime(handledAt(r) ?? r.createdAt)}
                      </span>
                    </button>
                    {tab === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
                        <Button variant="ghost" size="sm" onClick={() => setRejecting(r)}>Refuser</Button>
                        <Button size="sm" arrow="right" onClick={() => validate(r)} style={{ flex: 1 }}>Valider</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Tablette et ordinateur : tableau */}
              <table className="dl-table rq-table pro-hide-only-sm">
                <colgroup>
                  <col /><col className="c-items" /><col className="c-pay" /><col className="c-amount" /><col className="c-date" />
                  {tab === 'PENDING' && <col className="c-actions" />}
                </colgroup>
                <thead>
                  <tr>
                    <th>Client</th><th>Articles</th><th>Paiement</th><th className="num-col">Total</th>
                    <th>{tab === 'PENDING' ? 'Reçue le' : tab === 'CONFIRMED' ? 'Validée le' : 'Refusée le'}</th>
                    {tab === 'PENDING' && <th><span className="sr-only">Actions</span></th>}
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
                      <td><PayBadge r={r} /></td>
                      <td className="num-col">
                        <div className="dl-amount num">{fcfa(grandTotal(r) ?? articlesTotal(r))}</div>
                        {grandTotal(r) == null && <div className="dl-sub muted">articles</div>}
                      </td>
                      <td><span className="dl-date" title={timeAgo(handledAt(r) ?? r.createdAt)}>{dateTime(handledAt(r) ?? r.createdAt)}</span></td>
                      {tab === 'PENDING' && (
                        <td className="rq-actions" onClick={(e) => e.stopPropagation()}>
                          <Button variant="quiet" size="sm" onClick={() => setRejecting(r)}>Refuser</Button>
                          <Button size="sm" arrow="right" onClick={() => validate(r)}>Valider</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
      </Card>

      <RequestDrawer r={opened} onClose={() => setOpenId(null)} onValidate={validate} onReject={setRejecting} />

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Refuser cette commande ?"
        subtitle={rejecting?.paidAt
          ? `Elle a été payée en ligne : votre client est remboursé automatiquement (${fcfa(grandTotal(rejecting) ?? articlesTotal(rejecting))}).`
          : 'Votre client ne sera pas livré. Il est prévenu par SMS.'}
        footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Ne pas refuser</Button><Button variant="danger" loading={busy} onClick={reject}>Refuser la commande</Button></>} />
    </div>
  )
}

function RequestDrawer({ r, onClose, onValidate, onReject }) {
  const delivery = r ? deliveryOf(r) : null
  const total = r ? grandTotal(r) : null
  const pickup = r?.pickupAddress ?? null
  return (
    <Drawer open={!!r} onClose={onClose} width={520} label="Détail de la commande">
      {r && (
        <>
          <div className="dl-dhead">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="label-caps">Commande reçue</span>
              <div className="dl-dtitle">{r.customerName || 'Client'}</div>
              <div className="dl-dmeta"><PayBadge r={r} /><span className="muted">Reçue le {dateTime(r.createdAt)}</span></div>
            </div>
            <IconButton icon={X} label="Fermer" size="sm" variant="plain" onClick={onClose} />
          </div>

          <div className="scroll-y dl-dbody">
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
                : <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>La livraison est calculée quand vous lancez la course.</div>}
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

            {statusOf(r) !== 'PENDING' && (
              <section className="dl-sec muted" style={{ fontSize: 13 }}>
                {statusOf(r) === 'CONFIRMED' ? 'Validée' : 'Refusée'}{r.handledByName ? ` par ${r.handledByName}` : ''}{handledAt(r) ? ` le ${dateTime(handledAt(r))}` : ''}.
              </section>
            )}
          </div>

          {statusOf(r) === 'PENDING' && (
            <div className="dl-dfoot">
              <button type="button" className="dl-cancel-link" onClick={() => onReject(r)}><XCircle size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />Refuser</button>
              <div style={{ flex: 1 }} />
              <Button size="sm" icon={CheckCircle2} onClick={() => onValidate(r)}>Valider et lancer la livraison</Button>
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
