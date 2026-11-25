import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { PackageCheck, Bike, Wallet, Receipt, ChevronRight, Copy, Check, ArrowUpRight } from 'lucide-react'
import proApi from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { ACTIVE_STATUSES, fcfa, greeting, orderLink, orderTotal, todayLabel, dakarDay, dakarMidnight, TZ, pctOf } from '../lib/format'
import { Button, Card, Corners, Empty, ErrorState, PageHeader, SectionTitle, Skeleton, StatCard, StatusBadge } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import StartChecklist from '../ui/StartChecklist'
import { markShopShared } from '../ui/prefs'

// Tableau de bord DEM Pro : à traiter, chiffres du jour, activité sur
// 14 jours, livraisons en cours, boutique en ligne, bilan du mois.
const safe = (p) => p.then(r => ({ ok: true, v: r.data })).catch((e) => ({ ok: false, v: null, status: e?.response?.status, message: e?.response?.data?.message }))

export default function Dashboard() {
  const { user, isOwner } = useProAuth()
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const shown = useRef(false)

  const load = useCallback(async () => {
    const [stats, orders, wallet, insights, requests] = await Promise.all([
      safe(proApi.get('/dem-pro/me/stats')),
      safe(proApi.get('/orders/my', { params: { page: 1, limit: 100 } })),
      safe(proApi.get('/users/dem-pro/wallet')),
      safe(proApi.get('/dem-pro/me/insights', { params: { period: 'this_month' } })),
      safe(proApi.get('/dem-pro/order-requests', { params: { status: 'PENDING' } })),
    ])
    // Rien d'essentiel n'a répondu : état d'erreur (si rien n'est encore
    // affiché) plutôt que des zéros trompeurs ; sinon on garde l'affichage
    if (!stats.ok && !orders.ok) { if (!shown.current) setFailed(true); return }
    shown.current = true
    setFailed(false)
    setData({
      stats: stats.v,
      orders: orders.ok ? (orders.v?.orders ?? []) : null,
      wallet: wallet.v,
      insights: insights.v, insightsOk: insights.ok,
      // 403 : bilan réservé à une offre supérieure — pas une panne, pas de « Réessayer »
      insightsLocked: insights.status === 403 ? (insights.message ?? 'Réservé aux offres Business et Premium.') : null,
      requests: (requests.v ?? []).filter(x => (x.status ?? 'PENDING') === 'PENDING'),
    })
  }, [])

  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const retry = () => { shown.current = false; setFailed(false); setData(null); load() }

  const firstName = (user?.name ?? '').split(' ')[0]
  const orders = data?.orders
  const active = useMemo(() => (orders ?? []).filter(o => ACTIVE_STATUSES.has(o.status) && o.status !== 'SCHEDULED'), [orders])
  const searching = active.filter(o => o.status === 'PENDING').length
  const deliveredYesterday = useMemo(() => {
    const y = dakarDay(dakarMidnight(1))
    return (orders ?? []).filter(o => o.status === 'DELIVERED' && dakarDay(o.deliveredAt ?? o.updatedAt ?? o.createdAt) === y).length
  }, [orders])

  const loading = !data
  const s = data?.stats
  const w = data?.wallet

  return (
    <div className="dash">
      <PageHeader
        eyebrow={<>Tableau de bord <span aria-hidden>·</span> {todayLabel()}</>}
        title={<>{greeting()}{firstName ? `, ${firstName}` : ''}<span className="dot">.</span></>}
        actions={<Button variant="ghost" to="/boutique" arrow="right">Ma boutique</Button>}
      />

      {failed ? (
        <Card><ErrorState title="Impossible de charger votre tableau de bord" onRetry={retry} /></Card>
      ) : (
        <>
          {data?.requests?.length > 0 && <ToHandle requests={data.requests} />}

          {/* Compte récent : liste de démarrage (responsable du compte seulement) */}
          {isOwner && <StartChecklist user={user} orders={data ? data.orders : undefined} />}

          <section className="grid-stats dash-stats" aria-label="Chiffres clés">
            <StatCard label="Livrées aujourd'hui" icon={PackageCheck} to="/livraisons?filtre=livrees&periode=jour" loading={loading}
              value={s ? (s.deliveriesToday?.completed ?? 0) : '—'}
              sub={orders ? `hier : ${deliveredYesterday}` : 'Indisponible'} />
            <StatCard label="En cours" icon={Bike} to="/livraisons?filtre=en-cours" loading={loading}
              value={s?.deliveriesToday?.inProgress ?? (orders ? active.length : '—')}
              sub={!orders ? 'Indisponible' : searching > 0 ? `dont ${searching} en recherche de coursier` : active.length ? 'Toutes prises en charge' : 'Aucune livraison en cours'} />
            <StatCard label="Dépensé ce mois" icon={Receipt} to="/livraisons?periode=30j" loading={loading}
              value={s ? fcfa(s.spendingMonth) : '—'}
              sub={s ? `aujourd'hui : ${fcfa(s.spendingToday)}` : 'Indisponible'} />
            <StatCard label="Solde retirable" icon={Wallet} to="/wallet" loading={loading}
              value={w ? fcfa(w.withdrawableBalance) : '—'}
              sub={w ? `total : ${fcfa(w.balance)}` : 'Indisponible'} />
          </section>

          <div className="dash-grid">
            <div className="dash-col">
              <ActivityChart orders={orders} loading={loading} />
              <ActiveOrders orders={active} loading={loading} failed={!!data && !orders} onRetry={retry} />
            </div>
            <div className="dash-col">
              <ShopCard user={user} />
              <Insights insights={data?.insights} loading={loading} failed={!!data && !data.insightsOk && !data.insightsLocked} locked={data?.insightsLocked} onRetry={retry} />
            </div>
          </div>
        </>
      )}
      <style>{DASH_CSS}</style>
    </div>
  )
}

