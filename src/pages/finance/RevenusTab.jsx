import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { useAuth } from '../../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../../lib/droits'
import ExportPdfButton from '../../components/ExportPdfButton'
import { exportCsv } from '../../lib/exportCsv'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatCount, formatAxisF } from '../../lib/format'
import RevenueBreakdownTable from './components/RevenueBreakdownTable'
import FeesSection from './FeesSection'

// Finance › Revenus — un seul écran, dans l'ordre : revenus par période,
// graphique des 30 jours (revenus ou commission), tableau détaillé par
// période (sources de revenus + courses livrées) et frais depuis le lancement
// (Super Admin). Les anciennes cartes « Commission » et « Courses » répétaient
// des lignes du tableau : leurs chiffres y sont tous.

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

const PERIODS = [
  ['today',     "Aujourd'hui"],
  ['week',      '7 jours'],
  ['month',     '30 jours'],
  ['sixMonths', '6 mois'],
]

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

function PeriodBox({ label, rev }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{formatF(rev.totals.billed)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>facturés · dont {formatF(rev.totals.collected)} encaissés</div>
      <div style={{ fontSize: 11, color: '#f97316', marginTop: 2 }}>À recouvrer : {formatF(rev.totals.toRecover)}</div>
    </div>
  )
}

// Explications repliées (avant : paragraphes toujours affichés en tête de
// chaque section) — même texte.
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
            Uniquement de l'argent réel. <strong>Commission</strong> = frais DEM réellement facturés sur les courses livrées (date de livraison) :
            <em> encaissée</em> si la course a été payée en ligne, <em>à recouvrer</em> si elle a été payée en espèces au coursier (la commission est restée chez lui)
            ou n'est pas encore payée. <strong>Pass</strong> et <strong>abonnements</strong> = montants réellement prélevés. Périodes en jours entiers :
            « 30 jours » = aujourd'hui + les 29 jours précédents, soit exactement la somme du graphique.
          </p>
          <p style={{ margin: 0 }}>
            Commission sur les courses : frais EXPRESS, tournées DEM Pro, tarif par zone… Une course sans frais DEM (tarif normal hors zone, phase de
            lancement) ne génère aucune commission.
          </p>
          <p style={{ margin: 0 }}>
            Courses livrées : comptées à leur date de livraison. Prix moyen = ce que paie le client avant remise (part coursier + commission DEM).
            La répartition par mode de paiement est dans Finance › Paiements › Encaissements.
          </p>
        </div>
      )}
    </div>
  )
}

export default function RevenusTab({ lastExport, onExported }) {
  const { user } = useAuth()
  const [data, setData]       = useState(null)
  const [courses, setCourses] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chart, setChart]     = useState('revenus') // 'revenus' | 'commission'

  // silent=true (auto-refresh en tâche de fond) évite de re-flasher "Chargement…"
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [rev, crs] = await Promise.all([
        api.get('/admin/finance/revenue'),
        api.get('/admin/finance/courses').catch(() => null),
      ])
      setData(rev.data)
      setCourses(crs?.data ?? null)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const growth = data.growth.map(g => ({ ...g, dateLabel: new Date(g.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }))
  const filename = (ext) => `revenus-${new Date().toISOString().slice(0, 10)}.${ext}`
  const exported = (type) => { logExport(type).then(() => onExported?.()) }

  // Courses livrées : le serveur fournit aujourd'hui, 7 et 30 jours (pas 6 mois).
  const c = key => courses?.[key] ?? null
  const coursesBlock = courses && {
    title: 'Courses livrées',
    rows: [
      { label: 'Courses livrées', strong: true, values: PERIODS.map(([k]) => c(k) ? formatCount(c(k).deliveredCount) : null) },
      { label: 'Gains coursiers (part coursier)', values: PERIODS.map(([k]) => c(k) ? formatF(c(k).driverEarnings) : null) },
      { label: "Prix moyen d'une course (hors remise)", values: PERIODS.map(([k]) => c(k) ? formatF(c(k).avgDeliveryPrice) : null) },
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

      {/* Revenus par période */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {PERIODS.map(([key, label]) => <PeriodBox key={key} label={label} rev={data[key]} />)}
      </div>

      {/* Graphique des 30 jours : revenus ou commission */}
      <div style={{ ...glass, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            {chart === 'revenus' ? 'Revenus DEM' : 'Commission sur les courses'} — 30 derniers jours
          </h2>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 3 }}>
            {[['revenus', 'Revenus'], ['commission', 'Commission']].map(([k, l]) => (
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
            {chart === 'revenus' ? [
              <Bar key="b" dataKey="totalBilled"         name="Revenus facturés"       fill="#22c55e" radius={[3, 3, 0, 0]} />,
              <Bar key="c" dataKey="totalCollected"      name="Revenus encaissés"      fill="#0ea5e9" radius={[3, 3, 0, 0]} />,
              <Bar key="r" dataKey="commissionToRecover" name="Commission à recouvrer" fill="#f97316" radius={[3, 3, 0, 0]} />,
            ] : [
              // Empilées : la hauteur totale d'une barre = commission facturée du jour
              <Bar key="c" dataKey="commissionCollected" name="Encaissée en ligne" stackId="c" fill="#22c55e" />,
              <Bar key="r" dataKey="commissionToRecover" name="À recouvrer"        stackId="c" fill="#f97316" radius={[3, 3, 0, 0]} />,
            ]}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau détaillé par période */}
      <div style={{ ...glass, padding: '16px 20px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Détail par période</h2>
        <RevenueBreakdownTable
          columns={PERIODS.map(([key, label]) => ({ label, rev: data[key] }))}
          extra={coursesBlock ? [coursesBlock] : []}
        />
      </div>

      {canSee(user?.adminRole, ACTION_ROLES.feesSinceLaunch) && (
        <section style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Frais de mise en relation depuis le lancement</h2>
          <FeesSection />
        </section>
      )}
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
