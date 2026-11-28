import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, Loader2, ArrowRight, ArrowUpRight, AlertTriangle, RotateCw } from 'lucide-react'
import { ORDER_STATUS, num } from '../lib/format'

// Composants de base de l'espace web DEM Pro — charte du site dem.sn :
// angles vifs, DM Sans, surtitres en capitales espacées, bleu nuit et cyan.

// Ancien compteur animé : la valeur s'affiche directement (pas de défilement)
export function CountUp({ value, format = num }) {
  return <span className="num">{format(Number(value) || 0)}</span>
}

export function Skeleton({ w = '100%', h = 14, r, style }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r != null ? Math.min(r, 2) : undefined, ...style }} />
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} aria-hidden style={{ animation: 'pro-spin .8s linear infinite' }} />
}

// Bouton : primary (sombre → cyan au survol), ghost/outline (contour), quiet,
// danger. `arrow` = 'right' | 'ne' ajoute la flèche du site, qui glisse au
// survol. Avec `href` (ou `to`), rendu en lien.
export function Button({ variant = 'primary', size, icon, arrow, loading, disabled, children, className = '', href, to, ...rest }) {
  const Icon = icon
  const cls = `btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`
  const iconSize = size === 'sm' ? 15 : 16
  const content = (
    <>
      {loading ? <Spinner size={iconSize} /> : Icon ? <Icon size={iconSize} aria-hidden /> : null}
      {children}
      {arrow === 'right' && <ArrowRight size={iconSize} className="arrow" aria-hidden />}
      {arrow === 'ne' && <ArrowUpRight size={iconSize} className="arrow-ne" aria-hidden />}
    </>
  )
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>
  // `disabled` après `rest` : pendant l'envoi (loading), le bouton reste
  // désactivé même si la page le dit actif — pas de double retrait au double clic
  return <button type="button" className={cls} {...rest} disabled={!!loading || !!disabled} aria-busy={loading || undefined}>{content}</button>
}

// Bouton icône : le libellé est obligatoire (lecteurs d'écran, infobulle)
export function IconButton({ icon, label, size, variant, className = '', ...rest }) {
  const Icon = icon
  return (
    <button type="button" aria-label={label} title={label}
      className={`icon-btn ${size === 'sm' ? 'sm' : ''} ${variant === 'plain' ? 'plain' : ''} ${className}`} {...rest}>
      <Icon size={size === 'sm' ? 15 : 16} aria-hidden />
    </button>
  )
}

export function StatusBadge({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, color: '#475569', bg: '#F1F5F9' }
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      <span className="badge-dot" aria-hidden />
      {s.label}
    </span>
  )
}

