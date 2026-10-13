import { useLocation } from 'react-router-dom'
import InfoTip from './InfoTip'
import { pageHelp } from '../lib/aide'

// En-tête commun des pages admin : titre, phrase d'aide, actions à droite.
// Le ⓘ à côté du titre explique la page (lib/aide.js, d'après l'adresse).
export default function PageHeader({ title, subtitle, actions }) {
  const { pathname } = useLocation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center' }}>{title}<InfoTip title={title} text={pageHelp(pathname)} size={16} /></h1>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: 12.5, margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </div>
  )
}
