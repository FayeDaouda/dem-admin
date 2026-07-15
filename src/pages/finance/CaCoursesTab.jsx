import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

function PeriodBox({ label, value }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 160px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value.toLocaleString()} F</div>
    </div>
  )
}

export default function CaCoursesTab() {
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

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14 }}>
        Commission DEM estimée sur les courses livrées, selon la grille de commission configurée. La commission réelle facturée reste à 0 F tant que la Phase 1 (lancement gratuit) est active — cette vue projette ce que rapporterait la grille actuelle.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" value={data.today.courses} />
        <PeriodBox label="7 JOURS"     value={data.week.courses} />
        <PeriodBox label="30 JOURS"    value={data.month.courses} />
        <PeriodBox label="6 MOIS"      value={data.sixMonths.courses} />
      </div>

      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>CA courses — 30 derniers jours</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={growth} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()} F`, 'CA courses']} />
            <Line type="monotone" dataKey="courses" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
