import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  Plus, PackageCheck, Bike, Wallet, TrendingUp, TrendingDown, ArrowRight, Copy, Check, ExternalLink, Store, Clock,
  MapPin, Inbox, Sparkles,
} from 'lucide-react'
import proApi from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { ACTIVE_STATUSES, ORDER_STATUS, fcfa, greeting, orderLink, orderTotal, timeAgo, todayLabel } from '../lib/format'
import { Button, Card, CountUp, Empty, SectionTitle, Skeleton, StatusBadge } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

export default function Dashboard() {
  const { user } = useProAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    const [stats, orders, wallet, insights, requests] = await Promise.all([
      proApi.get('/dem-pro/me/stats').then(r => r.data).catch(() => null),
      proApi.get('/orders/my', { params: { page: 1, limit: 100 } }).then(r => r.data.orders ?? []).catch(() => []),
      proApi.get('/users/dem-pro/wallet').then(r => r.data).catch(() => null),
      proApi.get('/dem-pro/me/insights', { params: { period: 'this_month' } }).then(r => r.data).catch(() => null),
      proApi.get('/dem-pro/order-requests', { params: { status: 'PENDING' } }).then(r => r.data ?? []).catch(() => []),
    ])
    setData({ stats, orders, wallet, insights, requests: requests.filter(x => (x.status ?? 'PENDING') === 'PENDING') })
  }, [])

  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const firstName = (user?.name ?? '').split(' ')[0]
  const active = useMemo(() => (data?.orders ?? []).filter(o => ACTIVE_STATUSES.has(o.status)), [data])

  return (
    <div>
      {/* ── En-tête ── */}
      <div className="anim-up" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{todayLabel()}</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.8px', margin: '4px 0 0' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
        </div>
        <Button variant="ghost" icon={Store} onClick={() => navigate('/boutique')}>Ma boutique</Button>
        <Button icon={Plus} onClick={() => navigate('/livraisons/nouvelle')}>Nouvelle livraison</Button>
      </div>

      {/* ── Indicateurs ── */}
      <div className="grid-stats stagger" style={{ marginBottom: 20 }}>
        <Kpi icon={PackageCheck} color="#16a34a" label="Livrées aujourd'hui" loading={!data}
          value={data?.stats?.deliveriesToday?.completed} />
        <Kpi icon={Bike} color="#0cb8de" label="En cours" loading={!data} live={active.length > 0}
          value={data?.stats?.deliveriesToday?.inProgress ?? active.length} />
        <Kpi icon={TrendingUp} color="#6d5dfc" label="Dépensé en livraisons" loading={!data} money
          value={data?.stats?.spendingMonth} sub={data ? `Ce mois · ${fcfa(data.stats?.spendingToday)} aujourd'hui` : null} />
        <Kpi icon={Wallet} color="#04317c" label="Solde retirable" loading={!data} money
          value={data?.wallet?.withdrawableBalance} sub={data?.wallet ? `${fcfa(data.wallet.balance)} au total` : null}
          onClick={() => navigate('/wallet')} />
      </div>

      <div className="grid-main">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
          <ActivityChart orders={data?.orders} loading={!data} />
          <ActiveOrders orders={active} loading={!data} onOpen={(id) => navigate(`/livraisons?id=${id}`)} onNew={() => navigate('/livraisons/nouvelle')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
          {data?.requests?.length > 0 && <RequestsCallout count={data.requests.length} onOpen={() => navigate('/commandes')} />}
          <ShopCard user={user} />
          <Insights insights={data?.insights} loading={!data} />
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, color, label, value, money, sub, loading, live, onClick }) {
  return (
    <KpiBox icon={icon} onClick={onClick} color={color} label={label} live={live}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.8px', marginTop: 14, color: 'var(--p-ink)' }}>
        {loading ? <Skeleton w={110} h={30} /> : money ? <CountUp value={value ?? 0} format={(v) => fcfa(v)} /> : <CountUp value={value ?? 0} />}
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4, minHeight: 18 }}>{loading ? <Skeleton w={90} h={12} /> : sub}</div>
    </KpiBox>
  )
}

