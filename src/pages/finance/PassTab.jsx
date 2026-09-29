import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'
import { exportCsv } from '../../lib/exportCsv'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatCount } from '../../lib/format'

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }
const PASS_COLORS = ['#22c55e', '#e2e8f0']

function PeriodBox({ label, stats }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 200px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{formatCount(stats.purchased)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>pass achetés</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6' }}>{formatF(stats.revenue)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>revenus</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: '#94a3b8' }}>{formatCount(stats.gifted)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>offerts</div></div>
      </div>
    </div>
  )
}

const EXPORT_COLUMNS = [
  { header: 'Date',          key: 'date' },
  { header: 'Pass achetés',  key: 'purchased' },
  { header: 'Revenus (F)',   key: 'revenue' },
  { header: 'Pass offerts',  key: 'gifted' },
]

export default function PassTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/pass')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const trend = data.trend.map(t => ({ ...t, dateLabel: new Date(t.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }))
  const pieData = [
    { name: 'Avec passe valide', value: data.driversWithActivePass },
    { name: 'Sans passe valide', value: data.driversWithoutActivePass },
  ]
  const filename = (ext) => `pass-livreurs-${new Date().toISOString().slice(0, 10)}.${ext}`

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        <strong>Achetés</strong> = passes réellement payées (prélèvement sur le wallet du livreur ou paiement direct), au montant payé après éventuelle réduction.
        <strong> Offerts</strong> = passes offertes par un admin, qui ne rapportent rien. Une passe est valide 24h à partir de son paiement (plus si offerte).
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { exportCsv({ filename: filename('csv'), columns: EXPORT_COLUMNS, rows: data.trend }); logExport('csv') }} style={btnOutline}>
          Exporter CSV
        </button>
        <ExportPdfButton title="Pass livreurs" filename={filename('pdf')} columns={EXPORT_COLUMNS} rows={data.trend} onExport={() => logExport('pdf')} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" stats={data.today} />
        <PeriodBox label="7 JOURS"     stats={data.week} />
        <PeriodBox label="30 JOURS"    stats={data.month} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16 }}>
        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Pass achetés et offerts — 30 derniers jours</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="purchased" name="Achetés" stackId="p" fill="#f59e0b" />
              <Bar dataKey="gifted"    name="Offerts" stackId="p" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Livreurs — passe valide en ce moment</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={PASS_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            {formatCount(data.driversWithActivePass)} / {formatCount(data.totalActiveDrivers)} comptes livreurs actifs (non suspendus, non supprimés)
          </div>
        </div>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
