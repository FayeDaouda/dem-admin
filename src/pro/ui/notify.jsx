import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { NotifyContext, KIND } from './notifyContext'

// Notifications de l'espace web DEM Pro :
// - toasts (confirmation d'une action, erreur) ;
// - centre de notifications (événements temps réel : coursier trouvé, colis
//   récupéré, livrée, nouvelle commande reçue, wallet), avec pastille,
//   son discret et notification du navigateur quand l'onglet est caché.

let audioCtx = null
function chime() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)()
    const now = audioCtx.currentTime
    for (const [i, f] of [[0, 880], [1, 1318.5]]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, now + i * .12)
      g.gain.linearRampToValueAtTime(.08, now + i * .12 + .02)
      g.gain.exponentialRampToValueAtTime(.0001, now + i * .12 + .35)
      o.connect(g).connect(audioCtx.destination)
      o.start(now + i * .12); o.stop(now + i * .12 + .4)
    }
  } catch { /* son indisponible */ }
}

export function NotifyProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [feed, setFeed] = useState([]) // centre de notifications
  const [unread, setUnread] = useState(0)
  const seq = useRef(0)

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), [])

  const toast = useCallback((kind, title, text) => {
    const id = ++seq.current
    setToasts(t => [...t.slice(-3), { id, kind, title, text }])
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 4200)
  }, [dismiss])

  // Événement temps réel : toast + centre + son ; notification du système
  // si l'onglet n'est pas au premier plan
  const recent = useRef(new Map())
  const notify = useCallback((kind, title, text, link) => {
    const key = `${title}|${link ?? ''}`
    const now = Date.now()
    if (now - (recent.current.get(key) ?? 0) < 20_000) return
    recent.current.set(key, now)
    const id = ++seq.current
    setFeed(f => [{ id, kind, title, text, link, at: new Date() }, ...f].slice(0, 40))
    setUnread(n => n + 1)
    toast(kind, title, text)
    chime()
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: text, icon: '/favicon.svg', tag: `dem-pro-${id}` }) } catch { /* ignoré */ }
    }
  }, [toast])

  const markRead = useCallback(() => setUnread(0), [])

  const api = useMemo(() => ({ toast, notify, feed, unread, markRead,
    success: (t, x) => toast('success', t, x), error: (t, x) => toast('error', t, x), info: (t, x) => toast('info', t, x) }),
  [toast, notify, feed, unread, markRead])

  return (
    <NotifyContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
          <div aria-live="polite" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8, width: 360, maxWidth: 'calc(100vw - 32px)' }}>
            {toasts.map(t => <Toast key={t.id} t={t} onClose={() => dismiss(t.id)} />)}
          </div>
        </div>,
        document.body,
      )}
    </NotifyContext.Provider>
  )
}

function Toast({ t, onClose }) {
  const k = KIND[t.kind] ?? KIND.info
  const Icon = k.icon
  return (
    <div className="card" role={t.kind === 'error' ? 'alert' : 'status'} style={{
      padding: '14px 12px 14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      boxShadow: 'var(--p-shadow-lg)', animation: 'pro-toast-in .16s ease-out both',
    }}>
      <Icon size={16} color={k.color} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.title}</div>
        {t.text && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{t.text}</div>}
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer" className="icon-btn sm plain" style={{ width: 24, height: 24, color: 'var(--p-subtle)' }}><X size={14} /></button>
    </div>
  )
}
