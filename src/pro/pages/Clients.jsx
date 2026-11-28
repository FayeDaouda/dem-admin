import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, Users, Phone, MessageCircle, Plus, Download, Lock, ChevronRight, ChevronLeft, X, MapPin, Repeat, ShoppingBag, Wallet,
} from 'lucide-react'
import proApi from '../lib/proApi'
import { TZ, fcfa, orderTotal, phoneFmt, timeAgo } from '../lib/format'
import { Button, Card, Drawer, Empty, ErrorState, IconButton, PageHeader, Segmented, Skeleton, StatCard } from '../ui/ui'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { ReceiptButton } from '../ui/ReceiptButton'
import { downloadCsv, csvDate, itemsTotal } from '../ui/csv'
import { loadPlan, unlockTierLabel } from '../ui/planAccess'
import '../styles/clients-stats.css'

// Clients réguliers (CRM léger), comme dem_pro_clients_screen.dart :
// GET /dem-pro/me/clients regroupe tout l'historique livré par numéro de
// destinataire (nom, commandes, montant articles + livraison, dernière
// commande). La fiche s'ouvre dans un panneau latéral (?client=+221…) avec
// l'historique (filtré depuis /orders/my, comme l'app) et « Nouvelle
// livraison » qui reprend sa dernière course (/livraisons/nouvelle?dupliquer=).
// Offre gratuite : le serveur marque `locked` au-delà de 3 clients.

const PAGE_SIZE = 25
const HISTORY_PAGES = 5 // 500 livraisons au plus pour l'historique des fiches
const SORTS = [['spent', 'Montant'], ['orders', 'Commandes'], ['recent', 'Récents']]

