import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Map as MapIcon, Volume2, VolumeX } from 'lucide-react'
import api from '../lib/api'
import { connectSocket } from '../lib/socket'
import { useAuth } from '../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { beep } from '../lib/beep'

const SOUND_KEY = 'dem_admin_alerte_dispatch_son'
const POLL_MS = 30_000

function loadSound() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
}

/**
 * Alerte « course sans coursier » (Responsable de flottes, C4) : bandeau
 * rouge en haut de toutes les pages, avec un son à chaque nouvelle course
 * qui dépasse le délai réglé par le Super Admin (Maintenance, 3 min par
 * défaut). Pour les rôles qui attribuent les courses.
 */
export default function DispatchAlertBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const allowed = canSee(user?.adminRole, ACTION_ROLES.orderDispatch)
  const [data, setData] = useState(null) // { thresholdMin, total, orders }
  const [sound, setSound] = useState(loadSound)
  const soundRef = useRef(sound)
  const known = useRef(new Set())

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/stats/stuck-pending-orders', { params: { period: 'alert' } })
      const orders = res.data?.orders ?? []
      // Son pour toute course qui vient de dépasser le délai
      const fresh = orders.filter(o => !known.current.has(o.id))
      known.current = new Set(orders.map(o => o.id))
      if (fresh.length > 0 && soundRef.current) beep({ count: 2, frequency: 660 })
      setData({ ...res.data, checkedAt: Date.now() }) // heure de la lecture : attente affichée
    } catch { /* pas de bandeau plutôt qu'une erreur */ }
  }, [])

  useEffect(() => {
    if (!allowed) return
    const first = setTimeout(load, 0)
    const timer = setInterval(load, POLL_MS)
    const s = connectSocket()
    const events = ['admin:order:new', 'admin:order:accepted', 'admin:order:cancelled']
    events.forEach(ev => s.on(ev, load))
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      events.forEach(ev => s.off(ev, load))
    }
  }, [allowed, load])

  function toggleSound() {
    const next = !sound
    setSound(next)
    soundRef.current = next
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* stockage indisponible */ }
  }

  if (!allowed || !data?.total) return null

  const oldest = data.orders[0]
  const waitMin = oldest ? Math.max(0, Math.round((data.checkedAt - new Date(oldest.createdAt)) / 60000)) : null

  return (
    <div style={{ padding: '8px 12px 0', flexShrink: 0 }}>
      <div role="alert" style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: '#dc2626', color: '#fff', borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 6px 20px #dc262655', animation: 'dispatchPulse 1.6s ease-in-out infinite',
      }}>
        <Clock size={20} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>
            {data.total} course{data.total > 1 ? 's attendent' : ' attend'} un coursier depuis plus de {data.thresholdMin} min
          </div>
          {oldest && (
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              La plus ancienne : {waitMin} min · {oldest.pickupAddress ?? '—'}
            </div>
          )}
        </div>
        <button onClick={toggleSound} title={sound ? 'Couper le son' : 'Remettre le son'} style={bannerBtn}>
          {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <button onClick={() => navigate('/orders?statut=pending')} style={bannerBtn}>Courses en attente</button>
        <button onClick={() => navigate('/map')} style={{ ...bannerBtn, background: '#fff', color: '#dc2626' }}>
          <MapIcon size={14} /> Carte live
        </button>
      </div>
      <style>{'@keyframes dispatchPulse { 0%,100% { opacity: 1 } 50% { opacity: .85 } }'}</style>
    </div>
  )
}

const bannerBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.18)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.45)', borderRadius: 8,
  padding: '6px 10px', fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap',
}
