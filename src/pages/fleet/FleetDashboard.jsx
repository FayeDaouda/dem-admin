import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import fleetApi from '../../lib/fleetApi'
import { useFleetAuth } from '../../contexts/FleetAuthContext'
import { Radio, Navigation, Wallet, WifiOff, Bell, ShieldCheck, AlertTriangle, RefreshCw, Package } from 'lucide-react'
import { glass, pageWrap, pageScroll } from '../../lib/glassStyles'

const PERIOD_TABS = [
  ['today',     "Aujourd'hui"],
  ['week',      '7 jours'],
  ['month',     '30 jours'],
  ['sixMonths', '6 mois'],
]

function StatCard({ icon: Icon, label, value, sub, color = 'var(--primary)', onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ ...glass, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: onClick ? 'pointer' : 'default' }}
    >
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
  const navigate = useNavigate()
  const { fleetUser } = useFleetAuth()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('today')

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, flexShrink: 0 }}>
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
                <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Votre flotte est prête (≥ {stats.fleetMin} livreurs actifs).</span>
              </div>
            ) : (
              <div style={{ ...glass, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Il vous faut au moins {stats.fleetMin} livreurs actifs ({stats.activeCount}/{stats.fleetMin}) pour activer votre flotte.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <StatCard icon={Radio}      label="Livreurs en ligne"              value={`${stats.onlineCount} / ${stats.fleetSize}`} color="#22c55e" />
              <StatCard icon={Navigation} label="Courses en cours"               value={stats.coursesInProgress} color="#7c3aed" />
              <StatCard icon={Wallet}     label="Gains de la flotte (aujourd'hui)" value={`${stats.earningsToday.toLocaleString()} F`} color="#0077b6" />
              <StatCard icon={WifiOff}    label="Livreurs hors ligne"            value={stats.offlineCount} color="#94a3b8" />
              <StatCard icon={Bell}       label="Alertes en cours"               value={stats.alertsCount} color="#ef4444" onClick={() => navigate('/fleet/alerts')} />
            </div>

            <div style={{ ...glass, padding: 18, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Activité de la flotte</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PERIOD_TABS.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPeriod(key)}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                        border: '1px solid rgba(0,119,182,0.25)', cursor: 'pointer',
                        background: period === key ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                        color: period === key ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <StatCard icon={Package} label="Courses livrées"      value={stats.statsByPeriod[period].courses} color="#22c55e" />
                <StatCard icon={Wallet}  label="Gains de la flotte"    value={`${stats.statsByPeriod[period].earnings.toLocaleString()} F`} color="#0077b6" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
