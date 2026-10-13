import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { helpFor } from '../lib/aide'

// Petit ⓘ à côté d'un titre : un clic ouvre une courte explication (bulle
// rendue dans <body>, au-dessus de tout). Texte donné par `text`, ou cherché
// dans le dictionnaire lib/aide.js par `k` (le titre lui-même). Sans texte
// connu, rien n'est affiché.
export default function InfoTip({ k, text, title, size = 14 }) {
  const content = text ?? helpFor(k)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const pop = useRef(null)

  useEffect(() => {
    if (!pos) return
    const close = e => {
      if (pop.current?.contains(e.target) || btn.current?.contains(e.target)) return
      setPos(null)
    }
    const onKey = e => { if (e.key === 'Escape') setPos(null) }
    const onMove = () => setPos(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [pos])

  if (!content) return null

  function toggle(e) {
    e.stopPropagation()
    e.preventDefault()
    if (pos) { setPos(null); return }
    const r = btn.current.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left - 8, window.innerWidth - width - 12))
    const below = r.bottom + 8
    // Pas assez de place en dessous : la bulle s'ouvre au-dessus du ⓘ.
    const top = below + 180 > window.innerHeight ? Math.max(12, r.top - 8) : below
    setPos({ top, left, width, above: top !== below })
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        onMouseDown={e => e.stopPropagation()}
        aria-label={`Explication : ${title ?? k ?? ''}`}
        title="Explication"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle',
          marginLeft: 6, padding: 0, width: size + 4, height: size + 4, borderRadius: '50%',
          border: 'none', background: pos ? 'rgba(0,119,182,.14)' : 'transparent',
          color: pos ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Info size={size} />
      </button>
      {pos && createPortal(
        <div
          ref={pop}
          role="dialog"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000,
            transform: pos.above ? 'translateY(-100%)' : 'none',
            background: '#fff', borderRadius: 12, padding: '12px 14px',
            boxShadow: '0 12px 32px rgba(0,40,80,.22)', border: '1px solid rgba(0,119,182,.15)',
            fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', fontWeight: 400, textAlign: 'left',
            textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <Info size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <strong style={{ flex: 1, fontSize: 13 }}>{title ?? k}</strong>
            <button type="button" onClick={() => setPos(null)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>{content}</div>
        </div>,
        document.body,
      )}
    </>
  )
}
