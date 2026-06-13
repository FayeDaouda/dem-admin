import { useState, useEffect, useCallback } from 'react'
import fleetApi from '../../lib/fleetApi'
import { useFleetAuth } from '../../contexts/FleetAuthContext'
import { Truck, CheckCircle, Clock, XCircle, Package, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react'
import { glass, pageWrap, pageScroll } from '../../lib/glassStyles'

function StatCard({ icon: Icon, label, value, sub, color = 'var(--primary)' }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 42, height: 42,
        borderRadius: 'var(--radius-sm)',
        background: color + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function FleetDashboard() {
  const { fleetUser } = useFleetAuth()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fleetApi.get('/chefs-de-flotte/me/stats')
      setStats(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Bienvenue {fleetUser?.name?.trim() || fleetUser?.phone}
          </div>
        </div>
        <button onClick={fetchStats} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
      </div>

      <div style={pageScroll}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : !stats ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Impossible de charger les statistiques.</div>
        ) : (
          <>
            {stats.isFleetReady ? (
              <div style={{ ...glass, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, color: '#22c55e' }}>
                <ShieldCheck size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Votre flotte est prête (≥ {stats.fleetMin} livreurs actifs).</span>
              </div>
            ) : (
              <div style={{ ...glass, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b' }}>
                <AlertTriangle size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Il vous faut au moins {stats.fleetMin} livreurs actifs ({stats.activeCount}/{stats.fleetMin}) pour activer votre flotte.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <StatCard icon={Truck}       label="Taille de la flotte"   value={`${stats.fleetSize} / ${stats.fleetMax}`} color="#0077b6" />
              <StatCard icon={CheckCircle} label="Livreurs actifs"       value={stats.activeCount}   color="#22c55e" />
              <StatCard icon={Clock}       label="En attente"            value={stats.pendingCount}  color="#f59e0b" />
              <StatCard icon={XCircle}     label="Refusés"               value={stats.rejectedCount} color="#ef4444" />
              <StatCard icon={Package}     label="Courses livrées"       value={stats.totalCourses}  color="#7c3aed" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
