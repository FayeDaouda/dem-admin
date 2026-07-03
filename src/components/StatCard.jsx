import { glass } from '../lib/glassStyles'

export default function StatCard({ icon: Icon, label, value, color = 'var(--primary)', sub }) {
  return (
    <div style={{
      ...glass, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={17} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}
