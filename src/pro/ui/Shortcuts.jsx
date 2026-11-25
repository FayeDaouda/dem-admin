import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './ui'

// Raccourcis clavier de l'espace DEM Pro. Désactivés quand on écrit dans un
// champ, quand une fenêtre est ouverte, ou avec Ctrl / Cmd / Alt (raccourcis
// du navigateur), sauf Ctrl+K / Cmd+K qui ouvre toujours la recherche.
const SHORTCUTS = [
  { keys: ['N'], label: 'Nouvelle livraison' },
  { keys: ['T'], label: 'Nouvelle tournée' },
  { keys: ['/'], label: 'Rechercher (livraisons, clients, produits, pages)' },
  { keys: ['Ctrl', 'K'], label: 'Rechercher, même depuis un champ' },
  { keys: ['?'], label: 'Afficher cette aide' },
  { keys: ['Échap'], label: 'Fermer une fenêtre ou un panneau' },
]

const isTyping = (el) => {
  if (!el || el === document.body) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type)
  return el.getAttribute?.('role') === 'textbox' || el.getAttribute?.('role') === 'combobox'
}
const dialogOpen = () => !!document.querySelector('[aria-modal="true"], [role="menu"]')

export function ShortcutKeys({ onSearch, onHelp }) {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return
      // Ctrl+K / Cmd+K : recherche, partout
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        if (document.querySelector('[data-palette]')) return
        e.preventDefault(); onSearch(); return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target) || dialogOpen()) return
      const k = e.key
      if (k === 'n' || k === 'N') { e.preventDefault(); navigate('/livraisons/nouvelle') }
      else if (k === 't' || k === 'T') { e.preventDefault(); navigate('/tournees/nouvelle') }
      else if (k === '/') { e.preventDefault(); onSearch() }
      else if (k === '?') { e.preventDefault(); onHelp() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, onSearch, onHelp])
  return null
}

export function Kbd({ children }) {
  return <kbd className="kb-key">{children}</kbd>
}

export function ShortcutsHelp({ open, onClose }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  return (
    <Modal open={open} onClose={onClose} title="Raccourcis clavier" width={480}
      subtitle="Pour aller plus vite au comptoir ou au bureau. Ils ne s'activent pas pendant que vous écrivez dans un champ.">
      <ul className="kb-list">
        {SHORTCUTS.map(s => (
          <li key={s.label}>
            <span>{s.label}</span>
            <span className="kb-keys">
              {s.keys.map((k, i) => (
                <span key={k} className="kb-combo">
                  {i > 0 && <span className="kb-plus" aria-hidden>+</span>}
                  <Kbd>{k === 'Ctrl' && mac ? '⌘' : k}</Kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted kb-foot">Dans la recherche : flèches haut et bas pour choisir, Entrée pour ouvrir.</p>
    </Modal>
  )
}
