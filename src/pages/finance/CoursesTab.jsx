import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

function PeriodCard({ label, completed, revenue, avgOrderValue }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', flex: '1 1 220px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 12, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{completed}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>courses complétées</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{revenue.toLocaleString()} F</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>revenus (commission DEM)</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#06b6d4' }}>{avgOrderValue.toLocaleString()} F</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>valeur moyenne d'une course</div>
        </div>
      </div>
    </div>
  )
}

export default function CoursesTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/finance/courses')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14 }}>
        "Revenus" = commission DEM (`demFee`) sur les courses livrées — actuellement offerte au lancement (0 F).
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <PeriodCard label="Aujourd'hui" {...data.today} />
        <PeriodCard label="7 derniers jours" {...data.week} />
        <PeriodCard label="30 derniers jours" {...data.month} />
      </div>
    </div>
  )
}
