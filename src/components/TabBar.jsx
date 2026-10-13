import { useLocation } from 'react-router-dom'
import InfoTip from './InfoTip'
import { tabHelp } from '../lib/aide'

// Barre d'onglets commune — l'onglet ouvert vient de lib/useUrlTab.js.
// Le ⓘ à droite de la barre explique l'onglet ouvert (lib/aide.js, ONGLETS).
export default function TabBar({ tabs, active, onChange }) {
  const { pathname } = useLocation()
  if (tabs.length < 2) return null
  const current = tabs.find(t => t.key === active)
  const title = current?.infoTitle ?? (typeof current?.label === 'string' ? current.label : undefined)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, flexShrink: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            background: active === key ? 'var(--primary)' : 'transparent',
            color: active === key ? '#fff' : 'var(--text-muted)',
            fontWeight: active === key ? 700 : 500, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {Icon && <Icon size={13} />} {label}
          </button>
        ))}
      </div>
      <InfoTip title={title} text={tabHelp(pathname, active)} size={15} />
    </div>
  )
}
