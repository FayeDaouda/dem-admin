import { glassInput } from '../../../lib/glassStyles'

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  ['today', "Aujourd'hui", () => ({ from: isoDaysAgo(0), to: isoDaysAgo(0) })],
  ['7d',    '7 jours',      () => ({ from: isoDaysAgo(7), to: isoDaysAgo(0) })],
  ['30d',   '30 jours',     () => ({ from: isoDaysAgo(30), to: isoDaysAgo(0) })],
]

// Filtre période personnalisée — lève { from, to } (ISO yyyy-mm-dd) au parent
export default function DateRangeFilter({ value, onChange }) {
  const { from, to } = value

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {PRESETS.map(([key, label, range]) => (
        <button
          key={key}
          onClick={() => onChange(range())}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)',
          }}
        >
          {label}
        </button>
      ))}
      <input type="date" value={from ?? ''} onChange={e => onChange({ from: e.target.value, to })} style={{ ...glassInput, width: 140, padding: '5px 10px', fontSize: 12 }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
      <input type="date" value={to ?? ''} onChange={e => onChange({ from, to: e.target.value })} style={{ ...glassInput, width: 140, padding: '5px 10px', fontSize: 12 }} />
    </div>
  )
}
