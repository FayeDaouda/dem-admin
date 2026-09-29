import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'
import { exportCsv } from '../../lib/exportCsv'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatAxisF } from '../../lib/format'
import RevenueBreakdownTable from './components/RevenueBreakdownTable'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

const PERIODS = [
  ['today',     "AUJOURD'HUI"],
  ['week',      '7 JOURS'],
  ['month',     '30 JOURS'],
  ['sixMonths', '6 MOIS'],
]

function PeriodBox({ label, rev }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{formatF(rev.totals.billed)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>facturés · dont {formatF(rev.totals.collected)} encaissés</div>
      <div style={{ fontSize: 11, color: '#f97316', marginTop: 2 }}>À recouvrer : {formatF(rev.totals.toRecover)}</div>
    </div>
  )
}

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

const EXPORT_COLUMNS = [
  { header: 'Date',                         key: 'date' },
  { header: 'Courses livrées',              key: 'deliveredCount' },
  { header: 'Commission facturée',          key: 'commissionBilled' },
  { header: 'Commission encaissée',         key: 'commissionCollected' },
  { header: 'Commission à recouvrer',       key: 'commissionToRecover' },
  { header: 'Pass livreurs',                key: 'pass' },
  { header: 'Abonnements DEM Pro',          key: 'subscriptions' },
  { header: 'Commission ventes DEM Pro',    key: 'proSales' },
  { header: 'Revenus facturés',             key: 'totalBilled' },
  { header: 'Revenus encaissés',            key: 'totalCollected' },
  { header: 'Remises promo',                key: 'promoCost' },
]

export default function RevenueTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // silent=true (auto-refresh en tâche de fond) évite de re-flasher "Chargement…"
  // toutes les 30s — seul le premier chargement et le clic manuel bloquent l'UI.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/revenue')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const growth = data.growth.map(g => ({ ...g, dateLabel: new Date(g.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }))
  const filename = (ext) => `revenus-${new Date().toISOString().slice(0, 10)}.${ext}`

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        Uniquement de l'argent réel. <strong>Commission</strong> = frais DEM réellement facturés sur les courses livrées (date de livraison) :
        <em> encaissée</em> si la course a été payée en ligne, <em>à recouvrer</em> si elle a été payée en espèces au livreur (la commission est restée chez lui)
        ou n'est pas encore payée. <strong>Pass</strong> et <strong>abonnements</strong> = montants réellement prélevés. Périodes en jours entiers :
        « 30 jours » = aujourd'hui + les 29 jours précédents, soit exactement la somme de la courbe.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { exportCsv({ filename: filename('csv'), columns: EXPORT_COLUMNS, rows: data.growth }); logExport('csv') }} style={btnOutline}>
          Exporter CSV (30 jours)
        </button>
        <ExportPdfButton title="Revenus DEM — 30 derniers jours" filename={filename('pdf')} columns={EXPORT_COLUMNS} rows={data.growth} onExport={() => logExport('pdf')} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {PERIODS.map(([key, label]) => <PeriodBox key={key} label={label} rev={data[key]} />)}
      </div>

      <div style={{ ...glass, padding: '18px 20px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Détail par source de revenu</h2>
        <RevenueBreakdownTable columns={PERIODS.map(([key, label]) => ({ label: label.charAt(0) + label.slice(1).toLowerCase(), rev: data[key] }))} />
      </div>

      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Revenus DEM — 30 derniers jours</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={growth} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={formatAxisF} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [formatF(v), name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="totalBilled"         name="Revenus facturés"       stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
            <Line type="monotone" dataKey="totalCollected"      name="Revenus encaissés"      stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} />
            <Line type="monotone" dataKey="commissionToRecover" name="Commission à recouvrer" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
