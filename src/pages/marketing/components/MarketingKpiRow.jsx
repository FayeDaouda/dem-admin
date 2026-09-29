import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { UserPlus, Repeat, XCircle, CheckCircle, UserCheck, UserMinus, Bell } from 'lucide-react'
import StatCard from '../../../components/StatCard'
import { NewClientsModal, RetentionModal, CancellationModal, CompletedOrdersModal, BroadcastHistoryModal } from './MarketingKpiModals'
import { useAutoRefresh } from '../../../lib/useAutoRefresh'

const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Livreurs', dem_pro: 'DEM Pro' }

export default function MarketingKpiRow({ reloadKey }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/marketing/kpis')
      setKpis(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])
  useAutoRefresh(() => load(true))

  const v = (x) => loading ? '…' : x ?? 0
  const lastBroadcast = kpis?.lastBroadcast

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon={UserPlus}    label="Nouveaux clients (jour)"   value={v(kpis?.newClientsToday)}
          sub="inscriptions du jour" color="#06b6d4" onClick={() => setOpenModal('newClients')} />
        <StatCard icon={Repeat}      label="Rétention 30 jours"        value={loading ? '…' : `${kpis?.retentionRate30d ?? 0}%`}
          sub="clients servis revenus d'une période à l'autre" color="#8b5cf6" onClick={() => setOpenModal('retention')} />
        <StatCard icon={XCircle}     label="Taux annulation (jour)"    value={loading ? '…' : `${kpis?.cancellationRateToday ?? 0}%`}
          sub={loading ? undefined : `${kpis?.cancellationToday?.cancelled ?? 0} annulée(s) sur ${kpis?.cancellationToday?.created ?? 0} créée(s) aujourd'hui`}
          color="#ef4444" onClick={() => setOpenModal('cancellation')} />
        <StatCard icon={CheckCircle} label="Courses livrées (jour)"    value={v(kpis?.completedToday)} color="#22c55e" onClick={() => setOpenModal('completed')} />
        <StatCard icon={UserCheck}   label="Clients actifs"           value={v(kpis?.activeClients)}
          sub="servis sur les 30 derniers jours" color="#22c55e" onClick={() => setOpenModal('active')} />
        <StatCard icon={UserMinus}   label="Clients inactifs"         value={v(kpis?.inactiveClients)}
          sub="déjà servis, pas depuis 30 jours" color="#f59e0b" onClick={() => setOpenModal('inactive')} />
        <StatCard
          icon={Bell}
          label="Dernière notification push"
          value={loading ? '…' : (lastBroadcast ? new Date(lastBroadcast.sentAt).toLocaleDateString('fr-FR') : '—')}
          sub={lastBroadcast ? TARGET_LABELS[lastBroadcast.target] ?? lastBroadcast.target : undefined}
          color="#6366f1"
          onClick={() => setOpenModal('broadcast')}
        />
      </div>

      {openModal === 'newClients'   && <NewClientsModal      icon={UserPlus}    color="#06b6d4" onClose={() => setOpenModal(null)} />}
      {openModal === 'retention'    && <RetentionModal       icon={Repeat}      color="#8b5cf6" onClose={() => setOpenModal(null)} focus="retention" />}
      {openModal === 'cancellation' && <CancellationModal    icon={XCircle}     color="#ef4444" onClose={() => setOpenModal(null)} />}
      {openModal === 'completed'    && <CompletedOrdersModal icon={CheckCircle} color="#22c55e" onClose={() => setOpenModal(null)} />}
      {openModal === 'active'       && <RetentionModal       icon={UserCheck}   color="#22c55e" onClose={() => setOpenModal(null)} focus="active" />}
      {openModal === 'inactive'     && <RetentionModal       icon={UserMinus}   color="#f59e0b" onClose={() => setOpenModal(null)} focus="inactive" />}
      {openModal === 'broadcast'    && <BroadcastHistoryModal icon={Bell}       color="#6366f1" onClose={() => setOpenModal(null)} />}
    </>
  )
}
