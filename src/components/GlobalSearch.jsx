import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, User, Bike, Store, Users, Package } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// Recherche globale (en-tête de toutes les pages) : nom, téléphone, e-mail,
// boutique, référence ou téléphone d'une course — cherchée côté serveur dans
// toute la base (GET /admin/search), résultats limités aux droits du rôle.
// Un résultat ouvre la page correspondante déjà filtrée (?q=…).

const ROLE_META = {
  CLIENT:         { label: 'Client',         icon: User,  path: '/clients' },
  DRIVER:         { label: 'Livreur',        icon: Bike,  path: '/drivers' },
  DEM_PRO:        { label: 'DEM Pro',        icon: Store, path: '/dem-pro' },
  CHEF_DE_FLOTTE: { label: 'Chef de flotte', icon: Users, path: '/chefs-de-flotte' },
}
const STATUS_FR = {
  SCHEDULED: 'Programmée', PENDING: 'En attente', ACCEPTED: 'Acceptée', PICKED_UP: 'Récupérée',
  IN_TRANSIT: 'En route', DELIVERED: 'Livrée', CANCELLED: 'Annulée',
}

const userTitle = u => u.proBusinessName || u.companyName || u.name || u.phone || '—'

export default function GlobalSearch({ compact = false }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const seq = useRef(0)

  // Requête 300 ms après la dernière frappe ; seule la plus récente compte.
  useEffect(() => {
    const term = q.trim()
    const id = ++seq.current
    if (term.length < 2) return undefined
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await api.get('/admin/search', { params: { q: term } })
        if (id === seq.current) setResult(res.data)
      } catch {
        if (id === seq.current) setResult({ users: [], orders: [], error: true })
      } finally {
        if (id === seq.current) setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onDown = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const term = q.trim()
  const shown = term.length >= 2 ? result : null
  const items = shown ? [
    ...shown.users.map(u => ({ key: `u-${u.id}`, kind: 'user', u })),
    ...shown.orders.map(o => ({ key: `o-${o.id}`, kind: 'order', o })),
  ] : []

  function go(item) {
    setOpen(false)
    if (item.kind === 'order') {
      navigate(`/orders?q=${encodeURIComponent(item.o.id.slice(0, 8))}`)
      return
    }
    const { u } = item
    if (u.role === 'CHEF_DE_FLOTTE') { navigate(`/chefs-de-flotte/${u.id}`); return }
    const meta = ROLE_META[u.role]
    navigate(`${meta.path}?q=${encodeURIComponent(u.phone?.replace(/^\+221/, '') || userTitle(u))}`)
  }

  return (
    <div ref={box} style={{ position: 'relative', width: compact ? '100%' : 360, maxWidth: '100%' }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur() }
            if (e.key === 'Enter' && items[0]) go(items[0])
          }}
          placeholder="Rechercher : nom, téléphone, boutique, n° de course…"
          aria-label="Recherche globale"
          style={{ ...glassInput, width: '100%', padding: '9px 32px 9px 32px', fontSize: 13 }}
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResult(null) }}
            aria-label="Effacer"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && term.length >= 2 && (
        <div style={{
          ...glass, position: 'absolute', top: 'calc(100% + 6px)', right: 0, left: 0, zIndex: 300,
          maxHeight: 420, overflowY: 'auto', padding: 6, background: 'rgba(255,255,255,0.97)',
        }}>
          {!shown || (loading && items.length === 0) ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>Recherche…</div>
          ) : shown.error ? (
            <div style={{ padding: 12, fontSize: 13, color: '#dc2626' }}>La recherche a échoué. Réessayez.</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>Aucun résultat pour « {term} ».</div>
          ) : (
            <>
              {shown.users.length > 0 && <SectionTitle>Comptes</SectionTitle>}
              {shown.users.map(u => {
                const meta = ROLE_META[u.role]
                const Icon = meta?.icon ?? User
                return (
                  <ResultRow key={u.id} onClick={() => go({ kind: 'user', u })} icon={<Icon size={15} />}
                    title={userTitle(u)}
                    subtitle={[meta?.label, u.phone, u.deletedAt ? 'supprimé' : !u.isActive ? 'suspendu' : null].filter(Boolean).join(' · ')} />
                )
              })}
              {shown.orders.length > 0 && <SectionTitle>Courses</SectionTitle>}
              {shown.orders.map(o => (
                <ResultRow key={o.id} onClick={() => go({ kind: 'order', o })} icon={<Package size={15} />}
                  title={`#${o.id.slice(0, 8)} · ${STATUS_FR[o.status] ?? o.status}`}
                  subtitle={[o.client?.proBusinessName || o.client?.name, o.receiverName && `→ ${o.receiverName}`, String(o.deliveryAddress ?? '').split(',')[0], new Date(o.createdAt).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px 4px' }}>{children}</div>
}

function ResultRow({ icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,119,182,0.07)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >
      <span style={{ color: '#0077b6', display: 'flex' }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>
      </span>
    </button>
  )
}
