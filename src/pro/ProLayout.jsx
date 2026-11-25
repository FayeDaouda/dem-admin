import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bike, Plus, Store, Inbox, Wallet, UserRound, LogOut, Bell, ChevronDown, Menu, X, BellRing,
  MessageCircle, WifiOff, Route as RouteIcon, Users, ChartColumn, Plug,
} from 'lucide-react'
import { whatsappUrl } from './support'
import wordmark from './assets/dem-wordmark-white.svg'
import { useProAuth } from './proAuthContext'
import proApi from './lib/proApi'
import { proSocket } from './lib/proSocket'
import { useLiveRefresh } from './lib/useLiveRefresh'
import { fcfa, phoneFmt, planName, timeAgo } from './lib/format'
import { useNotify, KIND as notifyKinds, useBrowserNotifications } from './ui/notifyContext'
import { Button, IconButton } from './ui/ui'

// Structure de l'espace web DEM Pro, dans l'esprit de la navigation du site
// dem.sn : barre latérale bleu nuit, libellés en capitales espacées, élément
// actif souligné de cyan ; barre du haut blanche (fil d'Ariane, action
// principale, notifications, compte) et temps réel.
const NAV = [
  // area : zone soumise au rôle du membre d'équipe (voir ProAuth.jsx can())
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', end: true, area: 'dashboard' },
  { to: '/livraisons', icon: Bike, label: 'Livraisons' },
  { to: '/tournees', icon: RouteIcon, label: 'Tournées' },
  { to: '/commandes', icon: Inbox, label: 'Commandes reçues', badge: 'requests' },
  { to: '/boutique', icon: Store, label: 'Boutique' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/statistiques', icon: ChartColumn, label: 'Statistiques', area: 'dashboard' },
  { to: '/wallet', icon: Wallet, label: 'Wallet', area: 'wallet' },
  { to: '/compte/api', icon: Plug, label: 'API DEM', area: 'api' },
  { to: '/compte', icon: UserRound, label: 'Compte', end: true },
]

const TITLES = {
  '/': 'Tableau de bord',
  '/livraisons': 'Livraisons',
  '/livraisons/nouvelle': 'Nouvelle livraison',
  '/boutique': 'Boutique',
  '/commandes': 'Commandes reçues',
  '/wallet': 'Wallet',
  '/compte': 'Compte',
  '/compte/equipe': 'Équipe',
  '/compte/api': 'API DEM',
  '/compte/parrainage': 'Parrainage',
  '/tournees': 'Tournées groupées',
  '/tournees/nouvelle': 'Nouvelle tournée',
  '/clients': 'Clients',
  '/statistiques': 'Statistiques',
}
// Écrans qui portent déjà « Nouvelle livraison » : pas de doublon en haut
const HAS_OWN_NEW = new Set(['/livraisons', '/livraisons/nouvelle', '/tournees', '/tournees/nouvelle'])

// Support : mêmes contacts que l'app (support.js)
const HELP_URL = whatsappUrl()

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
  'batch:searching':       ['info', 'Recherche d\'un coursier', 'Votre tournée est proposée aux coursiers proches.'],
  'batch:auto_cancelled':  ['error', 'Aucun coursier disponible', 'La tournée a été annulée faute de coursier. Relancez-la.'],
  'order:scheduled_assigned':  ['driver', 'Coursier réservé', 'Un coursier est réservé pour votre livraison programmée.'],
  'order:scheduled_searching': ['info', 'Nouveau coursier recherché', 'Le coursier prévu n\'est plus disponible : nous en cherchons un autre.'],
  'order:driver_unreachable':  ['error', 'Coursier injoignable', 'Le coursier ne répond plus depuis quelques minutes. DEM s\'en occupe.'],
}

const searchingSeen = new Set()

