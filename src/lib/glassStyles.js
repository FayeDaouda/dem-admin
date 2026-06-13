export const glass = {
  background: 'rgba(255,255,255,0.60)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.75)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 8px 32px rgba(0,119,182,0.10), 0 1px 4px rgba(0,0,0,0.04)',
}

// Variante opaque (fond blanc plein) pour les popups/dropdowns qui doivent
// rester parfaitement lisibles au-dessus d'un contenu chargé.
export const glassSolid = {
  ...glass,
  background: '#ffffff',
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

// ── Pages liste : haut fixe (titre/actions/filtres) + liste scrollable ──
export const pageWrap = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}

export const pageScroll = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'auto',
  minHeight: 0,
}

export const stickyTh = {
  position: 'sticky',
  top: 0,
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  zIndex: 1,
}

// 1ʳᵉ colonne figée à gauche : reste visible pendant le scroll horizontal du tableau (mobile)
export const stickyCol = {
  position: 'sticky',
  left: 0,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  boxShadow: '2px 0 4px -2px rgba(0,0,0,0.12)',
  zIndex: 2,
}

// 1ʳᵉ cellule d'en-tête : figée à la fois en haut (stickyTh) et à gauche (stickyCol)
export const stickyThCol = {
  ...stickyTh,
  ...stickyCol,
  zIndex: 3,
}
