import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { UserPlus, Repeat, XCircle, CheckCircle, UserMinus, Bell } from 'lucide-react'
import StatCard from '../../../components/StatCard'

const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Livreurs', dem_pro: 'DEM Pro' }

export default function MarketingKpiRow({ reloadKey }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/kpis')
      setKpis(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])

  const v = (x) => loading ? '…' : x ?? 0
  const lastBroadcast = kpis?.lastBroadcast

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
      <StatCard icon={UserPlus}    label="Nouveaux clients (jour)"   value={v(kpis?.newClientsToday)} color="#06b6d4" />
      <StatCard icon={Repeat}      label="Taux rétention (mois)"     value={loading ? '…' : `${kpis?.monthlyRetentionRate ?? 0}%`} color="#8b5cf6" />
      <StatCard icon={XCircle}     label="Taux annulation (jour)"    value={loading ? '…' : `${kpis?.cancellationRateToday ?? 0}%`} color="#ef4444" />
      <StatCard icon={CheckCircle} label="Courses complétées (jour)" value={v(kpis?.completedToday)} color="#22c55e" />
      <StatCard icon={UserMinus}   label="Clients inactifs (+30j)"   value={v(kpis?.inactiveClients)} color="#f59e0b" />
      <StatCard
        icon={Bell}
        label="Dernière notification push"
        value={loading ? '…' : (lastBroadcast ? new Date(lastBroadcast.sentAt).toLocaleDateString('fr-FR') : '—')}
        sub={lastBroadcast ? TARGET_LABELS[lastBroadcast.target] ?? lastBroadcast.target : undefined}
        color="#6366f1"
      />
    </div>
  )
}
