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
  const ch = rev.ordersByChannel
  return (
    <div style={{ ...glass, padding: '18px 20px', flex: '1 1 240px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 12, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{formatCount(rev.deliveredCount)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>courses livrées</div>

      <Line label="Gains livreurs (part livreur)" value={formatF(rev.driverEarnings)} />
      <Line label="Commission DEM facturée" value={formatF(rev.commission.billed)} color="#0ea5e9" />
      <Line label="Remises promo (payées par DEM)" value={formatF(rev.promoCost)} />
      <Line label="Prix moyen d'une course (hors remise)" value={formatF(rev.avgDeliveryPrice)} color="#06b6d4" />

      <div style={{ borderTop: '1px solid rgba(0,119,182,0.12)', marginTop: 10, paddingTop: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>PAIEMENT DE CES COURSES</div>
        <Line label="Payées en ligne" value={formatCount(ch.online)} color="#22c55e" />
        <Line label="Payées en espèces (livreur)" value={formatCount(ch.cash)} />
        <Line label="Pas encore payées" value={formatCount(ch.unpaid)} color="#94a3b8" />
        <Line label="En litige" value={formatCount(ch.disputed)} color="#ef4444" />
      </div>
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
        Courses comptées à leur date de livraison. Prix moyen = ce que paie le client avant remise (part livreur + commission DEM).
        Les quatre modes de paiement couvrent toutes les courses livrées (leur somme = nombre de courses livrées).
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <PeriodCard label="Aujourd'hui" rev={data.today} />
        <PeriodCard label="7 derniers jours" rev={data.week} />
        <PeriodCard label="30 derniers jours" rev={data.month} />
      </div>
    </div>
  )
}
