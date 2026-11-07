import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Clock, Gift, CreditCard, Activity, PackageX, Package } from 'lucide-react'
import api from '../../../lib/api'
import StatCard from '../../../components/StatCard'
import { useAutoRefresh } from '../../../lib/useAutoRefresh'

// Poste Commercial — compteurs Pro à la place des compteurs opérations
// (GET /admin/dem-pro/kpis). Pro actif = au moins une commande sur 7 jours.
export default function ProKpiRow({ reloadKey }) {
  const navigate = useNavigate()
  const [k, setK] = useState(null)

  const load = useCallback(() => api.get('/admin/dem-pro/kpis').then(r => setK(r.data)).catch(() => {}), [])
  useEffect(() => { load() }, [load, reloadKey])
  useAutoRefresh(load)

  const v = x => (k ? x : '…')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 18 }}>
      <StatCard icon={Briefcase}  label="Comptes Pro"                 value={v(k?.registered)} color="#0077b6" onClick={() => navigate('/dem-pro')} />
      <StatCard icon={Clock}      label="En attente de validation"    value={v(k?.pending)}    color="#f59e0b" onClick={() => navigate('/validation?tab=dem-pro')} />
      <StatCard icon={Gift}       label="En essai"                    value={v(k?.trial)}      color="#7c3aed" />
      <StatCard icon={CreditCard} label="Abonnés payants"             value={v(k?.paying)}     color="#16a34a" />
      <StatCard icon={Activity}   label={`Pro actifs (${k?.activeDays ?? 7} j)`} value={v(k?.active)} sub="au moins 1 commande" color="#22c55e" />
      <StatCard icon={PackageX}   label="Validés sans commande"       value={v(k?.neverOrdered)} color="#dc2626" />
      <StatCard icon={Package}    label="Commandes Pro aujourd'hui"   value={v(k?.ordersToday)} color="#0ea5e9" onClick={() => navigate('/orders?pro=1')} />
    </div>
  )
}
