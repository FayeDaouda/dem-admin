import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { Package, TrendingUp, AlertTriangle, Bike, Star, XCircle, Briefcase } from 'lucide-react'
import StatCard from '../../../components/StatCard'
import {
  CoursesModal, ActiveOrdersModal, StuckPendingOrdersModal, DriverActivityModal,
  IncidentsModal, LowRatingModal, CancellationRateModal, DemProAccountsModal,
} from './ServiceClientKpiModals'

export default function KpiRow({ reloadKey }) {
  const [stats, setStats] = useState(null)
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, kpisRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/service-client/kpis'),
      ])
      setStats(statsRes.data)
      setKpis(kpisRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])

  const v = (x) => loading ? '…' : x ?? 0

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon={Package}       label="Courses"                              value={v(stats?.orders?.total)}   color="#0077b6" onClick={() => setOpenModal('courses')} />
        <StatCard icon={TrendingUp}    label="Courses en cours — activité récente"  value={v(stats?.orders?.active)}  color="#6366f1" onClick={() => setOpenModal('active')} />
        <StatCard icon={AlertTriangle} label="Courses en attente — sans livreur..." value={v(stats?.orders?.pending)} color="#f59e0b" onClick={() => setOpenModal('pending')} />
        <StatCard icon={Bike}          label="Livreurs actifs"                      value={v(stats?.drivers?.available)} sub={`/ ${stats?.drivers?.total ?? 0}`} color="#22c55e" onClick={() => setOpenModal('drivers')} />
        <StatCard icon={AlertTriangle} label="Incidents ouverts"                    value={v(kpis?.openIncidents)}    color="#ef4444" onClick={() => setOpenModal('incidents')} />
        <StatCard icon={Star}          label="Livreurs notés < 3/5"                 value={v(kpis?.lowRatingDrivers)} color="#f59e0b" onClick={() => setOpenModal('lowDrivers')} />
        <StatCard icon={Star}          label="Clients notés < 3/5"                  value={v(kpis?.lowRatingClients)} color="#f59e0b" onClick={() => setOpenModal('lowClients')} />
        <StatCard icon={XCircle}       label="Taux annulation (jour)"               value={loading ? '…' : `${kpis?.cancellationRateToday ?? 0}%`} color="#6366f1" onClick={() => setOpenModal('cancellation')} />
        <StatCard icon={Briefcase}     label="DEM Pro actifs / total"               value={loading ? '…' : `${kpis?.activeProAccounts ?? 0} / ${kpis?.totalProAccounts ?? 0}`} color="#06b6d4" onClick={() => setOpenModal('demPro')} />
      </div>

      {openModal === 'courses'      && <CoursesModal            icon={Package}       color="#0077b6" onClose={() => setOpenModal(null)} />}
      {openModal === 'active'       && <ActiveOrdersModal       icon={TrendingUp}    color="#6366f1" onClose={() => setOpenModal(null)} />}
      {openModal === 'pending'      && <StuckPendingOrdersModal icon={AlertTriangle} color="#f59e0b" onClose={() => setOpenModal(null)} />}
      {openModal === 'drivers'      && <DriverActivityModal     icon={Bike}          color="#22c55e" onClose={() => setOpenModal(null)} />}
      {openModal === 'incidents'    && <IncidentsModal          icon={AlertTriangle} color="#ef4444" onClose={() => setOpenModal(null)} />}
      {openModal === 'lowDrivers'   && <LowRatingModal          icon={Star}          color="#f59e0b" onClose={() => setOpenModal(null)} role="DRIVER" title="Livreurs notés < 3/5" />}
      {openModal === 'lowClients'   && <LowRatingModal          icon={Star}          color="#f59e0b" onClose={() => setOpenModal(null)} role="CLIENT" title="Clients notés < 3/5" />}
      {openModal === 'cancellation' && <CancellationRateModal   icon={XCircle}       color="#6366f1" onClose={() => setOpenModal(null)} />}
      {openModal === 'demPro'       && <DemProAccountsModal     icon={Briefcase}     color="#06b6d4" onClose={() => setOpenModal(null)} />}
    </>
  )
}
