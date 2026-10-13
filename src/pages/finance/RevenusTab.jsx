import { useState, useEffect, useCallback, createElement } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChevronDown, ChevronUp, Info, Handshake, Ticket, Briefcase, ShoppingBag, ArrowRight } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { useAuth } from '../../contexts/AuthContext'
import { canSee, isSuperRole, ACTION_ROLES } from '../../lib/droits'
import ExportPdfButton from '../../components/ExportPdfButton'
import { exportCsv } from '../../lib/exportCsv'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatCount, formatAxisF } from '../../lib/format'
import RevenueBreakdownTable from './components/RevenueBreakdownTable'
import FeesSection from './FeesSection'
import InfoTip from '../../components/InfoTip'

// Finance › Revenus — organisé par SOURCE de revenu, pour une période choisie
// en haut (gardée dans l'adresse, ?periode=) :
//   1. total de la période (facturé, encaissé, à recouvrer, remises, net) ;
//   2. une carte par source : commission sur les courses, pass journaliers
//      coursiers, formules DEM Pro, ventes DEM Pro en paiement intégré ;
//   3. graphique des 30 jours par source ;
//   4. tableau détaillé par période (comptabilité) et frais depuis le lancement.
// Mêmes calculs qu'avant : GET /admin/finance/revenue (admin.revenue.service.js),
// complété par /admin/finance/pass (pass offerts, coursiers avec pass) et
// /admin/dem-pro/offers (comptes payants par formule).

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

const PERIODS = [
  ['today',     "Aujourd'hui"],
  ['week',      '7 jours'],
  ['month',     '30 jours'],
  ['sixMonths', '6 mois'],
]

// Couleur par source — la même sur les cartes et le graphique.
const SOURCE_COLORS = {
  commission:    '#0ea5e9',
  pass:          '#8b5cf6',
  subscriptions: '#f59e0b',
  proSales:      '#16a34a',
}

const EXPORT_COLUMNS = [
  { header: 'Date',                         key: 'date' },
  { header: 'Courses livrées',              key: 'deliveredCount' },
  { header: 'Commission facturée',          key: 'commissionBilled' },
  { header: 'Commission encaissée',         key: 'commissionCollected' },
  { header: 'Commission à recouvrer',       key: 'commissionToRecover' },
  { header: 'Pass coursiers',                key: 'pass' },
  { header: 'Abonnements DEM Pro',          key: 'subscriptions' },
  { header: 'Commission ventes DEM Pro',    key: 'proSales' },
  { header: 'Revenus facturés',             key: 'totalBilled' },
  { header: 'Revenus encaissés',            key: 'totalCollected' },
  { header: 'Remises promo',                key: 'promoCost' },
]
const EXPORT_TYPE_LABELS = { pdf: 'PDF', csv: 'CSV' }

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

const pct = (part, total) => (total > 0 ? `${Math.round((part / total) * 100)} %` : '—')

// Explications repliées.
function HowComputed() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600 }}>
        <Info size={14} /> Comment sont calculés ces chiffres ? {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ ...glass, padding: '12px 16px', marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0 }}>
            Uniquement de l'argent réel, jamais une estimation. Quatre sources : la <strong>commission sur les courses</strong> (frais de mise en
            relation de chaque course livrée, par date de livraison), les <strong>pass journaliers</strong> et les <strong>formules DEM Pro</strong>
            (montants réellement prélevés), et la <strong>commission sur les ventes DEM Pro</strong> payées dans l'app. Les remises promo sont un coût
            supporté par DEM : elles donnent le net.
          </p>
          <p style={{ margin: 0 }}>
            Commission <em>encaissée</em> : course payée en ligne (l'argent est chez DEM) ou reprise sur le wallet du coursier ; <em>à recouvrer</em> :
            course payée en espèces sans reprise, pas encore payée ou en litige.
          </p>
          <p style={{ margin: 0 }}>
            Périodes en jours entiers : « 30 jours » = aujourd'hui et les 29 jours précédents, soit exactement la somme du graphique.
          </p>
        </div>
      )}
    </div>
  )
}

