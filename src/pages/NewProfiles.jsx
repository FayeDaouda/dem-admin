import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw, UserPlus, Bike, Briefcase, UserCog } from 'lucide-react'
import StatCard from '../components/StatCard'
import { pageWrap, pageScroll } from '../lib/glassStyles'

const PERIODS = [
  ['week',        'Semaine (7j)'],
  ['month',       'Mois'],
  ['threeMonths', '3 mois'],
  ['sixMonths',   '6 mois'],
]

export default function NewProfiles() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('week')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/acquisition')
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const v = (bucket) => loading ? '…' : bucket?.[period] ?? 0

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Nouveaux profils</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Nouvelles inscriptions par catégorie de compte.
          </p>
        </div>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {PERIODS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              padding: '6px 16px', borderRadius: 20,
              border: '1px solid rgba(0,119,182,.25)',
              background: period === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
              color: period === key ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={pageScroll}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatCard icon={UserPlus} label="Nouveaux clients"        value={v(data?.newClients)}       color="#06b6d4" />
          <StatCard icon={Bike}     label="Nouveaux livreurs"       value={v(data?.newDrivers)}       color="#6366f1" />
          <StatCard icon={Briefcase} label="Nouveaux DEM Pro"       value={v(data?.newDemPro)}        color="#7c3aed" />
          <StatCard icon={UserCog}  label="Nouveaux chefs de flotte" value={v(data?.newChefsDeFlotte)} color="#B8860B" />
        </div>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