const digits9 = (p) => String(p ?? '').replace(/\D/g, '').slice(-9)
const displayName = (c) => (c?.name ?? '').trim() || 'Client sans nom'
const basket = (c) => (c?.orderCount ? Math.round((Number(c.totalSpent) || 0) / c.orderCount) : 0)
const shortDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '—'
const waLink = (p) => {
  const d = String(p ?? '').replace(/\D/g, '')
  return `https://wa.me/${d.length === 9 ? `221${d}` : d}`
}
function initials(c) {
  const parts = String(c?.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return digits9(c?.phone).slice(-2) || '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
const itemsLabel = (o) => (Array.isArray(o?.items) ? o.items : []).map(i => `${i.name} ×${i.quantity ?? 1}`).join(', ')

export default function Clients() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [clients, setClients] = useState(null)
  const [error, setError] = useState(null) // { locked, member, message } | { failed }
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('spent')
  const [page, setPage] = useState(1)
  const [plan, setPlan] = useState(null)
  const shown = useRef(false)
  const openPhone = params.get('client')

  const load = useCallback(async () => {
    try {
      const res = await proApi.get('/dem-pro/me/clients')
      shown.current = true
      setClients(Array.isArray(res.data) ? res.data : [])
      setError(null)
    } catch (e) {
      const r = e?.response
      // 403 : offre ou rôle d'équipe — pas une panne, jamais de « Réessayer »
      if (r?.status === 403) {
        setError({ locked: true, member: r.data?.code === 'TEAM_MANAGER_ONLY', message: r.data?.message })
      } else if (!shown.current) {
        setError({ failed: true })
      }
    }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)
  useEffect(() => { loadPlan().then(setPlan).catch(() => {}) }, [])

  // Historique des fiches : livraisons du compte, chargées à la première
  // fiche ouverte puis gardées (le quota de requêtes est partagé avec l'app)
  const [orders, setOrders] = useState(null)
  const [ordersFailed, setOrdersFailed] = useState(false)
  const ordersBusy = useRef(false)
  const loadOrders = useCallback(async () => {
    if (ordersBusy.current) return
    ordersBusy.current = true
    setOrdersFailed(false)
    try {
      const list = []
      let truncated = false
      for (let p = 1; p <= HISTORY_PAGES; p++) {
        const res = await proApi.get('/orders/my', { params: { page: p, limit: 100 } })
        list.push(...(res.data?.orders ?? []))
        const total = res.data?.totalPages ?? 1
        if (p >= total) break
        if (p === HISTORY_PAGES) truncated = true
      }
      setOrders({ list, truncated })
    } catch { setOrdersFailed(true) } finally { ordersBusy.current = false }
  }, [])
  useEffect(() => { if (openPhone && !orders) loadOrders() }, [openPhone, orders, loadOrders])

  const all = useMemo(() => clients ?? [], [clients])
  const unlocked = useMemo(() => all.filter(c => !c.locked), [all])
  const lockedCount = all.length - unlocked.length

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const nd = needle.replace(/\D/g, '')
    const rows = unlocked.filter(c => !needle
      || [c.name, c.lastAddress].some(v => String(v ?? '').toLowerCase().includes(needle))
      || (nd.length >= 2 && String(c.phone ?? '').replace(/\D/g, '').includes(nd)))
    const by = {
      spent: (a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0),
      orders: (a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0) || (b.totalSpent ?? 0) - (a.totalSpent ?? 0),
      recent: (a, b) => new Date(b.lastOrderAt ?? 0) - new Date(a.lastOrderAt ?? 0),
    }
    return [...rows].sort(by[sort])
  }, [unlocked, q, sort])

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const summary = useMemo(() => {
    const orderSum = unlocked.reduce((s, c) => s + (c.orderCount ?? 0), 0)
    const spent = unlocked.reduce((s, c) => s + (Number(c.totalSpent) || 0), 0)
    const loyal = unlocked.filter(c => (c.orderCount ?? 0) >= 2).length
    return { orderSum, spent, loyal, basket: orderSum ? Math.round(spent / orderSum) : 0 }
  }, [unlocked])

  const selected = openPhone && clients
    ? unlocked.find(c => c.phone === openPhone) ?? unlocked.find(c => digits9(c.phone) === digits9(openPhone))
    : null

  const openClient = (c) => setParams((p) => { const n = new URLSearchParams(p); n.set('client', c.phone); return n }, { replace: true })
  const closeClient = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('client'); return n }, { replace: true })
  const retry = () => { shown.current = false; setError(null); setClients(null); load() }

  const exportCsv = () => downloadCsv(
    `clients-dem-pro-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Client', 'Téléphone', 'Commandes livrées', 'Total dépensé (FCFA)', 'Panier moyen (FCFA)', 'Dernière commande', 'Dernière adresse'],
    list.map(c => [displayName(c), phoneFmt(c.phone), c.orderCount ?? 0, Math.round(Number(c.totalSpent) || 0), basket(c), csvDate(c.lastOrderAt), c.lastAddress ?? '']),
  )

  const description = error?.locked ? 'Les clients que vous livrez, avec leur historique.'
    : !clients ? 'Chargement de vos clients…'
    : all.length === 0 ? 'Vos clients apparaissent ici après leur première livraison effectuée.'
    : `${all.length} client${all.length > 1 ? 's' : ''} · ${summary.loyal} ${summary.loyal > 1 ? 'ont' : 'a'} commandé plusieurs fois`

  return (
    <div className="cs">
      <PageHeader
        eyebrow="Clients"
        title={<>Vos clients<span className="dot">.</span></>}
        description={description}
        actions={<Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>}
      />

      {error?.locked ? (
        <Card>
          <Empty icon={Lock}
            title={error.member ? 'Réservé au responsable et aux gérants' : 'Vos clients, réservés à une offre supérieure'}
            text={error.message ?? 'Passez à une offre supérieure pour retrouver tous vos clients et leur historique.'}
            action={!error.member && <Button to="/compte" arrow="right">Voir les offres</Button>} />
        </Card>
      ) : (
        <>
          {clients && all.length > 0 && lockedCount === 0 && (
            <section className="grid-stats cs-stats" aria-label="Résumé de vos clients">
              <StatCard label="Clients" icon={Users} value={all.length} sub="livrés au moins une fois" />
              <StatCard label="Clients fidèles" icon={Repeat} value={summary.loyal}
                sub={`${Math.round((summary.loyal / all.length) * 100)} % ont commandé 2 fois ou plus`} />
              <StatCard label="Commandes livrées" icon={ShoppingBag} value={summary.orderSum} sub={`pour ${fcfa(summary.spent)} au total`} />
              <StatCard label="Panier moyen" icon={Wallet} value={fcfa(summary.basket)} sub="articles et livraison compris" />
            </section>
          )}

          <Card className="dl-card" style={{ padding: 0 }}>
            <div className="dl-tools">
              <label className="dl-search">
                <Search size={16} aria-hidden />
                <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                  placeholder="Nom, téléphone, adresse…" aria-label="Rechercher un client" />
              </label>
              <div className="cs-sort">
                <span className="muted cs-sort-label">Trier par</span>
                <Segmented label="Trier les clients" value={sort} onChange={(v) => { setSort(v); setPage(1) }} options={SORTS} />
              </div>
              <Button variant="ghost" size="sm" icon={Download} className="dl-export" disabled={!list.length} onClick={exportCsv}>Exporter CSV</Button>
            </div>

            {error?.failed ? (
              <ErrorState title="Impossible de charger vos clients" onRetry={retry} />
            ) : !clients ? (
              <div style={{ padding: 20, display: 'grid', gap: 10 }} aria-busy="true">
                {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={52} />)}
              </div>
            ) : all.length === 0 ? (
              <Empty icon={Users} title="Pas encore de client"
                text="Chaque destinataire livré devient un client : vous retrouvez ici ses commandes et relancez une livraison en un clic."
                action={<Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>} />
            ) : list.length === 0 && unlocked.length > 0 ? (
              <Empty icon={Search} title="Aucun client ne correspond" text="Essayez un autre nom ou un autre numéro."
                action={<Button variant="ghost" size="sm" onClick={() => { setQ(''); setPage(1) }}>Effacer la recherche</Button>} />
            ) : (
              <>
                {/* Téléphone : cartes */}
                <ul className="dl-mlist pro-only-sm">
                  {visible.map(c => (
                    <li key={c.phone} className={`dl-mcard ${selected?.phone === c.phone ? 'is-open' : ''}`}>
                      <button type="button" className="dl-mcard-main cs-mcard" onClick={() => openClient(c)}>
                        <span className="cs-avatar" aria-hidden>{initials(c)}</span>
                        <span className="cs-mcard-body">
                          <span className="dl-mcard-mid">
                            <span className="dl-name">{displayName(c)}</span>
                            <span className="num dl-amount-m">{fcfa(c.totalSpent)}</span>
                          </span>
                          <span className="muted cs-mcard-sub">
                            {phoneFmt(c.phone)} · {c.orderCount} commande{c.orderCount > 1 ? 's' : ''} · {timeAgo(c.lastOrderAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Tablette et ordinateur : tableau */}
                <table className="dl-table cs-table pro-hide-only-sm">
                  <colgroup>
                    <col className="cs-c-client" /><col className="cs-c-n" /><col className="cs-c-amount" />
                    <col className="cs-c-basket" /><col className="cs-c-date" /><col className="cs-c-addr" /><col className="cs-c-go" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Client</th>
                      <th scope="col" className="num-col">Commandes</th>
                      <th scope="col" className="num-col">Total dépensé</th>
                      <th scope="col" className="num-col cs-c-basket">Panier moyen</th>
                      <th scope="col">Dernière commande</th>
                      <th scope="col" className="cs-c-addr">Dernière adresse</th>
                      <th scope="col"><span className="sr-only">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(c => (
                      <tr key={c.phone} tabIndex={0} aria-label={`Fiche de ${displayName(c)}`}
                        className={`dl-row ${selected?.phone === c.phone ? 'is-open' : ''}`}
                        onClick={() => openClient(c)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openClient(c) }}>
                        <td>
                          <div className="cs-who">
                            <span className="cs-avatar" aria-hidden>{initials(c)}</span>
                            <span style={{ minWidth: 0 }}>
                              <span className="dl-name dl-ellipsis">{displayName(c)}</span>
                              <span className="muted dl-sub dl-ellipsis">{phoneFmt(c.phone)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="num num-col">
                          {c.orderCount}
                          {c.orderCount >= 2 && <span className="cs-loyal" title="Client fidèle">Fidèle</span>}
                        </td>
                        <td className="num num-col dl-amount">{fcfa(c.totalSpent)}</td>
                        <td className="num num-col cs-c-basket">{fcfa(basket(c))}</td>
                        <td><span className="dl-date" title={timeAgo(c.lastOrderAt)}>{shortDate(c.lastOrderAt)}</span></td>
                        <td className="cs-c-addr"><span className="dl-ellipsis muted">{c.lastAddress ?? '—'}</span></td>
                        <td className="cs-c-go"><ChevronRight size={16} color="#94A3B8" aria-hidden /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {list.length > PAGE_SIZE && (
                  <div className="dl-pager">
                    <span className="num">{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, list.length)} sur {list.length}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <IconButton icon={ChevronLeft} label="Page précédente" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} />
                      <IconButton icon={ChevronRight} label="Page suivante" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)} />
                    </div>
                  </div>
                )}
              </>
            )}

            {clients && lockedCount > 0 && (
              <Link to="/compte" className="cs-locked">
                <span className="cs-lock-ico" aria-hidden><Lock size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="cs-locked-title">+{lockedCount} autre{lockedCount > 1 ? 's' : ''} client{lockedCount > 1 ? 's' : ''}</span>
                  <span className="cs-locked-text">
                    Débloquez la liste complète {plan ? `avec l'offre ${unlockTierLabel(plan, 'crmEnabled')}` : 'avec une offre supérieure'}.
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </Link>
            )}
          </Card>
        </>
      )}

      {selected && (
        <ClientDrawer key={selected.phone} client={selected} orders={orders} ordersFailed={ordersFailed}
          onRetryOrders={loadOrders} onClose={closeClient} />
      )}
    </div>
  )
}

