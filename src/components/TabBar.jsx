// Barre d'onglets commune — l'onglet ouvert vient de lib/useUrlTab.js.
export default function TabBar({ tabs, active, onChange }) {
  if (tabs.length < 2) return null
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap', flexShrink: 0 }}>
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
  )
}
