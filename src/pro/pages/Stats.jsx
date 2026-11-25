import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingBag, Wallet, Bike, Download, FileText, Lock, ChevronRight, Check, Star, Inbox,
} from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { TZ, dateTime, fcfa, num, phoneFmt } from '../lib/format'
import { Button, Card, Corners, Empty, ErrorState, Modal, PageHeader, SectionTitle, Segmented, Skeleton, StatCard } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { downloadCsv, csvDate, itemsTotal } from '../ui/csv'
import { featureUnlocked, loadPlan } from '../ui/planAccess'
import '../styles/clients-stats.css'

// Statistiques par période, comme l'onglet Finances de l'app (_FinancesTab,
// DemProSalesInsights) — mêmes routes, mêmes périodes :
//   GET /dem-pro/me/sales?period=…     ventes (articles des courses livrées)
//   GET /dem-pro/me/finances?period=…  dépenses de livraison + détail
//   GET /dem-pro/me/insights?period=…  activité (délais, annulations…)
// period ∈ today | this_week | this_month | 3months | 6months.
// 403 = offre (Starter) ou rôle d'équipe : message + lien vers l'offre,
// jamais de « Réessayer ». Le serveur peut raccourcir la période selon
// l'offre (periodClampedFrom) : on le dit au commerçant.

const PERIODS = [
  ['today', 'Jour'],
  ['this_week', 'Semaine'],
  ['this_month', 'Mois'],
  ['3months', '3 mois'],
  ['6months', '6 mois'],
]
const PERIOD_LABEL = Object.fromEntries(PERIODS)
const DEFAULT_PERIOD = 'this_month'

const safe = (p) => p.then(r => ({ ok: true, v: r.data }))
  .catch((e) => ({ ok: false, v: null, status: e?.response?.status, code: e?.response?.data?.code, message: e?.response?.data?.message }))