// ── Fiche client ─────────────────────────────────────────────────────────────
function ClientDrawer({ client: c, orders, ordersFailed, onRetryOrders, onClose }) {
  const navigate = useNavigate()
  const history = useMemo(() => {
    if (!orders) return null
    const key = digits9(c.phone)
    return orders.list
      .filter(o => o.status === 'DELIVERED' && digits9(o.receiverPhone) === key)
      .sort((a, b) => new Date(b.deliveredAt ?? b.createdAt) - new Date(a.deliveredAt ?? a.createdAt))
  }, [orders, c.phone])
  const latest = history?.[0]
  const first = history?.length ? history[history.length - 1] : null
  const historyLoading = !history && !ordersFailed

  const relaunch = () => navigate(latest ? `/livraisons/nouvelle?dupliquer=${latest.id}` : '/livraisons/nouvelle')

  return (
    <Drawer open onClose={onClose} width={560} label={`Fiche client : ${displayName(c)}`}>
      <div className="dl-dhead">
        <span className="cs-avatar lg" aria-hidden>{initials(c)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="label-caps">Client</span>
          <div className="dl-dtitle">{displayName(c)}</div>
          <div className="dl-dmeta">
            <a className="link" href={`tel:${c.phone}`}>{phoneFmt(c.phone)}</a>
            {c.orderCount >= 2 && <span className="cs-loyal">Client fidèle</span>}
          </div>
        </div>
        <IconButton icon={X} label="Fermer" size="sm" variant="plain" onClick={onClose} />
      </div>

      <div className="scroll-y dl-dbody">
        <div className="cs-kpis">
          <div><span className="label-caps">Commandes</span><strong className="num">{c.orderCount ?? 0}</strong></div>
          <div><span className="label-caps">Total dépensé</span><strong className="num">{fcfa(c.totalSpent)}</strong></div>
          <div><span className="label-caps">Panier moyen</span><strong className="num">{fcfa(basket(c))}</strong></div>
          <div>
            <span className="label-caps">Dernière commande</span>
            <strong>{shortDate(c.lastOrderAt)}</strong>
            {first && <small className="muted">client depuis le {shortDate(first.deliveredAt ?? first.createdAt)}</small>}
          </div>
        </div>

        <section className="dl-sec">
          <Button icon={Plus} loading={historyLoading} onClick={relaunch} style={{ width: '100%' }}>Nouvelle livraison pour ce client</Button>
          <p className="muted cs-help">
            {historyLoading ? 'Recherche de sa dernière livraison…'
              : latest ? 'Reprend l\'adresse, le repère et les articles de sa dernière livraison : modifiez ce qui change.'
              : 'Aucune livraison retrouvée à reprendre : saisissez son adresse.'}
          </p>
          <div className="cs-contact">
            <Button variant="ghost" size="sm" icon={Phone} href={`tel:${c.phone}`}>Appeler</Button>
            <Button variant="ghost" size="sm" icon={MessageCircle} href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</Button>
          </div>
        </section>

        {c.lastAddress && (
          <section className="dl-sec">
            <h3 className="label-caps dl-sec-title">Dernière adresse</h3>
            <p className="cs-addr"><MapPin size={16} aria-hidden /> <span>{c.lastAddress}</span></p>
          </section>
        )}

        <section className="dl-sec cs-history">
          <h3 className="label-caps dl-sec-title">
            Historique{history ? ` · ${history.length} livraison${history.length > 1 ? 's' : ''}` : ''}
          </h3>
          {ordersFailed ? (
            <ErrorState compact title="Historique indisponible" onRetry={onRetryOrders} />
          ) : !history ? (
            <div style={{ display: 'grid', gap: 8 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={52} />)}</div>
          ) : history.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Aucune livraison livrée retrouvée{orders?.truncated ? ' parmi vos 500 dernières' : ''}.
            </p>
          ) : (
            <>
              <ul className="cs-hlist">
                {history.map(o => {
                  const total = orderTotal(o) + itemsTotal(o)
                  const items = itemsLabel(o)
                  return (
                    <li key={o.id}>
                      <button type="button" className="cs-hrow" onClick={() => navigate(`/livraisons?id=${o.id}`)}
                        aria-label={`Livraison du ${shortDate(o.deliveredAt ?? o.createdAt)}, ${fcfa(total)}`}>
                        <span className="cs-hmain">
                          <span className="cs-hdate">{shortDate(o.deliveredAt ?? o.createdAt)}</span>
                          <span className="muted dl-ellipsis">{items || o.deliveryAddress}</span>
                        </span>
                        <span className="num cs-hamount">{fcfa(total)}</span>
                      </button>
                      <ReceiptButton order={o} iconOnly />
                    </li>
                  )
                })}
              </ul>
              <p className="muted cs-help">Montants articles et livraison compris.{orders?.truncated ? ' Historique limité à vos 500 dernières livraisons.' : ''}</p>
            </>
          )}
        </section>
      </div>
    </Drawer>
  )
}
