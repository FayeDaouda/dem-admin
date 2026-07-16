import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'
import { exportCsv } from '../../lib/exportCsv'

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }
const PASS_COLORS = ['#22c55e', '#e2e8f0']

function PeriodBox({ label, activated, revenue }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{activated}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>pass activés</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6' }}>{revenue.toLocaleString()} F</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>revenus</div></div>
      </div>
    </div>
  )
}

export default function PassTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/finance/pass')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const trend = data.trend.map(t => ({ ...t, dateLabel: new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const pieData = [
    { name: 'Avec pass actif', value: data.driversWithActivePass },
    { name: 'Sans pass actif', value: data.driversWithoutActivePass },
  ]
  const exportColumns = [
    { header: 'Date',         key: 'date' },
    { header: 'Pass activés', key: 'activated' },
    { header: 'Revenus',      key: 'revenue' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { exportCsv({ filename: `pass-livreurs-${new Date().toISOString().slice(0, 10)}.csv`, columns: exportColumns, rows: data.trend }); logExport('csv') }} style={btnOutline}>
          Exporter CSV
        </button>
        <ExportPdfButton title="Pass livreurs" filename={`pass-livreurs-${new Date().toISOString().slice(0, 10)}.pdf`} columns={exportColumns} rows={data.trend} onExport={() => logExport('pdf')} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" activated={data.today.activated} revenue={data.today.revenue} />
        <PeriodBox label="7 JOURS" activated={data.week.activated} revenue={data.week.revenue} />
        <PeriodBox label="30 JOURS" activated={data.month.activated} revenue={data.month.revenue} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Pass activés & revenus — 30 derniers jours</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="activated" name="Pass activés" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Livreurs — pass actif aujourd'hui</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={PASS_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            {data.driversWithActivePass} / {data.totalActiveDrivers} livreurs actifs
          </div>
        </div>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
