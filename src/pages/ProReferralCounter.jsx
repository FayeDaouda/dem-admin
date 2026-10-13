import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import { glass } from '../lib/glassStyles'

// Compteur des parrainages DEM Pro sur la page Parrainage (plan de refonte,
// 3.9) : la liste et les récompenses restent dans DEM Pro › Parrainage, où ce
// compteur mène. Super Admin seul (voir lib/droits.js).
export default function ProReferralCounter() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/admin/dem-pro/referrals', { params: { limit: 1 } })
      .then(r => setData(r.data))
      .catch(() => {})
  }, [])

  return (
    <button onClick={() => navigate('/dem-pro?onglet=parrainage')} style={{
      ...glass, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flex: '1 1 220px',
      border: '1px solid rgba(2,132,199,.3)', cursor: 'pointer', textAlign: 'left',
    }}>
      <Briefcase size={18} color="#0284c7" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px' }}>PARRAINAGES DEM PRO</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{data ? data.total : '…'}</div>
        {data && <div style={{ fontSize: 11, color: data.toReward > 0 ? '#b45309' : 'var(--text-muted)' }}>{data.toReward} à récompenser · voir dans DEM Pro</div>}
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </button>
  )
}