const fmtPct = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${(Math.round(Math.abs(n) * 10) / 10).toLocaleString('fr-FR')}\u00a0%`
const shortDay = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TZ })
const plural = (n, one, many) => `${num(n)} ${n > 1 ? many : one}`

export default function Stats() {
  const { user } = useProAuth()
  const notify = useNotify()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const period = PERIODS.some(([k]) => k === params.get('periode')) ? params.get('periode') : DEFAULT_PERIOD
  const [data, setData] = useState(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState('amount')
  const [exporting, setExporting] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchLocked, setBatchLocked] = useState(null)
  const [plan, setPlan] = useState(null)
  const seq = useRef(0)

  const load = useCallback(async (p) => {
    const n = ++seq.current
    setPending(true)
    const [finances, sales, insights] = await Promise.all([
      safe(proApi.get('/dem-pro/me/finances', { params: { period: p } })),
      safe(proApi.get('/dem-pro/me/sales', { params: { period: p } })),
      safe(proApi.get('/dem-pro/me/insights', { params: { period: p } })),
    ])
    // Période raccourcie par l'offre : les ventes (non raccourcies côté
    // serveur) sont relues sur la même période, pour des chiffres cohérents
    const effective = finances.v?.period?.key ?? insights.v?.period?.key
    let salesRes = sales
    if (effective && effective !== p && sales.ok) {
      salesRes = await safe(proApi.get('/dem-pro/me/sales', { params: { period: effective } }))
    }
    if (n !== seq.current) return
    setData({ key: p, finances, sales: salesRes, insights })
    setPending(false)
  }, [])

  useEffect(() => { load(period) }, [period, load])
  const refresh = useCallback(() => load(period), [load, period])
  useLiveRefresh(refresh, { delayMs: 1500 })
  useEffect(() => { loadPlan().then(setPlan).catch(() => {}) }, [])

  const setPeriod = (p) => {
    const next = new URLSearchParams(params)
    if (p === DEFAULT_PERIOD) next.delete('periode'); else next.set('periode', p)
    setParams(next, { replace: true })
  }

  const results = data ? [data.finances, data.sales, data.insights] : []
  const allLocked = !!data && results.every(r => r.status === 403)
  const member = results.some(r => r.code === 'TEAM_MANAGER_ONLY')
  const allFailed = !!data && results.every(r => !r.ok && r.status !== 403)
  const fin = data?.finances.ok ? data.finances.v : null
  const sal = data?.sales.ok ? data.sales.v : null
  const ins = data?.insights.ok ? data.insights.v : null
  const loading = !data
  const effective = fin?.period ?? ins?.period ?? sal?.period
  const clampedFrom = fin?.periodClampedFrom ?? ins?.periodClampedFrom
  const lockMsg = (r) => (r?.status === 403 ? (r.message ?? 'Réservé à une offre supérieure.') : null)
  const batchAllowed = plan ? featureUnlocked(plan, 'invoiceBatchEnabled', { legacyOk: false }) : true

  // ── Export CSV comptable (mêmes colonnes que l'app) ──
  const exportCsv = async () => {
    if (!fin?.period) return
    setExporting(true)
    try {
      const from = new Date(fin.period.from)
      const to = new Date(Math.max(new Date(fin.period.to).getTime(), Date.now()))
      const orders = []
      for (let p = 1; p <= 10; p++) {
        const res = await proApi.get('/orders/my', { params: { page: p, limit: 100 } })
        const batch = res.data?.orders ?? []
        orders.push(...batch)
        if (p >= (res.data?.totalPages ?? 1)) break
        // Liste récente d'abord : au-delà d'un mois avant la période, plus rien à prendre
        if (batch.length && batch.every(o => new Date(o.createdAt) < new Date(from.getTime() - 31 * 86400e3))) break
      }
      const rows = orders
        .filter(o => o.status === 'DELIVERED' && o.deliveredAt && new Date(o.deliveredAt) >= from && new Date(o.deliveredAt) <= to)
        .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))
      if (!rows.length) { notify.info('Rien à exporter', 'Aucune livraison effectuée sur cette période.'); return }
      downloadCsv(
        `statistiques-dem-pro-${fin.period.key}-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Référence', 'Date livraison', 'Adresse départ', 'Adresse livraison', 'Destinataire', 'Téléphone', 'Articles', 'Type',
          'Montant produits (FCFA)', 'Frais livraison (FCFA)', 'Total (FCFA)', 'Livreur'],
        rows.map(o => {
          const products = itemsTotal(o)
          const delivery = (Number(o.price) || 0) + (Number(o.demFee) || 0) - (Number(o.discountAmount) || 0)
          return [
            String(o.id).slice(0, 8).toUpperCase(), csvDate(o.deliveredAt), o.pickupAddress ?? '', o.deliveryAddress ?? '',
            o.receiverName ?? '', phoneFmt(o.receiverPhone),
            (Array.isArray(o.items) ? o.items : []).map(i => `${i.name} x${i.quantity ?? 1}`).join(' | '),
            o.priority === 'EXPRESS' ? 'Express' : 'Simple', products, delivery, products + delivery, o.driver?.name ?? '',
          ]
        }),
      )
      notify.success('Export prêt', `${plural(rows.length, 'livraison exportée', 'livraisons exportées')}.`)
    } catch (e) { notify.error('Export impossible', errMsg(e)) } finally { setExporting(false) }
  }

  // ── Facture récapitulative (offre Premium) ──
  const invoiceBatch = async () => {
    setBatchBusy(true)
    try {
      const res = await proApi.get('/dem-pro/me/invoice-batch', { params: { period } })
      if (!res.data?.lineCount) { notify.info('Rien à facturer', 'Aucune livraison effectuée sur cette période.'); return }
      const { downloadInvoiceBatchPdf } = await import('../ui/ReceiptPdf')
      await downloadInvoiceBatchPdf(res.data, user)
      notify.success('Facture téléchargée', `${plural(res.data.lineCount, 'livraison', 'livraisons')} · ${res.data.period?.label ?? ''}`)
    } catch (e) {
      if (e?.response?.status === 403) setBatchLocked(e.response.data?.message ?? 'La facturation groupée est réservée au palier Premium.')
      else notify.error('Facture impossible', e?.response ? errMsg(e) : 'Le document n\'a pas pu être créé. Réessayez dans un instant.')
    } finally { setBatchBusy(false) }
  }

  const rangeLabel = effective?.from ? `du ${shortDay(effective.from)} au ${shortDay(effective.to)}` : null

  return (
    <div className="st">
      <PageHeader
        eyebrow="Statistiques"
        title={<>Vos chiffres<span className="dot">.</span></>}
        description="Ventes, dépenses de livraison et activité de votre boutique, sur la période choisie."
        actions={!allLocked && !member && (
          <>
            <Button variant="ghost" icon={batchAllowed ? FileText : Lock} loading={batchBusy} onClick={invoiceBatch}
              title={batchAllowed ? 'Toutes les livraisons de la période en un seul PDF' : 'Réservé à l\'offre Premium'}>
              Facture récapitulative
            </Button>
            <Button variant="ghost" icon={Download} loading={exporting} disabled={!fin} onClick={exportCsv}>Exporter CSV</Button>
          </>
        )}
      />

      {allLocked ? (
        <LockedPage member={member} message={lockMsg(data.finances) ?? lockMsg(data.sales)} navigate={navigate} />
      ) : allFailed ? (
        <Card><ErrorState title="Impossible de charger vos statistiques" onRetry={() => { setData(null); load(period) }} /></Card>
      ) : (
        <>
          <div className="st-bar">
            <Segmented label="Période" value={period} onChange={setPeriod} options={PERIODS} disabled={false} />
            <span className="muted st-range" aria-live="polite">
              {loading ? <Skeleton w={160} h={14} /> : <>{effective?.label}{rangeLabel ? <> · {rangeLabel}</> : null}</>}
            </span>
          </div>

          {clampedFrom && (
            <div className="st-clamp" role="status">
              <Lock size={16} aria-hidden />
              <span>
                Votre offre affiche les statistiques jusqu'à « {PERIOD_LABEL[effective?.key] ?? effective?.label} ».
                Pour voir « {PERIOD_LABEL[clampedFrom] ?? clampedFrom} », passez à une offre supérieure.
              </span>
              <Link className="link" to="/compte">Voir les offres</Link>
            </div>
          )}

          <div className={`st-body ${pending && data ? 'is-stale' : ''}`} aria-busy={pending || undefined}>
            <section className="grid-stats st-kpis" aria-label="Chiffres clés de la période">
              <StatCard label="Chiffre d'affaires" icon={TrendingUp} loading={loading}
                value={sal ? fcfa(sal.revenue) : '—'}
                sub={sal ? <Trend pct={sal.trend?.revenuePct} /> : lockMsg(data?.sales) ? 'Offre supérieure' : 'Indisponible'} />
              <StatCard label="Ventes" icon={ShoppingBag} loading={loading}
                value={sal ? num(sal.sales) : '—'}
                sub={sal ? <Trend pct={sal.trend?.salesPct} /> : lockMsg(data?.sales) ? 'Offre supérieure' : 'Indisponible'} />
              <StatCard label="Panier moyen" icon={Wallet} loading={loading}
                value={sal ? fcfa(sal.avgBasket) : '—'}
                sub={sal ? 'par vente livrée' : lockMsg(data?.sales) ? 'Offre supérieure' : 'Indisponible'} />
              <StatCard label="Dépenses de livraison" icon={Bike} loading={loading}
                value={fin ? fcfa(fin.summary?.totalSpent) : '—'}
                sub={fin
                  ? `${plural(fin.summary?.deliveriesCount ?? 0, 'livraison', 'livraisons')}${fin.summary?.deliveriesCount ? ` · ${fcfa(fin.summary.avgCostPerDelivery)} en moyenne` : ''}`
                  : lockMsg(data?.finances) ? 'Offre supérieure' : 'Indisponible'} />
            </section>

            <div className="st-grid">
              <div className="st-col">
                <SpendChart fin={fin} periodKey={effective?.key ?? period} loading={loading} mode={mode} setMode={setMode}
                  locked={lockMsg(data?.finances)} onRetry={refresh} />
                <Transactions fin={fin} loading={loading} locked={lockMsg(data?.finances)} onRetry={refresh} />
              </div>
              <div className="st-col">
                <NowCard sal={sal} loading={loading} />
                <Activity ins={ins} loading={loading} locked={lockMsg(data?.insights)} onRetry={refresh} />
              </div>
            </div>

            <div className="st-grid-3">
              <TopProducts sal={sal} loading={loading} locked={lockMsg(data?.sales)} onRetry={refresh} />
              <Regulars sal={sal} loading={loading} locked={lockMsg(data?.sales)} onRetry={refresh} />
              <Destinations ins={ins} loading={loading} locked={lockMsg(data?.insights)} onRetry={refresh} />
            </div>
          </div>
        </>
      )}

      <Modal open={!!batchLocked} onClose={() => setBatchLocked(null)} width={480}
        title="Facture récapitulative : offre Premium"
        subtitle="Toutes les livraisons d'une période dans un seul document, pour votre comptabilité."
        footer={<>
          <Button variant="ghost" onClick={() => setBatchLocked(null)}>Plus tard</Button>
          <Button to="/compte" arrow="right" onClick={() => setBatchLocked(null)}>Voir les offres</Button>
        </>}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span className="cs-lock-ico" aria-hidden><Lock size={18} /></span>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{batchLocked} Vos reçus restent téléchargeables livraison par livraison.</p>
        </div>
      </Modal>
    </div>
  )
}

