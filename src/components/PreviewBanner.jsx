import { useNavigate } from 'react-router-dom'
import { Eye, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Aperçu d'un rôle (Super Admin) : rappelé en haut de toutes les pages, avec
// la sortie. Le serveur répond comme pour ce rôle et refuse toute action.
export default function PreviewBanner() {
  const { preview, stopPreview } = useAuth()
  const navigate = useNavigate()
  if (!preview) return null

  function quit() {
    stopPreview()
    navigate('/equipes?tab=roles')
  }

  return (
    <div style={{ padding: '8px 12px 0', flexShrink: 0 }}>
      <div role="status" style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: preview.color ?? '#0ea5e9', color: '#fff', borderRadius: 12, padding: '9px 14px',
      }}>
        <Eye size={18} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Aperçu : vous voyez l'admin comme « {preview.label} »</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Menu, pages, boutons et données de ce rôle. Lecture seule : les actions sont refusées pendant l'aperçu.</div>
        </div>
        <button onClick={quit} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: preview.color ?? '#0ea5e9',
          border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          <X size={14} /> Quitter l'aperçu
        </button>
      </div>
    </div>
  )
}
