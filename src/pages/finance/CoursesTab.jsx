import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatCount } from '../../lib/format'

function Line({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function PeriodCard({ label, rev }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', flex: '1 1 240px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 12, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{formatCount(rev.deliveredCount)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>courses livrées</div>

      <Line label="Gains coursiers (part coursier)" value={formatF(rev.driverEarnings)} />
      <Line label="Commission DEM facturée" value={formatF(rev.commission.billed)} color="#0ea5e9" />
      <Line label="Remises promo (payées par DEM)" value={formatF(rev.promoCost)} />
      <Line label="Prix moyen d'une course (hors remise)" value={formatF(rev.avgDeliveryPrice)} color="#06b6d4" />

    </div>
  )
}

export default function CoursesTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/courses')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        Courses comptées à leur date de livraison. Prix moyen = ce que paie le client avant remise (part coursier + commission DEM).
        La répartition par mode de paiement est dans Finance › Paiements › Encaissements.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <PeriodCard label="Aujourd'hui" rev={data.today} />
        <PeriodCard label="7 derniers jours" rev={data.week} />
        <PeriodCard label="30 derniers jours" rev={data.month} />
      </div>
    </div>
  )
}