// Évolution par rapport à la période précédente (même durée)
function Trend({ pct }) {
  if (pct == null) return <span>pas de période précédente</span>
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <>
      <span className={`st-trend ${up ? 'up' : 'down'}`}><Icon size={13} aria-hidden />{fmtPct(pct)}</span>
      <span>vs période précédente</span>
    </>
  )
}

// Bloc verrouillé (403) à l'intérieur d'une carte : message + lien, sans « Réessayer »
function LockedNote({ message }) {
  return (
    <div className="st-locked-note">
      <Lock size={16} aria-hidden />
      <p>{message}</p>
      <Link className="link" to="/compte">Voir les offres</Link>
    </div>
  )
}

function CardBody({ loading, locked, failed, onRetry, rows = 4, children }) {
  if (loading) return <div style={{ display: 'grid', gap: 10 }}>{Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={20} />)}</div>
  if (locked) return <LockedNote message={locked} />
  if (failed) return <ErrorState compact title="Indisponible pour le moment" text={null} onRetry={onRetry} />
  return children
}

// ── Page entière verrouillée (Starter, ou employé de l'équipe) ──────────────
const INCLUDED = [
  'Chiffre d\'affaires, ventes et panier moyen',
  'Produits les plus vendus et clients réguliers',
  'Dépenses de livraison jour par jour, mois par mois',
  'Délais, annulations et coursiers les plus fréquents',
  'Export CSV comptable',
]
function LockedPage({ member, message, navigate }) {
  if (member) {
    return (
      <Card>
        <Empty icon={Lock} title="Réservé au responsable et aux gérants"
          text={message ?? 'Demandez au responsable du compte DEM Pro de vous donner le rôle de gérant.'}
          action={<Button variant="ghost" onClick={() => navigate('/')}>Retour au tableau de bord</Button>} />
      </Card>
    )
  }
  return (
    <Card className="has-corners st-lockpage">
      <Corners />
      <div className="st-lockpage-main">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Offres Business et Premium</p>
        <h2 className="st-lockpage-title">Suivez vos ventes et vos dépenses, période par période.</h2>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 14.5, maxWidth: 520 }}>
          {message ?? 'Les statistiques sont réservées aux offres Business et Premium.'}
        </p>
        <div style={{ marginTop: 22 }}><Button to="/compte" arrow="right">Voir les offres</Button></div>
      </div>
      <ul className="st-lockpage-list">
        {INCLUDED.map(t => <li key={t}><Check size={16} aria-hidden />{t}</li>)}
      </ul>
    </Card>
  )
}