function KpiBox({ icon, color, label, live, onClick, children }) {
  const Icon = icon
  return (
    <div className={`card ${onClick ? 'card-hover' : ''}`} onClick={onClick} style={{ padding: 20, cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', right: -18, top: -18, width: 96, height: 96, borderRadius: '50%', background: color + '0d' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: color + '14', color, display: 'grid', placeItems: 'center' }}><Icon size={19} /></div>
        <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        {live && <span className="live-dot" style={{ marginLeft: 'auto' }} />}
      </div>
      {children}
    </div>
  )
}

function ActivityChart({ orders, loading }) {
  const series = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i))
      return { key: d.toDateString(), label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), livrees: 0, montant: 0 }
    })
    for (const o of orders ?? []) {
      if (o.status !== 'DELIVERED') continue
      const k = new Date(o.deliveredAt ?? o.createdAt); k.setHours(0, 0, 0, 0)
      const row = days.find(d => d.key === k.toDateString())
      if (row) { row.livrees++; row.montant += orderTotal(o) }
    }
    return days
  }, [orders])
  const total = series.reduce((n, d) => n + d.livrees, 0)
  return (
    <Card className="anim-up">
      <SectionTitle title="Livraisons effectuées" hint={loading ? ' ' : `${total} livrée${total > 1 ? 's' : ''} sur les 14 derniers jours`} />
      <div style={{ height: 220, marginLeft: -12 }}>
        {loading ? <Skeleton h={200} r={14} /> : (
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="proArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0cb8de" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0cb8de" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#8a9ab0' }} interval={1} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#8a9ab0' }} width={36} />
              <Tooltip cursor={{ stroke: '#0cb8de', strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 12, border: '1px solid #e6ebf3', boxShadow: '0 12px 32px rgba(11,27,51,.12)', fontFamily: 'Plus Jakarta Sans', fontSize: 12.5 }}
                formatter={(v, n) => n === 'livrees' ? [`${v} livraison${v > 1 ? 's' : ''}`, 'Livrées'] : [fcfa(v), 'Montant']} />
              <Area type="monotone" dataKey="livrees" stroke="#0671ba" strokeWidth={2.5} fill="url(#proArea)" animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

function ActiveOrders({ orders, loading, onOpen, onNew }) {
  return (
    <Card className="anim-up" style={{ padding: 0 }}>
      <div style={{ padding: '20px 22px 6px' }}>
        <SectionTitle title="Livraisons en cours" hint="Mises à jour en direct" style={{ marginBottom: 6 }} />
      </div>
      {loading ? (
        <div style={{ padding: 22, display: 'grid', gap: 12 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={58} r={14} />)}</div>
      ) : orders.length === 0 ? (
        <Empty icon={Bike} title="Aucune livraison en cours" text="Créez une livraison : un coursier DEM vient chercher le colis et le livre à votre client." action={<Button icon={Plus} onClick={onNew}>Nouvelle livraison</Button>} />
      ) : (
        <div className="stagger">
          {orders.slice(0, 6).map(o => (
            <div key={o.id} className="row-hover" onClick={() => onOpen(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', cursor: 'pointer', borderTop: '1px solid var(--p-line)' }}>
              <Progress status={o.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.receiverName || 'Client'} · {o.deliveryAddress}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{o.driver?.name ? `Coursier : ${o.driver.name}` : 'Recherche d\'un coursier proche'} · {timeAgo(o.createdAt)}</div>
              </div>
              <StatusBadge status={o.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// Petite jauge : recherche → en route → récupéré → livré
function Progress({ status }) {
  const step = ORDER_STATUS[status]?.step ?? 0
  return (
    <div style={{ display: 'flex', gap: 3 }} aria-hidden>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 18, height: 6, borderRadius: 3, background: i < step || (i === step && step > 0) ? 'var(--p-cyan)' : i === step ? '#ffd28a' : '#e6ebf3', transition: 'background .4s' }} />
      ))}
    </div>
  )
}

function RequestsCallout({ count, onOpen }) {
  return (
    <div className="card card-hover anim-up" onClick={onOpen} style={{ padding: 18, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', background: 'linear-gradient(135deg, #6d5dfc, #4f46e5)', color: '#fff', border: 'none' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}><Inbox size={22} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>{count} commande{count > 1 ? 's' : ''} à valider</div>
        <div style={{ fontSize: 12.5, opacity: .8 }}>Reçue{count > 1 ? 's' : ''} par votre lien de commande</div>
      </div>
      <ArrowRight size={18} />
    </div>
  )
}

function ShopCard({ user }) {
  const notify = useNotify()
  const [copied, setCopied] = useState(false)
  const link = user?.id ? orderLink(user.id) : null
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); notify.success('Lien copié', 'Partagez-le sur WhatsApp, Instagram ou par SMS.'); setTimeout(() => setCopied(false), 1800) } catch { /* ignoré */ }
  }
  return (
    <div className="card anim-up" style={{ padding: 22, background: 'linear-gradient(150deg, #04317c 0%, #021b47 100%)', color: '#fff', border: 'none', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(12,184,222,.45), transparent 70%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center' }}><Store size={20} /></div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Votre boutique en ligne</div>
          <div style={{ fontSize: 12.5, opacity: .7 }}>Vos clients commandent et paient en ligne</div>
        </div>
      </div>
      <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.08)', fontSize: 12.5, fontWeight: 600, wordBreak: 'break-all', position: 'relative' }}>{link ?? '…'}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, position: 'relative' }}>
        <button className="btn btn-sm" style={{ background: '#fff', color: '#04317c', flex: 1 }} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copié' : 'Copier le lien'}</button>
        <a className="btn btn-sm" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }} href={link ?? '#'} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Voir</a>
      </div>
    </div>
  )
}

function Insights({ insights, loading }) {
  const t = insights?.trend
  const pct = t?.countTrendPct
  return (
    <Card className="anim-up">
      <SectionTitle title="Ce mois-ci" hint={insights?.period?.label} />
      {loading ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={44} r={12} />)}</div> : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Line icon={Bike} label="Livraisons créées" value={insights?.totalOrdersCreated ?? 0}
            extra={pct != null && <Trend pct={pct} />} />
          <Line icon={Clock} label="Durée moyenne" value={insights?.avgDeliveryMinutes ? `${Math.round(insights.avgDeliveryMinutes)} min` : '—'} />
          <Line icon={TrendingDown} label="Taux d'annulation" value={`${pctOf(insights?.cancellationRate)} %`} />
          {insights?.topDestinations?.[0] && <Line icon={MapPin} label="Destination n° 1" value={insights.topDestinations[0].label ?? insights.topDestinations[0].address ?? '—'} />}
          {insights?.topProduct && <Line icon={Sparkles} label="Produit star" value={insights.topProduct.name ?? insights.topProduct} />}
        </div>
      )}
    </Card>
  )
}

// Le serveur donne un taux entre 0 et 1, ou déjà en %
const pctOf = (r) => Math.round((r ?? 0) <= 1 ? (r ?? 0) * 100 : r)

function Line({ icon, label, value, extra }) {
  const Icon = icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--p-soft)' }}>
      <Icon size={17} color="var(--p-cyan-2)" />
      <span className="muted" style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 13.5, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      {extra}
    </div>
  )
}

function Trend({ pct }) {
  const up = pct >= 0
  return <span style={{ fontSize: 11.5, fontWeight: 800, color: up ? 'var(--p-success)' : 'var(--p-danger)' }}>{up ? '+' : ''}{Math.round(pct)} %</span>
}
