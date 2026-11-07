import { MessageCircle } from 'lucide-react'
import { whatsappLink } from '../lib/whatsapp'

// Bouton WhatsApp (C8) — `compact` : icône seule, pour une liste.
export default function WhatsAppButton({ phone, compact = false, label = 'WhatsApp' }) {
  const href = whatsappLink(phone)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" title={`WhatsApp ${phone}`} onClick={e => e.stopPropagation()} style={compact ? {
      display: 'inline-flex', color: '#16a34a',
    } : {
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
      color: '#16a34a', border: '1px solid rgba(22,163,74,.4)', background: 'rgba(22,163,74,.08)', textDecoration: 'none', whiteSpace: 'nowrap',
    }}>
      <MessageCircle size={compact ? 14 : 13} />{!compact && ` ${label}`}
    </a>
  )
}