// ── À traiter : commandes reçues en attente de validation ─────────────────
function ToHandle({ requests }) {
  const n = requests.length
  const r = requests[0]
  const amount = r?.total ?? r?.productAmount
  const detail = [r?.customerName, amount != null ? fcfa(amount) : null, r?.paidAt ? 'payée en ligne' : 'paiement à la livraison'].filter(Boolean).join(' · ')
  return (
    <section className="card has-corners dash-todo" aria-label="À traiter">
      <Corners />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>À traiter</p>
        <p className="dash-todo-title">
          {n === 1 ? '1 commande attend votre validation' : `${n} commandes attendent votre validation`}
        </p>
        <p className="muted dash-todo-detail">{n > 1 ? `La plus récente : ${detail}` : detail}</p>
      </div>
      <Button to="/commandes" arrow="right">{n === 1 ? 'Voir la commande' : 'Voir les commandes'}</Button>
    </section>
  )
}

// ── Activité : livraisons effectuées sur 14 jours ─────────────────────────
function ActivityChart({ orders, loading }) {
  const series = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = dakarMidnight(13 - i)
      return {
        key: dakarDay(d),
        label: i === 13 ? 'Auj.' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ }),
        full: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }),
        livrees: 0, montant: 0, today: i === 13,
      }
    })
    for (const o of orders ?? []) {
      if (o.status !== 'DELIVERED') continue
      const k = dakarDay(o.deliveredAt ?? o.updatedAt ?? o.createdAt)
      const row = days.find(d => d.key === k)
      if (row) { row.livrees++; row.montant += orderTotal(o) }
    }
    return days
  }, [orders])
  // Une étiquette sur deux, aujourd'hui toujours étiquetée
  const ticks = series.filter((_, i) => (13 - i) % 2 === 0).map(d => d.label)
  const total = series.reduce((n, d) => n + d.livrees, 0)
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="section-title">Livraisons effectuées</h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>14 derniers jours</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {loading ? <Skeleton w={120} h={28} /> : orders && (
            <div className="num dash-kpi">{total}<span> livraison{total > 1 ? 's' : ''}</span></div>
          )}
        </div>
      </div>
      <div style={{ height: 220 }}>
        {loading ? <Skeleton h={210} /> : !orders ? (
          <ErrorState compact title="Activité indisponible" text={null} />
        ) : (
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: -12 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#EEF2F6" />
              <XAxis dataKey="label" ticks={ticks} interval={0} tickLine={false} axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fontSize: 11.5, fill: '#64748B', fontFamily: 'DM Sans' }} />
              <YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} tickLine={false} axisLine={false} width={40}
                tick={{ fontSize: 11.5, fill: '#64748B', fontFamily: 'DM Sans' }} />
              <Tooltip cursor={{ fill: 'rgba(2, 21, 32, .04)' }} content={<ChartTip />} />
              <Bar dataKey="livrees" maxBarSize={22} radius={0} isAnimationActive={false}>
                {series.map(d => <Cell key={d.key} fill={d.today ? '#00D2FF' : '#021520'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#021520', color: '#fff', padding: '10px 12px', fontSize: 12.5, fontFamily: 'DM Sans', minWidth: 150 }}>
      <div style={{ color: '#94A3B8', textTransform: 'capitalize', marginBottom: 4 }}>{d.full}</div>
      <div style={{ fontWeight: 700 }}>{d.livrees} livraison{d.livrees > 1 ? 's' : ''}</div>
      {d.montant > 0 && <div style={{ color: '#CBD5E1' }}>{fcfa(d.montant)}</div>}
    </div>
  )
}

// ── Livraisons en cours ───────────────────────────────────────────────────
function ActiveOrders({ orders, loading, failed, onRetry }) {
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 className="section-title">Livraisons en cours</h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Mises à jour en direct</div>
        </div>
        {!loading && !failed && orders.length > 0 && <span className="badge num" style={{ background: 'var(--p-slate-bg)', color: 'var(--p-slate)' }}>{orders.length}</span>}
      </div>
      {loading ? (
        <div style={{ padding: '0 24px 20px', display: 'grid', gap: 8 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={48} />)}</div>
      ) : failed ? (
        <ErrorState compact title="Livraisons indisponibles" onRetry={onRetry} />
      ) : orders.length === 0 ? (
        <div style={{ borderTop: '1px solid var(--p-line)' }}>
          <Empty icon={Bike} title="Aucune livraison en cours"
            text="Créez une livraison : un coursier DEM récupère le colis chez vous et le livre à votre client."
            action={<Button to="/livraisons/nouvelle" arrow="right">Nouvelle livraison</Button>} />
        </div>
      ) : (
        <>
          <ul className="dash-list">
            {orders.slice(0, 6).map(o => (
              <li key={o.id}>
                <Link to={`/livraisons?id=${o.id}`} className="dash-row">
                  <span className="dash-row-main">
                    <span className="dash-row-name">{o.receiverName || 'Client'}</span>
                    <span className="dash-row-addr">{o.deliveryAddress}</span>
                  </span>
                  <span className="dash-row-driver">{o.driver?.name ?? 'Recherche d\'un coursier'}</span>
                  <StatusBadge status={o.status} />
                  <ChevronRight size={16} color="#94A3B8" aria-hidden style={{ flexShrink: 0 }} />
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--p-line)' }}>
            <Link to="/livraisons" className="link-caps">
              {orders.length > 6 ? `Voir les ${orders.length} livraisons en cours` : 'Voir toutes les livraisons'}
              <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Boutique en ligne : lien de commande ──────────────────────────────────
function ShopCard({ user }) {
  const notify = useNotify()
  const [copied, setCopied] = useState(false)
  const link = user?.id ? orderLink(user.id) : null
  const id = user?.id ?? ''
  const short = link ? link.replace(/^https?:\/\/(www\.)?/, '').replace(id, `${id.slice(0, 4)}…${id.slice(-4)}`) : '…'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true); markShopShared(user?.id); notify.success('Lien copié', 'Partagez-le sur WhatsApp, Instagram ou par SMS.')
      setTimeout(() => setCopied(false), 1800)
    } catch { notify.error('Copie impossible', 'Sélectionnez le lien et copiez-le à la main.') }
  }
  return (
    <Card>
      <SectionTitle title="Votre boutique en ligne" hint="Votre lien de commande" />
      <div className="dash-link">
        <span className="mono dash-link-text" title={link ?? ''}>{short}</span>
        <button type="button" className="icon-btn sm plain" onClick={copy} disabled={!link} aria-label={copied ? 'Lien copié' : 'Copier le lien'} title={copied ? 'Copié' : 'Copier le lien'}>
          {copied ? <Check size={15} color="var(--p-success)" aria-hidden /> : <Copy size={15} aria-hidden />}
        </button>
        <a className="icon-btn sm plain" href={link ?? undefined} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ma boutique" title="Ouvrir ma boutique">
          <ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>
        {copied
          ? <span role="status" style={{ color: 'var(--p-success)', fontWeight: 600 }}>Copié. Collez-le dans WhatsApp, Instagram ou un SMS.</span>
          : 'Partagez ce lien : vos clients commandent, vous validez, on livre.'}
      </p>
    </Card>
  )
}

// ── Bilan du mois ─────────────────────────────────────────────────────────

function Insights({ insights, loading, failed, locked, onRetry }) {
  const pct = insights?.trend?.countTrendPct
  const cancel = pctOf(insights?.cancellationRate)
  const top = insights?.topDestinations?.[0]
  const product = insights?.topProduct
  return (
    <Card>
      <SectionTitle title="Ce mois-ci" hint={insights?.period?.label} style={{ marginBottom: 8 }} />
      {loading ? <div style={{ display: 'grid', gap: 12, paddingTop: 8 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={18} />)}</div>
        : locked ? (
          <div style={{ display: 'grid', gap: 10, paddingTop: 8 }}>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{locked}</p>
            <Link className="link" to="/compte">Voir mon offre</Link>
          </div>
        ) : failed ? <ErrorState compact title="Bilan indisponible" onRetry={onRetry} /> : (
          <dl className="dash-dl">
            <div>
              <dt>Livraisons créées</dt>
              <dd className="num">
                {insights?.totalOrdersCreated ?? 0}
                {pct != null && <span className="dash-trend" style={{ color: pct >= 0 ? 'var(--p-success)' : 'var(--p-danger)' }}>{pct >= 0 ? '+' : ''}{Math.round(pct)}&nbsp;%</span>}
              </dd>
            </div>
            <div>
              <dt>Durée moyenne</dt>
              <dd className="num">{insights?.avgDeliveryMinutes ? `${Math.round(insights.avgDeliveryMinutes)}\u00a0min` : '—'}</dd>
            </div>
            <div>
              <dt>Taux d'annulation</dt>
              <dd className="num" style={{ color: cancel > 20 ? 'var(--p-danger)' : undefined }}>{cancel.toLocaleString('fr-FR')}&nbsp;%</dd>
            </div>
            {top && (
              <div>
                <dt>Destination n°&nbsp;1</dt>
                <dd title={top.label ?? top.address}>{top.label ?? top.address ?? '—'}</dd>
              </div>
            )}
            {product && (
              <div>
                <dt>Produit star</dt>
                <dd>{product.name ?? product}</dd>
              </div>
            )}
          </dl>
        )}
    </Card>
  )
}

const DASH_CSS = `
.pro .dash { max-width: 1440px; }
.pro .dash-stats { margin-bottom: 20px; }
.pro .dash-todo { display: flex; align-items: center; gap: 24px; padding: 20px 24px; margin-bottom: 20px; flex-wrap: wrap; border-color: var(--p-dark); }
.pro .dash-todo-title { margin: 0; font: 700 18px/1.3 var(--p-head); color: var(--p-ink); }
.pro .dash-todo-detail { margin: 4px 0 0; font-size: 13.5px; }
.pro .dash-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.pro .dash-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; min-width: 0; }
@media (min-width: 1600px) { .pro .dash-grid { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); } }
@media (max-width: 1100px) { .pro .dash-grid { grid-template-columns: minmax(0, 1fr); } }
.pro .dash-kpi { font: 700 28px/1 var(--p-head); color: var(--p-ink); white-space: nowrap; }
.pro .dash-kpi span { font: 500 13px var(--p-body); color: var(--p-muted); }
.pro .dash-list { list-style: none; margin: 0; padding: 0; }
.pro .dash-row {
  display: flex; align-items: center; gap: 16px; min-height: 60px; padding: 10px 24px; color: inherit; text-decoration: none;
  border-top: 1px solid var(--p-line); transition: background var(--p-fast);
}
.pro .dash-row:hover { background: var(--p-soft); }
.pro .dash-row:focus-visible { outline-offset: -2px; }
.pro .dash-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pro .dash-row-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .dash-row-addr { font-size: 13px; color: var(--p-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .dash-row-driver { width: 160px; flex-shrink: 0; font-size: 13px; color: var(--p-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .dash-link { display: flex; align-items: center; gap: 4px; height: 44px; padding: 0 6px 0 14px; border: 1px solid var(--p-line-2); background: var(--p-soft); }
.pro .dash-link-text { flex: 1; min-width: 0; font-size: 13px; color: var(--p-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .dash-dl { margin: 0; }
.pro .dash-dl > div { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--p-line); }
.pro .dash-dl > div:first-child { border-top: none; }
.pro .dash-dl dt { font-size: 13px; color: var(--p-muted); }
.pro .dash-dl dd { margin: 0; font-size: 14px; font-weight: 600; text-align: right; min-width: 0; max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .dash-trend { margin-left: 8px; font-size: 12px; font-weight: 700; }
@media (max-width: 720px) {
  .pro .dash-row { padding: 10px 16px; gap: 12px; }
  .pro .dash-row-driver { display: none; }
  .pro .dash-todo { padding: 18px 16px; }
  .pro .dash-todo .btn { width: 100%; }
}
@media (max-width: 560px) {
  .pro .dash-stats { gap: 10px; }
  .pro .dash-stats .stat-card { padding: 14px; gap: 8px; }
  .pro .dash-stats .stat-value { font-size: 22px; }
  .pro .dash-stats .stat-sub { font-size: 12px; }
}
`
