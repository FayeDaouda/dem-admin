import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'
import { exportCsv } from '../../lib/exportCsv'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

function PeriodBox({ label, value }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 160px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value.toLocaleString()} F</div>
    </div>
  )
}

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

export default function RevenueTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/finance/revenue')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const growth = data.growth.map(g => ({ ...g, dateLabel: new Date(g.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const exportRows = data.growth.map(g => ({ date: g.date, courses: g.courses, pass: g.pass, total: g.total }))
  const columns = [{ header: 'Date', key: 'date' }, { header: 'CA courses', key: 'courses' }, { header: 'CA pass', key: 'pass' }, { header: 'Total', key: 'total' }]

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14 }}>
"CA courses" = commission DEM par livraison, estimée selon la grille de commission configurée (la commission réelle facturée reste à 0 F tant que la Phase 1 lancement gratuit est active) · "CA pass" = charges journalières livreurs encaissées.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { exportCsv({ filename: `revenus-${new Date().toISOString().slice(0, 10)}.csv`, columns, rows: exportRows }); logExport('csv') }} style={btnOutline}>
          Exporter CSV
        </button>
        <ExportPdfButton title="Revenus DEM" filename={`revenus-${new Date().toISOString().slice(0, 10)}.pdf`} columns={columns} rows={exportRows} onExport={() => logExport('pdf')} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" value={data.today.total} />
        <PeriodBox label="7 JOURS" value={data.week.total} />
        <PeriodBox label="30 JOURS" value={data.month.total} />
        <PeriodBox label="6 MOIS" value={data.sixMonths.total} />
      </div>

      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Courbe d'évolution du CA — 30 derniers jours</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={growth} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()} F`]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="courses" name="CA courses" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
            <Line type="monotone" dataKey="pass" name="CA pass" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
            <Line type="monotone" dataKey="total" name="Total" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