export default function ProLayout({ children }) {
  const { user, logout, can, member } = useProAuth()
  const canWallet = can('wallet')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const notify = useNotify()
  const [wallet, setWallet] = useState(null)
  const [requests, setRequests] = useState(0)
  const [offline, setOffline] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  // Wallet et commandes reçues : relus à chaque événement (rafales regroupées)
  // et toutes les minutes en filet de sécurité, onglet visible seulement
  // Nouvelle commande : le serveur l'annonce en direct (order_request:new) ;
  // sinon (serveur plus ancien, socket coupé), le relevé de la minute prévient
  // quand le nombre de nouvelles commandes augmente.
  const lastPending = useRef(null)
  const lastLiveNew = useRef(0)
  const pushRef = useRef(null)
  const loadSide = useCallback(() => {
    // Employé sans accès au wallet : ni appel (403) ni solde affiché
    if (canWallet) proApi.get('/users/dem-pro/wallet').then(r => setWallet(r.data)).catch(() => {})
    proApi.get('/dem-pro/order-requests', { params: { status: 'PENDING' } })
      .then(r => {
        const n = (r.data ?? []).filter(x => (x.status ?? 'PENDING') === 'PENDING').length
        const before = lastPending.current
        lastPending.current = n
        setRequests(n)
        if (before != null && n > before && Date.now() - lastLiveNew.current > 90_000) {
          pushRef.current?.('order', n - before > 1 ? `${n - before} nouvelles commandes` : 'Nouvelle commande reçue', 'À accepter dans Commandes reçues.', '/commandes')
        }
      }).catch(() => {})
  }, [canWallet])
  useEffect(() => {
    loadSide()
    const t = setInterval(() => { if (!document.hidden) loadSide() }, 60_000)
    return () => clearInterval(t)
  }, [loadSide])
  useLiveRefresh(loadSide)

  // Temps réel. Le bandeau « Connexion perdue » n'apparaît qu'après 4 s
  // sans socket (pas de clignotement au démarrage ni sur une micro-coupure).
  const push = notify.notify
  useEffect(() => { pushRef.current = push }, [push])
  useEffect(() => {
    const s = proSocket()
    let lostTimer = null
    const lost = () => { clearTimeout(lostTimer); lostTimer = setTimeout(() => setOffline(true), 4000) }
    const back = () => { clearTimeout(lostTimer); setOffline(false) }
    if (!s.connected) lost()
    const refresh = (detail) => window.dispatchEvent(new CustomEvent('dem-pro:refresh', { detail }))
    const on = (ev, fn) => { s.on(ev, fn); return () => s.off(ev, fn) }
    const offs = [
      on('connect', back),
      on('disconnect', lost),
      ...Object.entries(EVENTS).map(([ev, [kind, title, text]]) => on(ev, (p) => {
        // Le serveur relance « searching » à chaque vague de recherche :
        // une seule notification par livraison, comme le push de l'app
        const once = ev === 'order:searching' && p?.orderId
        if (!once || !searchingSeen.has(p.orderId)) {
          if (once) searchingSeen.add(p.orderId)
          push(kind, title, text, p?.orderId ? `/livraisons?id=${p.orderId}` : p?.batchId ? `/tournees?id=${p.batchId}` : null)
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
        lastLiveNew.current = Date.now()
        push('order', p?.paid ? 'Nouvelle commande payée' : 'Nouvelle commande reçue',
          `${p?.customerName ?? 'Un client'} · ${fcfa(p?.total)} · à accepter dans Commandes reçues.`, '/commandes')
        refresh({ ev: 'order_request:new', p })
      }),
      on('order:driver_arrived', (p) => {
        if (p?.point === 'pickup') push('driver', 'Coursier arrivé', 'Il est à votre point de retrait. Préparez le colis.', p?.orderId ? `/livraisons?id=${p.orderId}` : null)
        else if (p?.point === 'delivery') push('driver', 'Coursier chez votre client', 'La remise est en cours.', p?.orderId ? `/livraisons?id=${p.orderId}` : null)
        refresh({ ev: 'order:driver_arrived', p })
      }),
      on('wallet:updated', () => refresh({ ev: 'wallet:updated' })),
    ]
    return () => { clearTimeout(lostTimer); offs.forEach(off => off()) }
  }, [push])

  // Le menu mobile se referme à chaque navigation
  const closeNav = () => setMobileNav(false)

  const shopName = user?.proBusinessName || user?.name || 'Ma boutique'
  const title = TITLES[pathname] ?? 'Espace DEM Pro'

  return (
    <div className="pro pro-shell">
      {/* ── Barre latérale ── */}
      <aside className={`pro-side ${mobileNav ? 'open' : ''}`} aria-label="Navigation principale">
        <div className="pro-side-brand">
          <Link to="/" onClick={closeNav} className="pro-side-logo" aria-label="DEM Pro, tableau de bord">
            <img src={wordmark} alt="DEM" />
            <span>Pro</span>
          </Link>
          <button type="button" className="pro-side-close" onClick={closeNav} aria-label="Fermer le menu"><X size={18} /></button>
        </div>

        <div className="pro-side-shop">
          <div className="pro-side-shop-name" title={shopName}>{shopName}</div>
          <div className="pro-side-shop-plan">{planName(user?.proPlan)}</div>
        </div>

        <nav className="pro-side-nav">
          {NAV.filter(item => !item.area || can(item.area)).map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={closeNav} className={({ isActive }) => `pro-nav ${isActive ? 'active' : ''}`}>
                <Icon size={17} aria-hidden />
                <span className="pro-nav-label">{item.label}</span>
                {item.badge === 'requests' && requests > 0 && (
                  <span className="pro-nav-badge" aria-label={`${requests} à valider`}>{requests}</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="pro-side-foot">
          <div className="pro-side-user">
            <Avatar user={user} size={34} dark person />
            <div style={{ minWidth: 0 }}>
              <div className="pro-side-user-name">{member?.name ?? user?.name ?? shopName}</div>
              <div className="pro-side-user-phone num">{phoneFmt(user?.phone)}</div>
            </div>
          </div>
          <a className="pro-nav pro-nav-sm" href={HELP_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden /><span className="pro-nav-label">Aide</span>
          </a>
          <button type="button" className="pro-nav pro-nav-sm" onClick={logout}>
            <LogOut size={16} aria-hidden /><span className="pro-nav-label">Se déconnecter</span>
          </button>
        </div>
      </aside>
      {mobileNav && <div className="pro-side-scrim" onClick={closeNav} aria-hidden />}

      {/* ── Contenu ── */}
      <div className="pro-body">
        <header className="pro-top">
          <IconButton icon={Menu} label="Ouvrir le menu" className="pro-burger" onClick={() => setMobileNav(true)} />
          <nav className="pro-crumbs" aria-label="Fil d'Ariane">
            <span className="pro-crumbs-root">DEM Pro</span>
            <span className="pro-crumbs-sep" aria-hidden>/</span>
            <span className="pro-crumbs-current" aria-current="page">{title}</span>
          </nav>
          <div style={{ flex: 1 }} />
          {canWallet && (
            <Link to="/wallet" className="pro-wallet-pill" title="Solde retirable">
              <span className="pro-wallet-label">Solde</span>
              <span className="num">{wallet ? fcfa(wallet.withdrawableBalance) : '—'}</span>
            </Link>
          )}
          {!HAS_OWN_NEW.has(pathname) && (
            <Button size="sm" icon={Plus} className="pro-top-new" onClick={() => navigate('/livraisons/nouvelle')}
              aria-label="Nouvelle livraison">
              <span className="pro-hide-sm">Nouvelle livraison</span>
            </Button>
          )}
          <NotificationBell />
          <AccountMenu user={user} onLogout={logout} onAccount={() => navigate('/compte')} />
        </header>
        {offline && (
          <div className="pro-offline" role="status">
            <WifiOff size={14} aria-hidden /> Connexion perdue, reconnexion… Les données affichées peuvent dater de quelques instants.
          </div>
        )}
        <main className="pro-main anim-in">
          {children}
        </main>
      </div>
      <style>{LAYOUT_CSS}</style>
    </div>
  )
}

// Avatar carré ; `person` : initiale de la personne (menu de compte),
// sinon celle de la boutique
export function Avatar({ user, size = 34, dark, person }) {
  const name = (person ? user?.name || user?.proBusinessName : user?.proBusinessName || user?.name) || 'D'
  if (user?.avatar) return <img src={user.avatar} alt="" style={{ width: size, height: size, objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div aria-hidden style={{
      width: size, height: size, flexShrink: 0, display: 'grid', placeItems: 'center',
      background: dark ? 'var(--p-surface)' : 'var(--p-dark)', color: dark ? 'var(--p-cyan)' : '#fff',
      font: `700 ${Math.round(size * .42)}px var(--p-head)`,
    }}>
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
  const close = useCallback(() => setOpen(false), [])
  useOutside(ref, close)
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="icon-btn" onClick={() => { setOpen(o => !o); n.markRead() }}
        aria-label={n.unread ? `Notifications, ${n.unread} non lues` : 'Notifications'} aria-haspopup="true" aria-expanded={open}
        style={{ position: 'relative' }}>
        <Bell size={16} aria-hidden />
        {n.unread > 0 && <span className="pro-bell-dot num">{n.unread > 9 ? '9+' : n.unread}</span>}
      </button>
      {open && (
        <div className="card anim-scale pro-dropdown pro-notif-panel">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--p-line)' }}>
            <p className="label-caps" style={{ margin: 0, color: 'var(--p-ink)' }}>Notifications</p>
          </div>
          {perm === 'default' && (
            <div style={{ padding: '12px 16px', background: 'var(--p-soft)', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--p-line)' }}>
              <BellRing size={16} color="var(--p-cyan-2)" aria-hidden />
              <span style={{ flex: 1 }}>Être prévenu même quand l'onglet est fermé ou réduit.</span>
              <Button size="sm" onClick={ask}>Activer</Button>
            </div>
          )}
          <div className="scroll-y" style={{ maxHeight: 380 }}>
            {n.feed.length === 0 ? (
              <div className="muted" style={{ padding: 28, textAlign: 'center', fontSize: 13 }}>Aucune notification pour le moment.<br />Elles arrivent ici en direct.</div>
            ) : n.feed.map(f => {
              const k = notifyKinds[f.kind] ?? notifyKinds.info
              const Icon = k.icon
              const inner = (
                <>
                  <Icon size={16} color={k.color} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{f.title}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{f.text}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--p-subtle)', marginTop: 2 }}>{timeAgo(f.at)}</span>
                  </span>
                </>
              )
              return f.link ? (
                <button type="button" key={f.id} className="row-hover pro-notif-row" onClick={() => { navigate(f.link); setOpen(false) }}>{inner}</button>
              ) : (
                <div key={f.id} className="pro-notif-row">{inner}</div>
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
  const close = useCallback(() => setOpen(false), [])
  useOutside(ref, close)
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="pro-account-btn" onClick={() => setOpen(o => !o)}
        aria-label="Mon compte" aria-haspopup="true" aria-expanded={open}>
        <Avatar user={user} size={28} person />
        <ChevronDown size={14} color="var(--p-subtle)" aria-hidden />
      </button>
      {open && (
        <div className="card anim-scale pro-dropdown" style={{ width: 248, right: 0, padding: 6 }}>
          <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--p-line)', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</div>
            <div className="muted num" style={{ fontSize: 12.5 }}>{phoneFmt(user?.phone)}</div>
          </div>
          <button type="button" className="pro-menu-item" onClick={() => { setOpen(false); onAccount() }}><UserRound size={16} aria-hidden /> Mon compte</button>
          <a className="pro-menu-item" href={HELP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden /> Aide (WhatsApp)</a>
          <button type="button" className="pro-menu-item" style={{ color: 'var(--p-danger)' }} onClick={onLogout}><LogOut size={16} aria-hidden /> Se déconnecter</button>
        </div>
      )}
    </div>
  )
}

function useOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb() }
    const k = (e) => { if (e.key === 'Escape') cb() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [ref, cb])
}

const LAYOUT_CSS = `
.pro.pro-shell { display: flex; min-height: 100vh; }
.pro .pro-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pro .pro-main { flex: 1; width: 100%; max-width: 1520px; padding: 32px 40px 56px; }

/* Barre latérale */
.pro .pro-side {
  width: 256px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column;
  background: var(--p-dark); color: #fff; z-index: 50; border-right: 1px solid rgba(255,255,255,.06);
}
.pro .pro-side-brand { display: flex; align-items: center; gap: 12px; height: 72px; padding: 0 24px; }
.pro .pro-side-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.pro .pro-side-logo img { height: 26px; width: auto; display: block; }
.pro .pro-side-logo span {
  font: 700 11.5px/22px var(--p-head); letter-spacing: .14em; text-transform: uppercase; color: var(--p-cyan);
  padding-left: 12px; border-left: 1px solid rgba(255,255,255,.28);
}
.pro .pro-side-shop { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,.08); border-bottom: 1px solid rgba(255,255,255,.08); }
.pro .pro-side-shop-name { font: 700 14px/1.3 var(--p-head); color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .pro-side-shop-plan { font-size: 12px; color: #94A3B8; margin-top: 2px; }
.pro .pro-side-nav { display: grid; gap: 2px; padding: 16px 12px; }
.pro .pro-nav {
  position: relative; display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 12px;
  color: rgba(255,255,255,.68); text-decoration: none; cursor: pointer; border: none; background: none; width: 100%; text-align: left;
  font: 600 14px/1 var(--p-head);
  transition: background var(--p-fast), color var(--p-fast);
}
.pro .pro-nav:hover { background: rgba(255,255,255,.04); color: #fff; }
.pro .pro-nav.active { background: rgba(255,255,255,.06); color: #fff; }
.pro .pro-nav.active::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; background: var(--p-cyan); }
.pro .pro-nav.active svg { color: var(--p-cyan); }
.pro .pro-nav:focus-visible { outline-color: var(--p-cyan); outline-offset: -2px; }
.pro .pro-nav-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .pro-nav-badge {
  min-width: 20px; height: 20px; padding: 0 6px; display: grid; place-items: center;
  background: var(--p-cyan); color: var(--p-dark); font: 700 11px/1 var(--p-head); letter-spacing: 0;
}
.pro .pro-nav-sm { height: 38px; }
.pro .pro-side-foot { margin-top: auto; padding: 12px 12px 16px; border-top: 1px solid rgba(255,255,255,.08); display: grid; gap: 2px; }
.pro .pro-side-user { display: flex; align-items: center; gap: 12px; padding: 8px 12px 12px; }
.pro .pro-side-user-name { font: 700 13px/1.3 var(--p-head); color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .pro-side-user-phone { font-size: 12px; color: #94A3B8; }

/* Barre du haut */
.pro .pro-top {
  position: sticky; top: 0; z-index: 40; height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 40px;
  background: #fff; border-bottom: 1px solid var(--p-line);
}
.pro .pro-crumbs { display: flex; align-items: center; gap: 10px; min-width: 0; font: 600 13.5px/1 var(--p-head); }
.pro .pro-crumbs-root { color: var(--p-subtle); white-space: nowrap; }
.pro .pro-crumbs-sep { color: var(--p-line-2); }
.pro .pro-crumbs-current { color: var(--p-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pro .pro-wallet-pill {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 12px; text-decoration: none;
  border: 1px solid var(--p-line); background: #fff; color: var(--p-ink); font: 700 13px/1 var(--p-head);
  transition: border-color var(--p-fast);
}
.pro .pro-wallet-pill:hover { border-color: var(--p-dark); }
.pro .pro-wallet-label { font: 700 10.5px/1 var(--p-head); letter-spacing: .12em; text-transform: uppercase; color: var(--p-subtle); }
.pro .pro-bell-dot {
  position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-items: center;
  background: var(--p-danger); color: #fff; font: 700 10.5px/1 var(--p-head); border: 2px solid #fff;
}
.pro .pro-account-btn {
  display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 6px 0 4px; cursor: pointer;
  border: 1px solid var(--p-line); background: #fff; transition: border-color var(--p-fast);
}
.pro .pro-account-btn:hover { border-color: var(--p-dark); }
.pro .pro-dropdown { position: absolute; top: calc(100% + 8px); z-index: 60; overflow: hidden; box-shadow: var(--p-shadow-lg); }
.pro .pro-notif-panel { width: min(380px, calc(100vw - 24px)); right: 0; padding: 0; }
.pro .pro-notif-row {
  display: flex; gap: 12px; width: 100%; padding: 12px 16px; text-align: left; border: none; background: none;
  border-bottom: 1px solid var(--p-line); color: inherit; font: inherit; cursor: default;
}
.pro button.pro-notif-row { cursor: pointer; }
.pro .pro-menu-item {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: none;
  font: 500 13.5px var(--p-body); cursor: pointer; color: var(--p-ink); text-decoration: none;
}
.pro .pro-menu-item:hover { background: var(--p-soft); }
.pro .pro-offline {
  display: flex; align-items: center; gap: 8px; padding: 8px 40px; font-size: 13px; font-weight: 500;
  background: var(--p-warning-bg); color: var(--p-warning); border-bottom: 1px solid #FED7AA;
}

.pro .pro-burger, .pro .pro-side-close { display: none; }
@media (max-width: 1100px) { .pro .pro-wallet-pill { display: none; } }
@media (max-width: 960px) {
  .pro .pro-side { position: fixed; left: 0; top: 0; transform: translateX(-100%); transition: transform .2s ease-out, visibility .2s; visibility: hidden; }
  .pro .pro-side.open { transform: none; box-shadow: var(--p-shadow-lg); visibility: visible; }
  .pro .pro-side-scrim { position: fixed; inset: 0; background: rgba(2, 21, 32, .5); z-index: 45; animation: pro-fade-in .14s ease-out both; }
  .pro .pro-burger { display: inline-grid; }
  .pro .pro-side-close { display: inline-grid; place-items: center; margin-left: auto; width: 36px; height: 36px; background: none; border: none; color: #fff; cursor: pointer; }
  .pro .pro-top { padding: 0 16px; }
  .pro .pro-offline { padding: 8px 16px; }
  .pro .pro-main { padding: 24px 16px 48px; }
  .pro .pro-crumbs-root, .pro .pro-crumbs-sep { display: none; }
}
@media (max-width: 560px) {
  .pro .pro-hide-sm { display: none; }
  .pro .pro-top-new { width: 36px; padding: 0; gap: 0; }
}
`
