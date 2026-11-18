import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bike, Plus, Store, Inbox, Wallet, UserRound, LogOut, Bell, ChevronDown, Menu, X, BellRing,
} from 'lucide-react'
import logoSrc from '../assets/logo-dem.svg'
import { useProAuth } from './proAuthContext'
import proApi from './lib/proApi'
import { proSocket } from './lib/proSocket'
import { useLiveRefresh } from './lib/useLiveRefresh'
import { fcfa, planName, timeAgo } from './lib/format'
import { useNotify, KIND as notifyKinds, useBrowserNotifications } from './ui/notifyContext'

// Structure de l'espace web DEM Pro : menu latéral, barre du haut
// (synchronisation, wallet, notifications, compte) et temps réel.
const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/livraisons', icon: Bike, label: 'Livraisons' },
  { to: '/boutique', icon: Store, label: 'Boutique' },
  { to: '/commandes', icon: Inbox, label: 'Commandes reçues', badge: 'requests' },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/compte', icon: UserRound, label: 'Compte' },
]

// Événements temps réel (mêmes que l'app) → notification + rafraîchissement
const EVENTS = {
  'order:accepted':        ['driver', 'Coursier trouvé', 'Un coursier DEM vient chercher le colis.'],
  'order:admin_assigned':  ['driver', 'Coursier attribué', 'DEM a attribué un coursier à votre livraison.'],
  'order:searching':       ['info', 'Recherche d\'un coursier', 'Votre livraison est proposée aux coursiers proches.'],
  'order:cancelled':       ['error', 'Livraison annulée', 'Une de vos livraisons a été annulée.'],
  'order:admin_cancelled': ['error', 'Livraison annulée par DEM', 'Une de vos livraisons a été annulée par le support.'],
  'order:auto_cancelled':  ['error', 'Aucun coursier disponible', 'La livraison a été annulée faute de coursier. Relancez-la.'],
  'order:expired':         ['error', 'Aucun coursier disponible', 'La livraison n\'a pas trouvé de coursier à temps.'],
  'order:payment_confirmed': ['success', 'Paiement confirmé', 'Le paiement de la livraison est enregistré.'],
  'batch:accepted':        ['driver', 'Tournée acceptée', 'Un coursier a accepté votre tournée.'],
  'batch:completed':       ['delivered', 'Tournée terminée', 'Tous les colis de la tournée sont livrés.'],
}

const searchingSeen = new Set()

