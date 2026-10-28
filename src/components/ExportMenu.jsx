import { useState, useEffect, useRef } from 'react'
import { Download, ChevronDown, FileText, FileType, FileSpreadsheet, Loader2 } from 'lucide-react'
import { exportList } from '../lib/exportList'
import { useAuth } from '../contexts/AuthContext'

const OPTIONS = [
  { key: 'pdf',  label: 'PDF',   hint: 'À imprimer ou à envoyer',       Icon: FileText,        color: '#dc2626' },
  { key: 'docx', label: 'Word',  hint: 'Document modifiable',           Icon: FileType,        color: '#2563eb' },
  { key: 'xlsx', label: 'Excel', hint: 'Tableau à trier et à filtrer',  Icon: FileSpreadsheet, color: '#15803d' },
]

// Bouton « Exporter » des listes : PDF, Word ou Excel, avec les filtres en
// cours. getSpec() est appelé au clic et renvoie (éventuellement après avoir
// chargé toutes les pages) { title, fileBase, unit, filters, columns, rows }.
export default function ExportMenu({ getSpec, disabled }) {
  const { user } = useAuth()
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(null)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(t)
  }, [error])

  async function run(format) {
    setOpen(false); setError(''); setBusy(format)
    try {
      const spec = await getSpec()
      if (!spec.rows.length) { setError('Rien à exporter pour ce filtre.'); return }
      await exportList(format, { author: user?.name || user?.email, ...spec })
    } catch (e) {
      console.error(e)
      setError("L'export n'a pas abouti. Réessayez.")
    } finally {
      setBusy(null)
    }
  }

  const busyLabel = busy && OPTIONS.find(o => o.key === busy).label

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} disabled={disabled || !!busy} style={{ ...btnOutline, opacity: disabled ? 0.5 : 1, cursor: disabled || busy ? 'default' : 'pointer' }} aria-haspopup="menu" aria-expanded={open}>
        {busy
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {busyLabel} en préparation…</>
          : <><Download size={14} /> Exporter <ChevronDown size={13} /></>}
      </button>

      {open && (
        <div role="menu" style={menu}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 10px 6px' }}>
            Exporter la liste filtrée
          </div>
          {OPTIONS.map(o => (
            <button key={o.key} role="menuitem" onClick={() => run(o.key)} style={item}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,216,.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: o.color + '14', color: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <o.Icon size={17} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{o.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: '#fff', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '6px 10px', boxShadow: '0 6px 18px rgba(15,41,66,.12)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }
const menu = { position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60, width: 250, background: '#fff', borderRadius: 12, border: '1px solid rgba(0,119,182,.14)', boxShadow: '0 12px 32px rgba(15,41,66,.16)', padding: 6 }
const item = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', textAlign: 'left' }
