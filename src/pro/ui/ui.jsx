import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { ORDER_STATUS } from '../lib/format'

// ── Chiffre qui défile jusqu'à sa valeur (tableaux de bord) ─────────────────
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('fr-FR'), duration = 900 }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const target = Number(value) || 0
    const start = performance.now()
    const begin = from.current
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(begin + (target - begin) * eased)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className="num">{format(shown)}</span>
}

export function Skeleton({ w = '100%', h = 14, r, style }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} style={{ animation: 'pro-spin .8s linear infinite' }} />
}

export function Button({ variant = 'primary', size, icon: Icon, loading, children, className = '', ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} /> : null}
      {children}
    </button>
  )
}

export function StatusBadge({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, color: '#6b7c93', bg: '#eef2f7' }
  const live = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
      background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.color,
        animation: live ? 'pro-pulse 1.8s infinite' : 'none',
      }} />
      {s.label}
    </span>
  )
}

export function Chip({ color = '#0671ba', bg, children, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20,
      background: bg ?? color + '16', color, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  )
}

export function Card({ children, style, className = '', ...rest }) {
  return <div className={`card ${className}`} style={{ padding: 22, ...style }} {...rest}>{children}</div>
}

export function SectionTitle({ title, hint, action, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>{title}</h3>
        {hint && <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{hint}</div>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="anim-in" style={{ textAlign: 'center', padding: '44px 20px' }}>
      {Icon && (
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 14px', display: 'grid', placeItems: 'center',
          background: 'linear-gradient(135deg, #e3f8fc, #e6f0fb)', color: 'var(--p-cyan-2)', animation: 'pro-float 4s ease-in-out infinite',
        }}><Icon size={28} /></div>
      )}
      <div style={{ fontWeight: 800, fontSize: 15.5 }}>{title}</div>
      {text && <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 380, marginInline: 'auto' }}>{text}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}

// ── Fenêtre centrée (formulaires, confirmations) ────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, width = 520, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(2, 27, 71, .45)', backdropFilter: 'blur(4px)',
        zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, animation: 'pro-fade-in .2s ease both',
      }}>
        <div className="card anim-scale" onClick={(e) => e.stopPropagation()} style={{
          width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--p-shadow-lg)', border: 'none', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '22px 24px 0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{title}</div>
              {subtitle && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
          </div>
          <div className="scroll-y" style={{ padding: '18px 24px 22px', flex: 1 }}>{children}</div>
          {footer && <div style={{ padding: '14px 24px', borderTop: '1px solid var(--p-line)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--p-soft)' }}>{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Panneau latéral (détail d'une livraison) ────────────────────────────────
export function Drawer({ open, onClose, children, width = 520 }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2, 27, 71, .32)', zIndex: 900, animation: 'pro-fade-in .2s ease both' }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: width, zIndex: 901,
        background: '#fff', boxShadow: 'var(--p-shadow-lg)', display: 'flex', flexDirection: 'column',
        animation: 'pro-slide-in-right .32s var(--p-ease) both',
      }}>
        {children}
      </aside>
    </div>,
    document.body,
  )
}