// Puce : étiquette colorée (par défaut) ou, avec `onClick`, puce cliquable
// sélectionnable (clients récents, produits) — `selected` la marque.
export function Chip({ color = '#0086C8', bg, children, style, onClick, selected, icon, ...rest }) {
  if (onClick) {
    const Icon = icon
    return (
      <button type="button" className={`chip-btn ${selected ? 'is-on' : ''}`} aria-pressed={!!selected} onClick={onClick} style={style} {...rest}>
        {Icon && <Icon size={14} aria-hidden />}
        <span className="chip-label">{children}</span>
      </button>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 2,
      background: bg ?? color + '14', color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  )
}

// Contrôle segmenté : un seul choix parmi 2 à 4 options [valeur, libellé, icône?]
export function Segmented({ value, onChange, options, label, disabled, full }) {
  return (
    <div className={`seg ${full ? 'seg-full' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(([v, text, icon]) => {
        const Icon = icon
        const on = value === v
        return (
          <button key={v} type="button" role="radio" aria-checked={on} disabled={disabled}
            className={on ? 'is-on' : ''} onClick={() => !on && onChange(v)}>
            {Icon && <Icon size={15} aria-hidden />}{text}
          </button>
        )
      })}
    </div>
  )
}

// Interrupteur (réglages) : role="switch", angles vifs, actif en bleu nuit
export function Toggle({ checked, onChange, label, disabled, busy }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} aria-busy={busy || undefined}
      className={`sp-switch ${checked ? 'is-on' : ''}`} disabled={disabled || busy} onClick={() => onChange(!checked)}>
      <span className="sp-switch-knob" aria-hidden />
    </button>
  )
}

export function Card({ children, style, className = '', ...rest }) {
  return <div className={`card ${className}`} style={{ padding: 24, ...style }} {...rest}>{children}</div>
}

// Petits coins cyan aux angles (élément mis en avant) — le parent doit
// porter la classe has-corners
export function Corners() {
  return <>{['tl', 'tr', 'bl', 'br'].map(k => <span key={k} className={`corner ${k}`} aria-hidden />)}</>
}

export function Eyebrow({ children, onDark, style }) {
  return <p className={`eyebrow ${onDark ? 'on-dark' : ''}`} style={style}>{children}</p>
}

// En-tête de page : surtitre à trait, titre, description, actions à droite
export function PageHeader({ eyebrow, title, description, actions, style }) {
  return (
    <header className="page-header" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 28, ...style }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        {eyebrow && <Eyebrow style={{ marginBottom: 14 }}>{eyebrow}</Eyebrow>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="muted" style={{ margin: '8px 0 0', fontSize: 14.5, maxWidth: 640 }}>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  )
}

// Carte chiffrée façon Stripe : libellé en capitales, valeur, sous-ligne.
// Avec `to`, toute la carte est un lien.
export function StatCard({ label, value, sub, to, icon, loading, tone }) {
  const Icon = icon
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="label-caps" style={{ flex: 1, minWidth: 0 }}>{label}</span>
        {Icon && <Icon size={16} color="#94A3B8" aria-hidden />}
      </div>
      <div className="num stat-value" style={{ color: tone ?? 'var(--p-ink)' }}>
        {loading ? <Skeleton w={110} h={30} /> : value}
      </div>
      <div className="muted stat-sub">
        {loading ? <Skeleton w={90} h={12} /> : sub}
        {to && !loading && <ArrowRight size={14} className="stat-arrow" aria-hidden />}
      </div>
    </>
  )
  return to
    ? <Link to={to} className="card stat-card is-link">{body}</Link>
    : <div className="card stat-card">{body}</div>
}

export function SectionTitle({ title, hint, action, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 className="section-title">{title}</h3>
        {hint && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{hint}</div>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ icon, title, text, action }) {
  const Icon = icon
  return (
    <div style={{ textAlign: 'center', padding: '44px 20px' }}>
      {Icon && (
        <div style={{
          width: 48, height: 48, margin: '0 auto 16px', display: 'grid', placeItems: 'center',
          border: '1px solid var(--p-line)', background: 'var(--p-soft)', color: 'var(--p-subtle)',
        }}><Icon size={22} aria-hidden /></div>
      )}
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      {text && <div className="muted" style={{ fontSize: 13.5, marginTop: 6, maxWidth: 400, marginInline: 'auto' }}>{text}</div>}
      {action && <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </div>
  )
}

// Chargement impossible : jamais de faux « vide » ni de zéros trompeurs
export function ErrorState({ title = 'Impossible de charger ces informations', text = 'Vérifiez votre connexion puis réessayez.', onRetry, compact }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: compact ? '24px 16px' : '44px 20px' }}>
      <div style={{
        width: 48, height: 48, margin: '0 auto 16px', display: 'grid', placeItems: 'center',
        background: 'var(--p-danger-bg)', color: 'var(--p-danger)',
      }}><AlertTriangle size={22} aria-hidden /></div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
      {text && <div className="muted" style={{ fontSize: 13.5, marginTop: 6, maxWidth: 400, marginInline: 'auto' }}>{text}</div>}
      {onRetry && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <Button variant="ghost" size="sm" icon={RotateCw} onClick={onRetry}>Réessayer</Button>
        </div>
      )}
    </div>
  )
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

// Garde le focus dans la fenêtre ouverte et le rend à l'élément d'origine
function useFocusTrap(open, ref) {
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const node = ref.current
    const focusables = () => [...(node?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter(el => !el.disabled)
    const first = focusables()[0]
    ;(first ?? node)?.focus?.()
    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (!els.length) return
      const a = els[0], z = els[els.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    node?.addEventListener('keydown', onKey)
    return () => { node?.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, ref])
}

// ── Fenêtre centrée (formulaires, confirmations) ────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, width = 520, footer }) {
  const ref = useRef(null)
  const titleId = useId()
  useEscape(open, onClose)
  useFocusTrap(open, ref)
  if (!open) return null
  return createPortal(
    <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(2, 21, 32, .55)',
        zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, animation: 'pro-fade-in .14s ease-out both',
      }}>
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
          className="card" onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--p-shadow-lg)', overflow: 'hidden', outline: 'none',
          }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '24px 24px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div id={titleId} style={{ fontFamily: 'var(--p-head)', fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
              {subtitle && <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{subtitle}</div>}
            </div>
            {/* Sans onClose (fenêtre obligatoire, envoi en cours) : pas de croix */}
            {onClose && <IconButton icon={X} label="Fermer" size="sm" variant="plain" onClick={onClose} />}
          </div>
          <div className="scroll-y" style={{ padding: '20px 24px 24px', flex: 1 }}>{children}</div>
          {footer && <div style={{ padding: '16px 24px', borderTop: '1px solid var(--p-line)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', background: 'var(--p-soft)' }}>{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Panneau latéral (détail d'une livraison) ────────────────────────────────
export function Drawer({ open, onClose, children, width = 520, label = 'Détail' }) {
  const ref = useRef(null)
  useEscape(open, onClose)
  useFocusTrap(open, ref)
  if (!open) return null
  return createPortal(
    <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2, 21, 32, .4)', zIndex: 900, animation: 'pro-fade-in .14s ease-out both' }} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: width, zIndex: 901, outline: 'none',
        background: '#fff', boxShadow: 'var(--p-shadow-lg)', display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--p-line)', animation: 'pro-slide-in-right .18s ease-out both',
      }}>
        {children}
      </aside>
    </div>,
    document.body,
  )
}
