import { useState, useEffect, useCallback } from 'react'
import api from '../../../lib/api'
import { Wallet, Receipt, Ticket, BellRing, Handshake, HandCoins, ChevronRight } from 'lucide-react'
import StatCard from '../../../components/StatCard'
import { RevenueModal, FeesModal, TransactionsModal, PassModal, AlertsModal } from './FinanceKpiModals'
import { useAutoRefresh } from '../../../lib/useAutoRefresh'
import { formatF, formatCount } from '../../../lib/format'

// Toutes les cartes "du jour" = jour calendaire en cours ; chaque modal
// s'ouvre sur ce même jour, donc sur le même chiffre que sa carte.
// La dernière alerte est un bandeau au-dessus des cartes (avant : une carte
// dont le long message étirait toute la rangée) ; le dernier export est
// remonté à la page (onKpis) pour s'afficher à côté des boutons d'export.
export default function FinanceKpiRow({ reloadKey, onKpis }) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/kpis')
      setKpis(res.data)
      onKpis?.(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [onKpis])

  useEffect(() => { load() }, [load, reloadKey])
  useAutoRefresh(() => load(true))

  const money = (x) => loading ? '…' : formatF(x)
  const count = (x) => loading ? '…' : formatCount(x)
  const outstanding = kpis?.outstandingCommission

  return (
    <>
      <AlertBanner kpis={kpis} loading={loading} onOpen={() => setOpenModal('alerts')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon={Wallet} label="Revenus DEM facturés (jour)" value={money(kpis?.caToday)}
          sub={loading ? undefined : `Encaissés : ${formatF(kpis?.caCollectedToday)}`}
          color="#22c55e" onClick={() => setOpenModal('revenue')} />
        <StatCard icon={Handshake} label="Commission courses (jour)" value={money(kpis?.feesToday)}
          sub={loading ? undefined : `En ligne : ${formatF(kpis?.feesCollectedToday)} · À recouvrer : ${formatF(kpis?.feesToRecoverToday)}`}
          color="#0ea5e9" onClick={() => setOpenModal('fees')} />
        <StatCard icon={HandCoins} label="Commission à recouvrer (cumul)" value={money(outstanding?.total)}
          sub={loading ? undefined : `Cash chez les coursiers : ${formatF(outstanding?.cash)} · Non payée : ${formatF((outstanding?.unpaid ?? 0) + (outstanding?.disputed ?? 0))}`}
          color="#f97316" />
        <StatCard icon={Receipt} label="Livraisons payées (jour)" value={count(kpis?.transactionsToday)}
          sub={loading ? undefined : `sur ${formatCount(kpis?.deliveredToday)} livrée(s) aujourd'hui`}
          color="#8b5cf6" onClick={() => setOpenModal('transactions')} />
        <StatCard icon={Ticket} label="Pass achetés (jour)" value={count(kpis?.passActivatedToday)}
          sub={loading ? undefined : `+ ${formatCount(kpis?.passGiftedToday)} offert(s)`}
          color="#f59e0b" onClick={() => setOpenModal('pass')} />
      </div>

      {openModal === 'revenue'      && <RevenueModal      icon={Wallet}    color="#22c55e" onClose={() => setOpenModal(null)} />}
      {openModal === 'fees'         && <FeesModal         icon={Handshake} color="#0ea5e9" onClose={() => setOpenModal(null)} />}
      {openModal === 'transactions' && <TransactionsModal icon={Receipt}  color="#8b5cf6" onClose={() => setOpenModal(null)} />}
      {openModal === 'pass'         && <PassModal         icon={Ticket}  color="#f59e0b" onClose={() => setOpenModal(null)} />}
      {openModal === 'alerts'       && <AlertsModal       icon={BellRing} color="#ef4444" onClose={() => setOpenModal(null)} />}
    </>
  )
}

// Bandeau fin de la dernière alerte financière — un clic ouvre la liste des
// alertes (même fenêtre qu'avant).
function AlertBanner({ kpis, loading, onOpen }) {
  if (loading && !kpis) return null
  const alert = kpis?.lastAlert
  const color = alert ? (alert.severity === 'high' ? '#ef4444' : '#d97706') : '#16a34a'
  return (
    <button onClick={onOpen} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
      padding: '9px 14px', marginBottom: 12, borderRadius: 10, border: `1px solid ${color}40`, background: color + '12', color: 'var(--text)', fontSize: 13,
    }}>
      <BellRing size={15} color={color} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{alert ? 'Dernière alerte' : 'Alertes financières'}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {alert ? alert.message : (kpis?.alertCount === 0 ? 'Aucune alerte — tout est normal' : 'Aucune alerte')}
      </span>
      {alert && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(alert.triggeredAt).toLocaleString('fr-FR')}</span>}
      <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
    </button>
  )
}
