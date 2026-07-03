const STATUS_COLORS = {
  PENDING: '#f59e0b', ACCEPTED: '#6366f1', PICKED_UP: '#8b5cf6',
  IN_TRANSIT: '#3b82f6', DELIVERED: '#22c55e', CANCELLED: '#ef4444', SCHEDULED: '#64748b',
}

export default function StatusDot({ status }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600, color: STATUS_COLORS[status] ?? 'var(--text-muted)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[status] ?? '#999' }} />
      {status}
    </span>
  )
}
