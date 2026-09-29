import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { Wallet, Receipt, Ticket, BellRing, FileDown, Handshake, HandCoins } from 'lucide-react'
import StatCard from '../../../components/StatCard'
import { RevenueModal, FeesModal, TransactionsModal, PassModal, AlertsModal } from './FinanceKpiModals'
import { useAutoRefresh } from '../../../lib/useAutoRefresh'
import { formatF, formatCount } from '../../../lib/format'

const EXPORT_TYPE_LABELS = { pdf: 'PDF', csv: 'CSV' }

// Toutes les cartes "du jour" = jour calendaire en cours ; chaque modal
// s'ouvre sur ce même jour, donc sur le même chiffre que sa carte.
export default function FinanceKpiRow({ reloadKey }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/kpis')
      setKpis(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])
  useAutoRefresh(() => load(true))

  const money = (x) => loading ? '…' : formatF(x)
  const count = (x) => loading ? '…' : formatCount(x)
  const outstanding = kpis?.outstandingCommission

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon={Wallet} label="Revenus DEM facturés (jour)" value={money(kpis?.caToday)}
          sub={loading ? undefined : `Encaissés : ${formatF(kpis?.caCollectedToday)}`}
          color="#22c55e" onClick={() => setOpenModal('revenue')} />
        <StatCard icon={Handshake} label="Commission courses (jour)" value={money(kpis?.feesToday)}
          sub={loading ? undefined : `En ligne : ${formatF(kpis?.feesCollectedToday)} · À recouvrer : ${formatF(kpis?.feesToRecoverToday)}`}
          color="#0ea5e9" onClick={() => setOpenModal('fees')} />
        <StatCard icon={HandCoins} label="Commission à recouvrer (cumul)" value={money(outstanding?.total)}
          sub={loading ? undefined : `Cash chez les livreurs : ${formatF(outstanding?.cash)} · Non payée : ${formatF((outstanding?.unpaid ?? 0) + (outstanding?.disputed ?? 0))}`}
          color="#f97316" />
        <StatCard icon={Receipt} label="Livraisons payées (jour)" value={count(kpis?.transactionsToday)}
          sub={loading ? undefined : `sur ${formatCount(kpis?.deliveredToday)} livrée(s) aujourd'hui`}
          color="#8b5cf6" onClick={() => setOpenModal('transactions')} />
        <StatCard icon={Ticket} label="Pass achetés (jour)" value={count(kpis?.passActivatedToday)}
          sub={loading ? undefined : `+ ${formatCount(kpis?.passGiftedToday)} offert(s)`}
          color="#f59e0b" onClick={() => setOpenModal('pass')} />
        <StatCard
          icon={BellRing}
          label="Dernière alerte financière"
          value={loading ? '…' : (kpis?.lastAlert ? kpis.lastAlert.message : 'Aucune alerte')}
          sub={kpis?.lastAlert ? new Date(kpis.lastAlert.triggeredAt).toLocaleString('fr-FR') : (kpis?.alertCount === 0 ? 'Tout est normal' : undefined)}
          color={kpis?.lastAlert ? (kpis.lastAlert.severity === 'high' ? '#ef4444' : '#f59e0b') : '#22c55e'}
          onClick={() => setOpenModal('alerts')}
        />
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
      {openModal === 'alerts'       && <AlertsModal       icon={BellRing} color="#ef4444" onClose={() => setOpenModal(null)} />}
    </>
  )
}
