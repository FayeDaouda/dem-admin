export const glass = {
  background: 'rgba(255,255,255,0.60)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.75)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 8px 32px rgba(0,119,182,0.10), 0 1px 4px rgba(0,0,0,0.04)',
}

export const glassModal = {
  ...glass,
  padding: '28px 32px',
  width: 420,
  maxWidth: '90vw',
}

export const glassInput = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(0,180,216,0.3)',
  background: 'rgba(255,255,255,0.5)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}