export default function ProLayout({ children }) {
  const { user, logout } = useProAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useNotify()
  const [wallet, setWallet] = useState(null)
  const [requests, setRequests] = useState(0)
  const [online, setOnline] = useState(() => proSocket().connected)
  const [mobileNav, setMobileNav] = useState(false)

  // Wallet et commandes reçues : relus à chaque événement (rafales regroupées)
  // et toutes les minutes en filet de sécurité, onglet visible seulement
  const loadSide = useCallback(() => {
    proApi.get('/users/dem-pro/wallet').then(r => setWallet(r.data)).catch(() => {})
    proApi.get('/dem-pro/order-requests', { params: { status: 'PENDING' } })
      .then(r => setRequests((r.data ?? []).filter(x => (x.status ?? 'PENDING') === 'PENDING').length)).catch(() => {})
  }, [])
  useEffect(() => {
    loadSide()
    const t = setInterval(() => { if (!document.hidden) loadSide() }, 60_000)
    return () => clearInterval(t)
  }, [loadSide])
  useLiveRefresh(loadSide)

  // Temps réel
  const push = notify.notify
  useEffect(() => {
    const s = proSocket()
    const refresh = (detail) => window.dispatchEvent(new CustomEvent('dem-pro:refresh', { detail }))
    const on = (ev, fn) => { s.on(ev, fn); return () => s.off(ev, fn) }
    const offs = [
      on('connect', () => setOnline(true)),
      on('disconnect', () => setOnline(false)),
      ...Object.entries(EVENTS).map(([ev, [kind, title, text]]) => on(ev, (p) => {
        // Le serveur relance « searching » à chaque vague de recherche :
        // une seule notification par livraison, comme le push de l'app
        const once = ev === 'order:searching' && p?.orderId
        if (!once || !searchingSeen.has(p.orderId)) {
          if (once) searchingSeen.add(p.orderId)
          push(kind, title, text, p?.orderId ? `/livraisons?id=${p.orderId}` : null)
        }
        refresh({ ev, p })
      })),
      on('order:status_updated', (p) => {
        const st = p?.status
        if (st === 'PICKED_UP') push('driver', 'Colis récupéré', 'Le coursier est en route vers votre client.', p?.orderId ? `/livraisons?id=${p.orderId}` : null)
        else if (st === 'DELIVERED') push('delivered', 'Livraison effectuée', 'Votre client a reçu sa commande.', p?.orderId ? `/livraisons?id=${p.orderId}` : null)
        refresh({ ev: 'order:status_updated', p })
      }),
      on('order_request:new', (p) => {
        push('order', p?.paid ? 'Nouvelle commande payée' : 'Nouvelle commande reçue',
          `${p?.customerName ?? 'Un client'} · ${fcfa(p?.total)} — à valider pour lancer la livraison.`, '/commandes')
        refresh({ ev: 'order_request:new', p })
      }),
      on('wallet:updated', () => refresh({ ev: 'wallet:updated' })),
    ]
    return () => offs.forEach(off => off())
  }, [push])

  const name = user?.proBusinessName || user?.name || 'Ma boutique'

  return (
    <div className="pro" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Menu latéral ── */}
      <aside className={`pro-side ${mobileNav ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '22px 22px 18px' }}>
          <img src={logoSrc} alt="DEM" style={{ height: 30 }} />
          <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(12,184,222,.2)', color: '#5fd8f3', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4 }}>PRO</span>
          <button className="pro-side-close" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><X size={18} /></button>
        </div>
        <div style={{ margin: '0 16px 18px', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Avatar user={user} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>{planName(user?.proPlan)}</div>
          </div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <button className="btn btn-primary" style={{ width: '100%', height: 46 }} onClick={() => { setMobileNav(false); navigate('/livraisons/nouvelle') }}>
            <Plus size={18} /> Nouvelle livraison
          </button>
        </div>
        <nav style={{ display: 'grid', gap: 2, padding: '0 12px' }}>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileNav(false)} className={({ isActive }) => `pro-nav ${isActive ? 'active' : ''}`}>
              <item.icon size={19} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge === 'requests' && requests > 0 && <span className="pro-nav-badge">{requests}</span>}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: 12 }}>
          <button className="pro-nav" style={{ width: '100%', border: 'none', background: 'none' }} onClick={logout}>
            <LogOut size={19} /> <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
      {mobileNav && <div className="pro-side-scrim" onClick={() => setMobileNav(false)} />}

      {/* ── Contenu ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="pro-top">
          <button className="btn btn-ghost btn-icon pro-burger" onClick={() => setMobileNav(true)} aria-label="Menu"><Menu size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: online ? 'var(--p-success)' : 'var(--p-muted)' }} title={online ? 'Les mises à jour arrivent en direct' : 'Reconnexion…'}>
            <span className="live-dot" style={{ background: online ? '#16a34a' : '#9aa8bb', animation: online ? undefined : 'none' }} />
            <span className="pro-hide-sm">{online ? 'Synchronisé en direct' : 'Reconnexion…'}</span>
          </div>
          <div style={{ flex: 1 }} />
          <button className="pro-wallet-pill" onClick={() => navigate('/wallet')} title="Solde retirable">
            <Wallet size={16} /> <span className="num">{wallet ? fcfa(wallet.withdrawableBalance) : '—'}</span>
          </button>
          <NotificationBell />
          <AccountMenu user={user} onLogout={logout} onAccount={() => navigate('/compte')} />
        </header>
        <main key={location.pathname} className="anim-in" style={{ flex: 1, padding: '26px 32px 48px', maxWidth: 1360, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
      <style>{LAYOUT_CSS}</style>
    </div>
  )
}

export function Avatar({ user, size = 34 }) {
  const name = user?.proBusinessName || user?.name || 'D'
  if (user?.avatar) return <img src={user.avatar} alt="" style={{ width: size, height: size, borderRadius: size / 3, objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: size / 3, background: 'var(--p-gradient)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * .42, flexShrink: 0 }}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

function NotificationBell() {
  const n = useNotify()
  const navigate = useNavigate()
  const { perm, ask } = useBrowserNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-icon" onClick={() => { setOpen(o => !o); n.markRead() }} aria-label="Notifications" style={{ position: 'relative' }}>
        <Bell size={18} style={{ animation: n.unread ? 'pro-ring 1.2s ease 2' : 'none' }} />
        {n.unread > 0 && <span className="pro-bell-dot">{n.unread > 9 ? '9+' : n.unread}</span>}
      </button>
      {open && (
        <div className="card anim-scale pro-dropdown" style={{ width: 380, right: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--p-line)', fontWeight: 800 }}>Notifications</div>
          {perm === 'default' && (
            <div style={{ padding: '12px 16px', background: 'var(--p-soft)', display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
              <BellRing size={16} color="var(--p-cyan-2)" />
              <span style={{ flex: 1 }}>Être prévenu même quand l'onglet est fermé ou réduit.</span>
              <button className="btn btn-dark btn-sm" onClick={ask}>Activer</button>
            </div>
          )}
          <div className="scroll-y" style={{ maxHeight: 380 }}>
            {n.feed.length === 0 ? (
              <div className="muted" style={{ padding: 28, textAlign: 'center', fontSize: 13 }}>Aucune notification pour le moment.<br />Elles arrivent ici en direct.</div>
            ) : n.feed.map(f => {
              const k = notifyKinds[f.kind] ?? notifyKinds.info
              return (
                <div key={f.id} className="row-hover" onClick={() => { if (f.link) { navigate(f.link); setOpen(false) } }} style={{ display: 'flex', gap: 12, padding: '12px 16px', cursor: f.link ? 'pointer' : 'default', borderBottom: '1px solid var(--p-line)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: k.color + '14', color: k.color, flexShrink: 0 }}><k.icon size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{f.text}</div>
                    <div style={{ fontSize: 11, color: '#9aa8bb', marginTop: 2 }}>{timeAgo(f.at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AccountMenu({ user, onLogout, onAccount }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutside(ref, () => setOpen(false))
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--p-line)', background: '#fff', borderRadius: 14, padding: '5px 10px 5px 5px', cursor: 'pointer' }}>
        <Avatar user={user} size={30} />
        <span className="pro-hide-sm" style={{ fontWeight: 700, fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? 'Mon compte'}</span>
        <ChevronDown size={15} color="#9aa8bb" />
      </button>
      {open && (
        <div className="card anim-scale pro-dropdown" style={{ width: 240, right: 0, padding: 6 }}>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>{user?.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{user?.phone}</div>
          </div>
          <button className="pro-menu-item" onClick={() => { setOpen(false); onAccount() }}><UserRound size={16} /> Mon compte</button>
          <button className="pro-menu-item" style={{ color: 'var(--p-danger)' }} onClick={onLogout}><LogOut size={16} /> Se déconnecter</button>
        </div>
      )}
    </div>
  )
}

function useOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, cb])
}

const LAYOUT_CSS = `
.pro .pro-side {
  width: 264px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #04317c 0%, #021b47 100%); color: #fff; z-index: 50;
}
.pro .pro-nav {
  display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px;
  color: rgba(255,255,255,.72); font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none;
  transition: background .18s, color .18s, transform .18s; font-family: inherit;
}
.pro .pro-nav:hover { background: rgba(255,255,255,.07); color: #fff; }
.pro .pro-nav.active { background: rgba(12,184,222,.18); color: #fff; font-weight: 800; }
.pro .pro-nav.active svg { color: #5fd8f3; }
.pro .pro-nav-badge { min-width: 22px; height: 22px; padding: 0 7px; border-radius: 11px; background: #0cb8de; color: #021b47; font-size: 11.5px; font-weight: 800; display: grid; place-items: center; animation: pro-pulse 1.8s infinite; }
.pro .pro-top {
  position: sticky; top: 0; z-index: 40; height: 68px; display: flex; align-items: center; gap: 12px; padding: 0 32px;
  background: rgba(243,246,251,.82); backdrop-filter: blur(14px); border-bottom: 1px solid var(--p-line);
}
.pro .pro-wallet-pill {
  display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--p-line); background: #fff; font-weight: 800; font-size: 13.5px; color: var(--p-navy);
  transition: border-color .2s, transform .15s;
}
.pro .pro-wallet-pill:hover { border-color: #c9d6e6; }
.pro .pro-wallet-pill svg { color: var(--p-cyan-2); }
.pro .pro-bell-dot { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--p-danger); color: #fff; font-size: 10.5px; font-weight: 800; display: grid; place-items: center; border: 2px solid #fff; }
.pro .pro-dropdown { position: absolute; top: calc(100% + 10px); z-index: 60; overflow: hidden; box-shadow: var(--p-shadow-lg); }
.pro .pro-menu-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: none; border-radius: 10px; font-weight: 600; font-size: 13.5px; cursor: pointer; color: var(--p-ink); font-family: inherit; }
.pro .pro-menu-item:hover { background: var(--p-soft); }
.pro .pro-burger, .pro .pro-side-close { display: none; }
@media (max-width: 960px) {
  .pro .pro-side { position: fixed; left: 0; top: 0; transform: translateX(-100%); transition: transform .3s var(--p-ease); }
  .pro .pro-side.open { transform: none; box-shadow: var(--p-shadow-lg); }
  .pro .pro-side-scrim { position: fixed; inset: 0; background: rgba(2,27,71,.4); z-index: 45; animation: pro-fade-in .2s both; }
  .pro .pro-burger { display: inline-flex; }
  .pro .pro-side-close { display: inline-grid; place-items: center; margin-left: auto; background: none; border: none; color: #fff; cursor: pointer; }
  .pro .pro-top { padding: 0 16px; }
  .pro main { padding: 20px 16px 40px !important; }
}
@media (max-width: 560px) { .pro .pro-hide-sm { display: none; } }
`
