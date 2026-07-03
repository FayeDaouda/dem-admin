import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { AlertTriangle, Star, Package, Briefcase, ClipboardList } from 'lucide-react'
import StatCard from '../../../components/StatCard'

export default function KpiRow({ reloadKey }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/service-client/kpis')
      setKpis(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])

  const v = (x) => loading ? '…' : x ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
      <StatCard icon={AlertTriangle} label="Incidents ouverts"       value={v(kpis?.openIncidents)} color="#ef4444" />
      <StatCard icon={Star}          label="Livreurs notés < 3/5"    value={v(kpis?.lowRatingDrivers)} color="#f59e0b" />
      <StatCard icon={Star}          label="Clients notés < 3/5"     value={v(kpis?.lowRatingClients)} color="#f59e0b" />
      <StatCard icon={Package}       label="Taux annulation (jour)"  value={loading ? '…' : `${kpis?.cancellationRateToday ?? 0}%`} color="#6366f1" />
      <StatCard icon={Briefcase}     label="DEM Pro actifs / total"  value={loading ? '…' : `${kpis?.activeProAccounts ?? 0} / ${kpis?.totalProAccounts ?? 0}`} color="#06b6d4" />
      <StatCard icon={ClipboardList} label="Demandes en attente"     value={v(kpis?.pendingRequests)} color="#8b5cf6" />
    </div>
  )
}
