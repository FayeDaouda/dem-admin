import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { Wallet, TrendingUp, Receipt, Ticket, BellRing, FileDown } from 'lucide-react'
import StatCard from '../../../components/StatCard'

const EXPORT_TYPE_LABELS = { pdf: 'PDF', csv: 'CSV' }

export default function FinanceKpiRow({ reloadKey }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/finance/kpis')
      setKpis(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])

  const v = (x) => loading ? '…' : (x ?? 0).toLocaleString()
  const monthDelta = kpis && kpis.caLastMonth > 0
    ? Math.round(((kpis.caThisMonth - kpis.caLastMonth) / kpis.caLastMonth) * 100)
    : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
      <StatCard icon={Wallet}     label="CA aujourd'hui"        value={loading ? '…' : `${v(kpis?.caToday)} F`} color="#22c55e" />
      <StatCard
        icon={TrendingUp}
        label="CA ce mois"
        value={loading ? '…' : `${v(kpis?.caThisMonth)} F`}
        sub={monthDelta != null ? `${monthDelta >= 0 ? '+' : ''}${monthDelta}% vs mois précédent` : undefined}
        color="#06b6d4"
      />
      <StatCard icon={Receipt}    label="Transactions (jour)"   value={v(kpis?.transactionsToday)} color="#8b5cf6" />
      <StatCard icon={Ticket}     label="Pass activés (jour)"   value={v(kpis?.passActivatedToday)} color="#f59e0b" />
      <StatCard icon={BellRing}   label="Dernière alerte financière" value={loading ? '…' : 'Non disponible'} sub="Alertes email non configurées" color="#ef4444" />
      <StatCard
        icon={FileDown}
        label="Dernier export"
        value={loading ? '…' : (kpis?.lastExport ? `${EXPORT_TYPE_LABELS[kpis.lastExport.type] ?? kpis.lastExport.type}` : '—')}
        sub={kpis?.lastExport ? new Date(kpis.lastExport.at).toLocaleString('fr-FR') : undefined}
        color="#6366f1"
      />
    </div>
  )
}