// ── Dépenses de livraison : graphique ───────────────────────────────────────
function chartSeries(fin, key) {
  if (!fin) return []
  if (key === 'today') {
    // Une seule colonne pour « Jour » côté serveur : détail heure par heure
    // depuis les livraisons de la journée (heure de Dakar = UTC)
    const byHour = new Map()
    for (const t of fin.transactions ?? []) {
      const h = new Date(t.date).getUTCHours()
      const b = byHour.get(h) ?? { amount: 0, count: 0 }
      b.amount += Number(t.amount) || 0; b.count++
      byHour.set(h, b)
    }
    const hours = [...byHour.keys()]
    const nowH = new Date().getUTCHours()
    const hi = Math.max(nowH, ...hours)
    const lo = Math.min(8, hi, ...hours)
    return Array.from({ length: hi - lo + 1 }, (_, i) => {
      const h = lo + i
      const b = byHour.get(h) ?? { amount: 0, count: 0 }
      return { label: `${h}h`, full: `De ${h} h à ${h + 1} h`, ...b }
    })
  }
  return (fin.breakdown ?? []).map(b => ({ label: b.label, full: b.label, amount: Number(b.amount) || 0, count: Number(b.count) || 0 }))
}

function SpendChart({ fin, periodKey, loading, mode, setMode, locked, onRetry }) {
  const series = useMemo(() => chartSeries(fin, periodKey), [fin, periodKey])
  const dataKey = mode === 'amount' ? 'amount' : 'count'
  const empty = fin && series.every(d => !d.count)
  const many = series.length > 10
  return (
    <Card>
      <div className="st-chart-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="section-title">Dépenses de livraison</h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{periodKey === 'today' ? 'Heure par heure' : 'Livraisons effectuées, par date de livraison'}</div>
        </div>
        <Segmented label="Afficher" value={mode} onChange={setMode} options={[['amount', 'Montant'], ['count', 'Livraisons']]} disabled={!fin} />
      </div>
      <div style={{ height: 240 }}>
        {loading ? <Skeleton h={230} /> : locked ? <LockedNote message={locked} /> : !fin ? (
          <ErrorState compact title="Graphique indisponible" text={null} onRetry={onRetry} />
        ) : empty ? (
          <Empty icon={Bike} title="Aucune livraison effectuée sur cette période" text="Vos dépenses apparaissent ici dès la première livraison livrée." />
        ) : (
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: mode === 'amount' ? 8 : -12 }} barCategoryGap="26%">
              <CartesianGrid vertical={false} stroke="#EEF2F6" />
              <XAxis dataKey="label" interval={many ? 'preserveStartEnd' : 0} tickLine={false} axisLine={{ stroke: '#E2E8F0' }}
                tick={{ fontSize: 11.5, fill: '#64748B', fontFamily: 'DM Sans' }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={mode === 'amount' ? 56 : 40}
                tickFormatter={(v) => mode === 'amount' ? (v >= 1000 ? `${num(v / 1000)}k` : num(v)) : num(v)}
                tick={{ fontSize: 11.5, fill: '#64748B', fontFamily: 'DM Sans' }} />
              <Tooltip cursor={{ fill: 'rgba(2, 21, 32, .04)' }} content={<ChartTip />} />
              <Bar dataKey={dataKey} maxBarSize={34} radius={0} isAnimationActive={false}>
                {series.map((d, i) => <Cell key={d.label + i} fill={i === series.length - 1 ? '#00D2FF' : '#021520'} />)}
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
    <div className="st-tip">
      <div className="st-tip-label">{d.full}</div>
      <div style={{ fontWeight: 700 }}>{fcfa(d.amount)}</div>
      <div style={{ color: '#CBD5E1' }}>{plural(d.count, 'livraison', 'livraisons')}</div>
    </div>
  )
}

// ── Livraisons de la période ────────────────────────────────────────────────
function Transactions({ fin, loading, locked, onRetry }) {
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  const rows = fin?.transactions ?? []
  const shown = all ? rows : rows.slice(0, 8)
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '20px 24px 14px' }}>
        <SectionTitle title="Livraisons de la période" style={{ marginBottom: 0 }}
          hint={fin ? `${plural(rows.length, 'livraison effectuée', 'livraisons effectuées')} · ${fcfa(fin.summary?.totalSpent)}` : null} />
      </div>
      <div style={{ padding: loading || locked || !fin ? '0 24px 20px' : 0 }}>
        <CardBody loading={loading} locked={locked} failed={!fin} onRetry={onRetry} rows={5}>
          {rows.length === 0 ? (
            <p className="muted" style={{ margin: 0, padding: '0 24px 20px', fontSize: 13.5 }}>Aucune livraison effectuée sur cette période.</p>
          ) : (
            <>
              <table className="dl-table st-table">
                <colgroup><col className="st-c-date" /><col /><col className="st-c-driver" /><col className="st-c-amount" /></colgroup>
                <thead>
                  <tr>
                    <th scope="col">Livrée le</th>
                    <th scope="col">Adresse</th>
                    <th scope="col" className="st-c-driver">Coursier</th>
                    <th scope="col" className="num-col">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(t => (
                    <tr key={t.id} className="dl-row" tabIndex={0} aria-label={`Livraison du ${dateTime(t.date)}`}
                      onClick={() => navigate(`/livraisons?id=${t.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/livraisons?id=${t.id}`) }}>
                      <td><span className="dl-date">{dateTime(t.date)}</span></td>
                      <td><span className="dl-ellipsis">{t.deliveryAddress ?? '—'}</span></td>
                      <td className="st-c-driver"><span className="dl-ellipsis muted">{t.driverName ?? '—'}</span></td>
                      <td className="num num-col dl-amount">{fcfa(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && (
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--p-line)' }}>
                  <button type="button" className="link-caps st-more" onClick={() => setAll(v => !v)} aria-expanded={all}>
                    {all ? 'Afficher moins' : `Afficher les ${rows.length} livraisons`}
                    <ChevronRight size={14} aria-hidden style={{ transform: all ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
                  </button>
                </div>
              )}
            </>
          )}
        </CardBody>
      </div>
    </Card>
  )
}

// ── En ce moment (indépendant de la période) ────────────────────────────────
function NowCard({ sal, loading }) {
  const h = sal?.toHandle ?? {}
  const tiles = [
    ['Nouvelles', h.new, '/commandes'],
    ['Confirmées', h.confirmed, '/commandes'],
    ['En préparation', h.preparing, '/commandes'],
    ['Prêtes', h.ready, '/commandes'],
    ['En livraison', sal?.inDelivery, '/livraisons?filtre=en-cours'],
  ]
  if (!loading && !sal) return null
  return (
    <Card>
      <SectionTitle title="En ce moment" hint="Commandes de la boutique à traiter" style={{ marginBottom: 14 }}
        action={<Inbox size={16} color="#94A3B8" aria-hidden />} />
      {loading ? <Skeleton h={64} /> : (
        <div className="st-now">
          {tiles.map(([label, n, to]) => (
            <Link key={label} to={to} className={`st-now-tile ${n ? 'on' : ''}`}>
              <strong className="num">{num(n ?? 0)}</strong>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Activité (insights) ─────────────────────────────────────────────────────
function Activity({ ins, loading, locked, onRetry }) {
  const rate = Number(ins?.cancellationRate) || 0
  const d = ins?.topDriver
  return (
    <Card>
      <SectionTitle title="Activité" hint="Créées et livrées sur la période" style={{ marginBottom: 6 }} />
      <CardBody loading={loading} locked={locked} failed={!ins} onRetry={onRetry} rows={5}>
        <dl className="st-dl">
          <div><dt>Livraisons créées</dt><dd className="num">{num(ins?.totalOrdersCreated ?? 0)}</dd></div>
          <div>
            <dt>Livraisons effectuées</dt>
            <dd className="num">
              {num(ins?.trend?.currentCount ?? 0)}
              {ins?.trend?.countTrendPct != null && (
                <span className={`st-trend ${ins.trend.countTrendPct >= 0 ? 'up' : 'down'}`}>{fmtPct(ins.trend.countTrendPct)}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Durée moyenne</dt>
            <dd className="num" title="De l'acceptation par le coursier à la livraison">{ins?.avgDeliveryMinutes != null ? `${ins.avgDeliveryMinutes}\u00a0min` : '—'}</dd>
          </div>
          <div>
            <dt>Taux d'annulation</dt>
            <dd className="num" style={{ color: rate > 20 ? 'var(--p-danger)' : undefined }}>
              {rate.toLocaleString('fr-FR')}&nbsp;%
              {ins?.cancelledCount > 0 && <span className="st-dd-sub">{plural(ins.cancelledCount, 'annulée', 'annulées')}</span>}
            </dd>
          </div>
          {d && (
            <div>
              <dt>Coursier le plus fréquent</dt>
              <dd>
                {d.name ?? 'Coursier DEM'}
                <span className="st-dd-sub">
                  {plural(d.count, 'course', 'courses')}
                  {d.avgRating != null && <> · <Star size={11} aria-hidden className="st-star" /> {Number(d.avgRating).toLocaleString('fr-FR')}</>}
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt>Produit star</dt>
            <dd>
              {ins?.topProduct ? <>{ins.topProduct.name}<span className="st-dd-sub">{plural(ins.topProduct.totalQty, 'vendu', 'vendus')}</span></>
                : ins?.topProductLocked ? <Link className="link" to="/compte">Offre supérieure</Link> : '—'}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  )
}

// ── Produits les plus vendus ────────────────────────────────────────────────
function TopProducts({ sal, loading, locked, onRetry }) {
  const top = sal?.topProducts ?? []
  const max = Math.max(1, ...top.map(p => p.quantity || 0))
  return (
    <Card>
      <SectionTitle title="Produits les plus vendus" hint="Par quantité vendue" />
      <CardBody loading={loading} locked={locked} failed={!sal} onRetry={onRetry}>
        {top.length === 0 ? (
          <p className="muted st-empty">Aucune vente avec articles sur la période. Ajoutez vos produits aux livraisons pour les suivre ici.</p>
        ) : (
          <ol className="st-rank">
            {top.map((p, i) => (
              <li key={p.productId ?? p.name}>
                <span className="st-rank-n num">{i + 1}</span>
                <span className="st-rank-main">
                  <span className="st-rank-top">
                    <span className="st-rank-name">{p.name}</span>
                    <span className="num st-rank-val">{fcfa(p.revenue)}</span>
                  </span>
                  <span className="st-rank-bar" aria-hidden><i style={{ width: `${Math.max(4, (p.quantity / max) * 100)}%` }} /></span>
                  <span className="muted st-rank-sub num">{plural(p.quantity, 'vendu', 'vendus')}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}

// ── Clients réguliers ───────────────────────────────────────────────────────
function Regulars({ sal, loading, locked, onRetry }) {
  const list = sal?.regularCustomers ?? []
  return (
    <Card>
      <SectionTitle title="Clients réguliers"
        hint={sal ? (sal.customersCount ? `${num(sal.regularCustomersCount)} sur ${plural(sal.customersCount, 'client', 'clients')} ont acheté 2 fois ou plus` : 'Au moins 2 achats sur la période') : 'Au moins 2 achats sur la période'} />
      <CardBody loading={loading} locked={locked} failed={!sal} onRetry={onRetry}>
        {list.length === 0 ? (
          <p className="muted st-empty">Aucun client n'a encore acheté deux fois sur la période.</p>
        ) : (
          <ul className="st-people">
            {list.map(c => (
              <li key={c.phone}>
                <Link to={`/clients?client=${encodeURIComponent(c.phone)}`} className="st-person">
                  <span className="st-person-main">
                    <span className="st-person-name">{(c.name ?? '').trim() || phoneFmt(c.phone)}</span>
                    <span className="muted st-person-sub">{plural(c.purchases, 'achat', 'achats')}{c.name ? ` · ${phoneFmt(c.phone)}` : ''}</span>
                  </span>
                  <span className="num st-person-val">{fcfa(c.spent)}</span>
                  <ChevronRight size={15} color="#94A3B8" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link to="/clients" className="link-caps st-foot-link">Tous vos clients <ChevronRight size={14} aria-hidden /></Link>
      </CardBody>
    </Card>
  )
}

// ── Destinations fréquentes ─────────────────────────────────────────────────
function Destinations({ ins, loading, locked, onRetry }) {
  const list = ins?.topDestinations ?? []
  return (
    <Card>
      <SectionTitle title="Destinations fréquentes" hint="Adresses les plus livrées sur la période" />
      <CardBody loading={loading} locked={locked} failed={!ins} onRetry={onRetry}>
        {list.length === 0 ? (
          <p className="muted st-empty">Aucune livraison effectuée sur la période.</p>
        ) : (
          <ul className="st-people">
            {list.map((d, i) => {
              const body = (
                <>
                  <span className="st-person-main">
                    <span className="st-person-name" title={d.address}>{d.address}</span>
                    <span className="muted st-person-sub">{d.receiverName || phoneFmt(d.receiverPhone) || '—'}</span>
                  </span>
                  <span className="num st-person-val">×&nbsp;{d.count}</span>
                </>
              )
              return (
                <li key={`${d.address}-${i}`}>
                  {d.receiverPhone
                    ? <Link to={`/clients?client=${encodeURIComponent(d.receiverPhone)}`} className="st-person">{body}<ChevronRight size={15} color="#94A3B8" aria-hidden /></Link>
                    : <div className="st-person">{body}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
