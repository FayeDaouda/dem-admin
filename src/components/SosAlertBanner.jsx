import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Siren, MapPin, Phone, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { connectSocket } from '../lib/socket'
import { useAuth } from '../contexts/AuthContext'

// Rôles qui voient la page Incidents — ce sont eux qu'une alerte SOS doit
// atteindre, où qu'ils soient dans l'admin.
const SOS_ROLES = ['SUPER', 'DEV', 'SERVICE_CLIENT', 'ASSISTANCE_EXECUTIVE']

// 3 bips courts — un SOS ne doit pas passer inaperçu dans un onglet ouvert.
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.35, 0.7].forEach(t => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.value = 0.08
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.2)
    })
  } catch { /* audio bloqué par le navigateur : le bandeau suffit */ }
}

function since(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return min < 1 ? "à l'instant" : `il y a ${min} min`
}

/**
 * Bandeau rouge en haut de TOUTES les pages tant qu'une alerte SOS livreur
 * est « Nouveau » (non prise en charge). Disparaît dès qu'un admin passe
 * l'incident « En cours » ou « Résolu » dans la page Incidents.
 */
export default function SosAlertBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [, tick] = useState(0)
  const allowed = !user?.adminRole || SOS_ROLES.includes(user.adminRole)
  const known = useRef(new Set())

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/incidents', { params: { type: 'SOS', status: 'OPEN' } })
      setAlerts(res.data?.incidents ?? [])
    } catch { /* pas de bandeau plutôt qu'une erreur */ }
  }, [])

  useEffect(() => {
    if (!allowed) return
    // Premier chargement différé d'un tick : l'état n'est mis à jour qu'à la
    // réponse de l'API, jamais pendant le rendu de l'effet.
    const first = setTimeout(load, 0)
    const s = connectSocket()
    const onSos = (d) => {
      if (d?.incidentId && !known.current.has(d.incidentId)) {
        known.current.add(d.incidentId)
        beep()
      }
      load()
    }
    s.on('admin:incident:sos', onSos)
    s.on('admin:incident:sos_safe', load)
    // Rafraîchit « il y a X min » et rattrape une prise en charge faite
    // depuis un autre poste.
    const timer = setInterval(() => { tick(n => n + 1); load() }, 60000)
    return () => {
      s.off('admin:incident:sos', onSos)
      s.off('admin:incident:sos_safe', load)
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [allowed, load])

  if (!allowed || alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px 0', flexShrink: 0 }}>
      {alerts.map(a => {
        const safe = !!a.meta?.safeAt
        const bg = safe ? '#16a34a' : '#dc2626'
        return (
          <div
            key={a.id}
            role="alert"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              background: bg, color: '#fff', borderRadius: 12, padding: '10px 14px',
              boxShadow: `0 6px 20px ${bg}55`,
              animation: safe ? undefined : 'sosPulse 1.6s ease-in-out infinite',
            }}
          >
            {safe ? <ShieldCheck size={20} /> : <Siren size={20} />}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {safe
                  ? `${a.driverName ?? 'Le livreur'} indique être en sécurité — SOS à clore`
                  : `SOS livreur — ${a.driverName ?? 'livreur'}`}
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                {since(a.openedAt)}
                {a.orderId ? ` · course ${a.orderId.slice(0, 8).toUpperCase()}` : ' · hors course'}
                {a.meta?.emergencyContact ? ` · contact : ${a.meta.emergencyContact.name ?? ''} ${a.meta.emergencyContact.phone}` : ' · aucun contact d’urgence'}
              </div>
            </div>
            {a.driverPhone && (
              <a href={`tel:${a.driverPhone}`} style={bannerBtn}>
                <Phone size={14} /> {a.driverPhone}
              </a>
            )}
            {a.meta?.mapsUrl && (
              <a href={a.meta.mapsUrl} target="_blank" rel="noreferrer" style={bannerBtn}>
                <MapPin size={14} /> Position
              </a>
            )}
            <button onClick={() => navigate('/incidents', { state: { focusIncidentId: a.id } })} style={{ ...bannerBtn, background: '#fff', color: bg }}>
              Prendre en charge
            </button>
          </div>
        )
      })}
      <style>{'@keyframes sosPulse { 0%,100% { opacity: 1 } 50% { opacity: .82 } }'}</style>
    </div>
  )
}

const bannerBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.18)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.45)', borderRadius: 8,
  padding: '6px 10px', fontSize: 12.5, fontWeight: 700,
  textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
}
