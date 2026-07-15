import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { Wallet, Receipt, Ticket, BellRing, FileDown, Handshake } from 'lucide-react'
import StatCard from '../../../components/StatCard'
import { RevenueModal, FeesModal, TransactionsModal, PassModal } from './FinanceKpiModals'

const EXPORT_TYPE_LABELS = { pdf: 'PDF', csv: 'CSV' }

export default function FinanceKpiRow({ reloadKey }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(null)

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

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon={Wallet}     label="CA aujourd'hui"        value={loading ? '…' : `${v(kpis?.caToday)} F`} color="#22c55e" onClick={() => setOpenModal('revenue')} />
        <StatCard icon={Handshake}  label="Frais de mise en relation (jour)" value={loading ? '…' : `${v(kpis?.feesToday)} F`} color="#0ea5e9" onClick={() => setOpenModal('fees')} />
        <StatCard icon={Receipt}    label="Transactions (jour)"   value={v(kpis?.transactionsToday)} color="#8b5cf6" onClick={() => setOpenModal('transactions')} />
        <StatCard icon={Ticket}     label="Pass activés (jour)"   value={v(kpis?.passActivatedToday)} color="#f59e0b" onClick={() => setOpenModal('pass')} />
        <StatCard icon={BellRing}   label="Dernière alerte financière" value={loading ? '…' : 'Non disponible'} sub="Alertes email non configurées" color="#ef4444" />
        <StatCard
          icon={FileDown}
          label="Dernier export"
          value={loading ? '…' : (kpis?.lastExport ? `${EXPORT_TYPE_LABELS[kpis.lastExport.type] ?? kpis.lastExport.type}` : '—')}
          sub={kpis?.lastExport ? new Date(kpis.lastExport.at).toLocaleString('fr-FR') : undefined}
          color="#6366f1"
        />
      </div>

      {openModal === 'revenue'      && <RevenueModal      icon={Wallet}    color="#22c55e" onClose={() => setOpenModal(null)} />}
      {openModal === 'fees'         && <FeesModal         icon={Handshake} color="#0ea5e9" onClose={() => setOpenModal(null)} />}
      {openModal === 'transactions' && <TransactionsModal icon={Receipt}  color="#8b5cf6" onClose={() => setOpenModal(null)} />}
      {openModal === 'pass'         && <PassModal         icon={Ticket}  color="#f59e0b" onClose={() => setOpenModal(null)} />}
    </>
  )
}
