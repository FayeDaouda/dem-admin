import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, X } from 'lucide-react'
import api from '../lib/api'
import { connectSocket } from '../lib/socket'
import { useAuth } from '../contexts/AuthContext'
import { isSuperRole, asksSuper, roleHas } from '../lib/droits'
import { beep } from '../lib/beep'
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from '../lib/requestKinds'

/**
 * Demandes du Responsable de flottes (C10), en haut de toutes les pages :
 *  - Super Admin : bandeau rouge et sonore tant qu'une demande URGENTE attend ;
 *    les autres arrivent dans la cloche et l'onglet Validation › Demandes Flotte ;
 *  - Responsable de flottes : message à chaque décision (validée, refusée,
 *    précision demandée), avec un lien vers « Mes demandes ».
 */
export default function RequestAlerts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSuper = isSuperRole(user?.adminRole)
  const isRequester = !isSuper && asksSuper(user?.adminRole)
  const [urgent, setUrgent] = useState([])
  const [decisions, setDecisions] = useState([]) // { id, kind, status }
  const known = useRef(new Set())
  // « Mes demandes » : Validation (Resp. flottes) ou Poste Commercial
  const myRequestsPath = roleHas(user?.adminRole, 'FLOTTE') ? '/validation?tab=my-requests' : '/service-client?tab=requests'

  const loadUrgent = useCallback(async () => {
    try {
      const res = await api.get('/admin/requests', { params: { status: 'PENDING', origin: 'FLOTTE' } })
      const list = (res.data?.requests ?? []).filter(r => r.urgent)
      if (list.some(r => !known.current.has(r.id))) beep({ count: 3, frequency: 760 })
      known.current = new Set(list.map(r => r.id))
      setUrgent(list)
    } catch { /* pas de bandeau plutôt qu'une erreur */ }
  }, [])

  useEffect(() => {
    if (!isSuper && !isRequester) return
    const s = connectSocket()
    let first, timer
    const onNew = () => loadUrgent()
    const onDecided = d => d?.id && setDecisions(list => [d, ...list.filter(x => x.id !== d.id)].slice(0, 3))
    if (isSuper) {
      first = setTimeout(loadUrgent, 0)
      timer = setInterval(loadUrgent, 60_000)
      s.on('admin:request:new', onNew)
    } else {
      s.on('admin:request:decided', onDecided)
    }
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      s.off('admin:request:new', onNew)
      s.off('admin:request:decided', onDecided)
    }
  }, [isSuper, isRequester, loadUrgent])

  if (urgent.length === 0 && decisions.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px 0', flexShrink: 0 }}>
      {urgent.map(r => (
        <div key={r.id} role="alert" style={{ ...bar, background: '#dc2626', boxShadow: '0 6px 20px #dc262655' }}>
          <Send size={18} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Demande urgente — {REQUEST_KIND_LABELS[r.kind] ?? r.kind}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {r.submittedBy?.name ?? 'Responsable de flottes'}
              {r.targetUser && ` · ${r.targetUser.name ?? r.targetUser.phone}`}
              {r.reason && ` · ${r.reason}`}
            </div>
          </div>
          <button onClick={() => navigate(`/validation?tab=fleet-requests&highlight=${r.id}`)} style={{ ...btn, background: '#fff', color: '#dc2626' }}>Décider</button>
        </div>
      ))}
      {decisions.map(d => {
        const color = d.status === 'APPROVED' ? '#16a34a' : d.status === 'REJECTED' ? '#dc2626' : '#4f46e5'
        return (
          <div key={d.id} role="status" style={{ ...bar, background: color }}>
            <Send size={18} />
            <div style={{ flex: 1, minWidth: 200, fontWeight: 700, fontSize: 13.5 }}>
              Votre demande « {REQUEST_KIND_LABELS[d.kind] ?? d.kind} » : {(REQUEST_STATUS_LABELS[d.status] ?? d.status).toLowerCase()}
            </div>
            <button onClick={() => { navigate(myRequestsPath); setDecisions(l => l.filter(x => x.id !== d.id)) }} style={btn}>Voir</button>
            <button onClick={() => setDecisions(l => l.filter(x => x.id !== d.id))} style={{ ...btn, padding: '6px 8px' }} title="Fermer"><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

const bar = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: '#fff', borderRadius: 12, padding: '10px 14px' }
const btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.18)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.45)', borderRadius: 8,
  padding: '6px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
}