function TotalItem({ label, value, color, strong }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}<InfoTip k={label} size={12} /></div>
      <div style={{ fontSize: strong ? 24 : 20, fontWeight: 800, color: color ?? 'var(--text)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

// Carte d'une source : montant, part du total, courbe des 30 jours, détails, lien.
function SourceCard({ title, icon, color, amount, total, growth, sparkKey, lines, link }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: color + '1f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {createElement(icon, { size: 15, color })}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}>{title}<InfoTip k={title} size={12} /></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{formatF(amount)}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color, background: color + '18', padding: '1px 8px', borderRadius: 10 }}>{pct(amount, total)} du total</span>
      </div>
      <div style={{ height: 38, margin: '0 -4px' }} title="30 derniers jours">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={growth} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <Area type="monotone" dataKey={sparkKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {lines.filter(Boolean).map(([label, value, c]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontWeight: 700, color: c ?? 'var(--text)', whiteSpace: 'nowrap' }}>{value}</span>
          </div>
        ))}
      </div>
      {link && (
        <Link to={link.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', marginTop: 2 }}>
          {link.label} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

export default function RevenusTab({ lastExport, onExported }) {
  const { user } = useAuth()
  const isSuper = isSuperRole(user?.adminRole)
  const [data, setData]       = useState(null)
  const [courses, setCourses] = useState(null)
  const [passStats, setPassStats] = useState(null)
  const [offers, setOffers]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [chart, setChart]     = useState('sources') // 'sources' | 'commission'

  // Période choisie, gardée dans l'adresse.
  const [params, setParams] = useSearchParams()
  const period = PERIODS.some(([k]) => k === params.get('periode')) ? params.get('periode') : 'month'
  const periodLabel = PERIODS.find(([k]) => k === period)[1]
  function setPeriod(key) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === 'month') next.delete('periode')
      else next.set('periode', key)
      return next
    }, { replace: true })
  }

  // silent=true (auto-refresh en tâche de fond) évite de re-flasher "Chargement…"
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [rev, crs, pass, off] = await Promise.all([
        api.get('/admin/finance/revenue'),
        api.get('/admin/finance/courses').catch(() => null),
        api.get('/admin/finance/pass').catch(() => null),
        api.get('/admin/dem-pro/offers').catch(() => null),
      ])
      setData(rev.data)
      setCourses(crs?.data ?? null)
      setPassStats(pass?.data ?? null)
      setOffers(off?.data ?? null)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const growth = data.growth.map(g => ({ ...g, dateLabel: new Date(g.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }))
  const filename = (ext) => `revenus-${new Date().toISOString().slice(0, 10)}.${ext}`
  const exported = (type) => { logExport(type).then(() => onExported?.()) }

  const rev   = data[period]
  const total = rev.totals.billed
  const c     = rev.commission
  const passP = passStats?.[period] ?? null // pas de 6 mois côté serveur pour les pass offerts
  // Formules DEM Pro : comptes payants par offre (nouvelles offres), essais qui finissent bientôt.
  const tiers = offers?.tiers ?? []
  const sub   = offers?.subscriptions ?? null

  // Courses livrées : le serveur fournit aujourd'hui, 7 et 30 jours (pas 6 mois).
  const crs = key => courses?.[key] ?? null
  const coursesBlock = courses && {
    title: 'Courses livrées',
    rows: [
      { label: 'Courses livrées', strong: true, values: PERIODS.map(([k]) => crs(k) ? formatCount(crs(k).deliveredCount) : null) },
      { label: 'Gains coursiers (part coursier)', values: PERIODS.map(([k]) => crs(k) ? formatF(crs(k).driverEarnings) : null) },
      { label: "Prix moyen d'une course (hors remise)", values: PERIODS.map(([k]) => crs(k) ? formatF(crs(k).avgDeliveryPrice) : null) },
    ],
  }

  return (
    <div>
      {/* Barre d'outils : explications, exports, dernier export */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}><HowComputed /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {lastExport && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Dernier export : {EXPORT_TYPE_LABELS[lastExport.type] ?? lastExport.type} le {new Date(lastExport.at).toLocaleString('fr-FR')}
            </span>
          )}
          <button onClick={() => { exportCsv({ filename: filename('csv'), columns: EXPORT_COLUMNS, rows: data.growth }); exported('csv') }} style={btnOutline}>
            Exporter CSV (30 jours)
          </button>
          <ExportPdfButton title="Revenus DEM — 30 derniers jours" filename={filename('pdf')} columns={EXPORT_COLUMNS} rows={data.growth} onExport={() => exported('pdf')} />
        </div>
      </div>

      {/* Choix de la période — tout l'onglet suit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Période :</span>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {PERIODS.map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
              background: period === k ? 'var(--primary)' : 'transparent', color: period === k ? '#fff' : 'var(--text-muted)', fontWeight: period === k ? 700 : 500,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Total de la période */}
      <div style={{ ...glass, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <TotalItem label="Revenus facturés" value={formatF(total)} strong />
        <TotalItem label="Encaissés" value={formatF(rev.totals.collected)} color="#16a34a" />
        <TotalItem label="À recouvrer" value={formatF(rev.totals.toRecover)} color="#f97316" />
        <TotalItem label="Remises promo" value={rev.promoCost ? `−${formatF(rev.promoCost)}` : formatF(0)} color="var(--text-muted)" />
        <TotalItem label="Net après remises" value={formatF(rev.totals.net)} color="var(--primary)" />
      </div>

      {/* Une carte par source */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
        <SourceCard
          title="Commission sur les courses" icon={Handshake} color={SOURCE_COLORS.commission}
          amount={c.billed} total={total} growth={growth} sparkKey="commissionBilled"
          lines={[
            ['Courses livrées', formatCount(rev.deliveredCount)],
            ['Commission moyenne par course', rev.deliveredCount ? formatF(Math.round(c.billed / rev.deliveredCount)) : '—'],
            ['Encaissée en ligne', formatF(c.collectedOnline), '#16a34a'],
            ['Reprise sur le wallet des coursiers', formatF(c.recoveredFromCash ?? 0), '#16a34a'],
            ['À recouvrer', formatF(c.toRecover), '#f97316'],
          ]}
          link={{ label: 'Impayés et litiges', to: '/finance?tab=paiements&vue=impayes' }}
        />
        <SourceCard
          title="Pass journaliers coursiers" icon={Ticket} color={SOURCE_COLORS.pass}
          amount={rev.pass.amount} total={total} growth={growth} sparkKey="pass"
          lines={[
            ['Pass achetés', formatCount(rev.pass.count)],
            ['Montant moyen d’un pass', rev.pass.count ? formatF(Math.round(rev.pass.amount / rev.pass.count)) : '—'],
            ['Pass offerts', passP ? formatCount(passP.gifted) : '—'],
            passStats && ['Coursiers avec un pass valide aujourd’hui', `${formatCount(passStats.driversWithActivePass)} / ${formatCount(passStats.totalActiveDrivers)}`],
          ]}
          link={{ label: 'Détail des pass', to: '/finance?tab=pass' }}
        />
        <SourceCard
          title="Formules DEM Pro" icon={Briefcase} color={SOURCE_COLORS.subscriptions}
          amount={rev.subscriptions.amount} total={total} growth={growth} sparkKey="subscriptions"
          lines={[
            ['Achats de formule', formatCount(rev.subscriptions.count)],
            ...tiers.map(t => [`Comptes payants ${t.label}`, formatCount(t.accounts?.paid ?? 0)]),
            sub && ['Essais qui se terminent bientôt', formatCount(sub.trialsExpiringSoon?.length ?? 0)],
          ]}
          link={isSuper ? { label: 'Offres DEM Pro', to: '/dem-pro?onglet=offres' } : null}
        />
        <SourceCard
          title="Ventes DEM Pro (paiement intégré)" icon={ShoppingBag} color={SOURCE_COLORS.proSales}
          amount={rev.proSales.commission} total={total} growth={growth} sparkKey="proSales"
          lines={[
            ['Ventes payées dans l’app', formatCount(rev.proSales.count)],
            ['Commission moyenne par vente', rev.proSales.count ? formatF(Math.round(rev.proSales.commission / rev.proSales.count)) : '—'],
          ]}
        />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '-8px 0 16px' }}>
        Montants sur la période « {periodLabel} » · courbes sur les 30 derniers jours.
      </div>

      {/* Graphique des 30 jours : par source, ou encaissement de la commission */}
      <div style={{ ...glass, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {chart === 'sources' ? 'Revenus par source' : 'Commission sur les courses'} — 30 derniers jours
            <InfoTip k={chart === 'sources' ? 'Revenus par source — 30 derniers jours' : 'Commission sur les courses — 30 derniers jours'} size={13} />
          </h2>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 3 }}>
            {[['sources', 'Par source'], ['commission', 'Encaissement de la commission']].map(([k, l]) => (
              <button key={k} onClick={() => setChart(k)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: chart === k ? 'var(--primary)' : 'transparent', color: chart === k ? '#fff' : 'var(--text-muted)', fontWeight: chart === k ? 700 : 500,
              }}>{l}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={growth} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={formatAxisF} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [formatF(v), name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {chart === 'sources' ? [
              // Empilées : la hauteur totale d'une barre = revenus facturés du jour
              <Bar key="c" dataKey="commissionBilled" name="Commission sur les courses" stackId="s" fill={SOURCE_COLORS.commission} />,
              <Bar key="p" dataKey="pass"             name="Pass coursiers"             stackId="s" fill={SOURCE_COLORS.pass} />,
              <Bar key="s" dataKey="subscriptions"    name="Formules DEM Pro"           stackId="s" fill={SOURCE_COLORS.subscriptions} />,
              <Bar key="v" dataKey="proSales"         name="Ventes DEM Pro"             stackId="s" fill={SOURCE_COLORS.proSales} radius={[3, 3, 0, 0]} />,
            ] : [
              // Empilées : la hauteur totale d'une barre = commission facturée du jour
              <Bar key="c" dataKey="commissionCollected" name="Encaissée" stackId="c" fill="#22c55e" />,
              <Bar key="r" dataKey="commissionToRecover" name="À recouvrer" stackId="c" fill="#f97316" radius={[3, 3, 0, 0]} />,
            ]}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau détaillé par période (comptabilité) */}
      <div style={{ ...glass, padding: '16px 20px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Détail par période<InfoTip k="Détail par période" size={13} /></h2>
        <RevenueBreakdownTable
          columns={PERIODS.map(([key, label]) => ({ label, rev: data[key] }))}
          extra={coursesBlock ? [coursesBlock] : []}
        />
      </div>

      {canSee(user?.adminRole, ACTION_ROLES.feesSinceLaunch) && (
        <section style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Frais de mise en relation depuis le lancement<InfoTip k="Frais de mise en relation depuis le lancement" size={13} /></h2>
          <FeesSection />
        </section>
      )}
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
