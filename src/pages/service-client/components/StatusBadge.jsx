const MAP = {
  PENDING:  { bg: 'rgba(245,158,11,.12)', color: '#b45309', label: 'En attente' },
  ACTIVE:   { bg: 'rgba(34,197,94,.12)',  color: '#15803d', label: 'Actif' },
  REJECTED: { bg: 'rgba(239,68,68,.10)',  color: '#dc2626', label: 'Refusé' },
  APPROVED: { bg: 'rgba(34,197,94,.12)',  color: '#15803d', label: 'Approuvé' },
  SUSPENDED:{ bg: 'rgba(239,68,68,.10)',  color: '#dc2626', label: 'Suspendu' },
}

export default function StatusBadge({ status }) {
  const s = MAP[status] ?? { bg: '#f5f5f5', color: '#888', label: status ?? '—' }
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}
