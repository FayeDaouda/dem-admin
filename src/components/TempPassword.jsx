import { useState } from 'react'
import { Copy, Check, X } from 'lucide-react'

// Mot de passe provisoire affiché dans la page, avec Copier (avant : fenêtre
// d'alerte du navigateur, impossible à copier et perdue si fermée trop vite).
export default function TempPassword({ who, password, note, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Mot de passe provisoire de {who} :</span>
        <code style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, background: '#fff', padding: '3px 10px', borderRadius: 6 }}>{password}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(password).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.6)', color: copied ? '#15803d' : 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer' }}
        >
          {copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
        </button>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }} title="Masquer"><X size={16} /></button>
      </div>
      <div style={{ fontSize: 12, color: '#92400e' }}>
        {note ?? 'Il ne sera plus affiché : notez-le et communiquez-le à l’utilisateur. Il devra le changer à sa première connexion.'}
      </div>
    </div>
  )
}
