const STATUS_COLORS = {
  PENDING:    { bg: '#f59e0b22', color: '#f59e0b', label: 'En attente' },
  ACCEPTED:   { bg: '#6366f122', color: '#818cf8', label: 'Acceptée' },
  IN_TRANSIT: { bg: '#38bdf822', color: '#38bdf8', label: 'En transit' },
  DELIVERED:  { bg: '#22c55e22', color: '#22c55e', label: 'Livrée' },
  CANCELLED:  { bg: '#ef444422', color: '#ef4444', label: 'Annulée' },
  PAID:       { bg: '#22c55e22', color: '#22c55e', label: 'Payée' },
  DISPUTED:   { bg: '#ef444422', color: '#ef4444', label: 'Litige' },
  ONLINE:     { bg: '#22c55e22', color: '#22c55e', label: 'En ligne' },
  OFFLINE:    { bg: '#7c849922', color: '#7c8499', label: 'Hors ligne' },
  FLAGGED:    { bg: '#ef444422', color: '#ef4444', label: 'Signalé' },
  RIDE:       { bg: '#6366f122', color: '#818cf8', label: 'Course' },
  DELIVERY:   { bg: '#38bdf822', color: '#38bdf8', label: 'Livraison' },
}

export default function Badge({ status, label }) {
  const cfg = STATUS_COLORS[status] ?? { bg: '#7c849922', color: '#7c8499', label: status }
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label ?? cfg.label}
    </span>
  )
}
