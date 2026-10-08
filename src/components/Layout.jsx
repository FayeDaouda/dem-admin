import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Gift,
  LayoutDashboard, CreditCard, Package, Users, LogOut, Bike, Map, Menu, X, TrendingUp, ShieldCheck, AlertTriangle, ScrollText, UserCog, Briefcase, UsersRound, SlidersHorizontal, Award, GitBranch, Bell, Wallet, UserPlus, Table2, Percent, KeyRound, Wrench, Search,
} from 'lucide-react'
import logoSrc from '../assets/logo-dem.svg'
import { useResponsive } from '../lib/useResponsive'
import SosAlertBanner from './SosAlertBanner'
import GlobalSearch from './GlobalSearch'

// roles: undefined = tous les rôles. Sinon tableau des rôles autorisés (SUPER bypass toujours).
// ASSISTANCE_EXECUTIVE (Assistant Exécutif) : périmètre opérationnel restreint — Dashboard (sans
// finance), Carte live, Coursiers, Courses, Validation, Incidents, Nouveaux profils, Chefs de flotte
// (lecture), Acquisition (lecture), Tableau, Badge livreur (lecture). Pas de Finance, Paiements,
// Service client, Audit, Marketing, Badge client, Parrainage, Notification, Équipes, Clients (fiche
// complète), DEM Pro (facturation) ni Tarifs.
// keywords : autres mots qui retrouvent la page dans la recherche du menu.
const NAV = [
  { to: '/',                 icon: LayoutDashboard, label: 'Dashboard',       roles: ['SUPER','DEV','ASSISTANCE_EXECUTIVE'] },
  { to: '/marketing',       icon: LayoutDashboard,  label: 'Dashboard', roles: ['SUPER','MARKETING'], hideForSuper: true },
  { to: '/service-client',  icon: LayoutDashboard,  label: 'Dashboard', roles: ['SUPER','SERVICE_CLIENT'], hideForSuper: true },
  { to: '/map',              icon: Map,             label: 'Carte live',      keywords: 'map positions suivi', roles: ['SUPER','DEV','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT'] },
  { to: '/clients',          icon: Users,           label: 'Clients',         roles: ['SUPER','DEV','SERVICE_CLIENT'] },
  { to: '/drivers',          icon: Bike,            label: 'Coursiers',       keywords: 'livreurs motos drivers', roles: ['SUPER','DEV','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT'] },
  { to: '/dem-pro',          icon: Briefcase,       label: 'DEM Pro',         keywords: 'boutiques commerçants offres paliers', roles: ['SUPER','SERVICE_CLIENT'] },
  { to: '/chefs-de-flotte',  icon: UserCog,         label: 'Chefs de flotte', keywords: 'flottes', roles: ['SUPER','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT'] },
  { to: '/validation',       icon: ShieldCheck,     label: 'Validation',      keywords: 'documents vérification inscriptions', roles: ['SUPER','ASSISTANCE_EXECUTIVE','SERVICE_CLIENT'] },
  { to: '/nouveaux-profils', icon: UserPlus,        label: 'Nouveaux profils', roles: ['SUPER','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE'] },
  { to: '/tableau',          icon: Table2,          label: 'Tableau',          roles: ['SUPER','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE'] },
  { to: '/finance',          icon: Wallet,          label: 'Finance',         roles: ['SUPER','FINANCE'], labelForRole: { FINANCE: 'Dashboard' } },
  { to: '/payments',         icon: CreditCard,      label: 'Paiements',       keywords: 'wave orange money retraits transactions', roles: ['SUPER','FINANCE'] },
  { to: '/orders',           icon: Package,         label: 'Courses',         keywords: 'commandes livraisons orders tournées', roles: ['SUPER','DEV','FINANCE','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE'] },
  { to: '/config',           icon: SlidersHorizontal, label: 'Tarifs',        keywords: 'prix zones config promo prix unique', roles: ['SUPER','DEV'] },
  { to: '/audit',            icon: ScrollText,       label: 'Audit',          keywords: 'journal historique', roles: ['SUPER','DEV'] },
  { to: '/incidents',        icon: AlertTriangle,    label: 'Incidents',      keywords: 'sos alertes litiges', roles: ['SUPER','DEV','SERVICE_CLIENT','ASSISTANCE_EXECUTIVE'] },
  { to: '/badges/clients',  icon: Award,            label: 'Badge client',   roles: ['SUPER','MARKETING'] },
  { to: '/badges/drivers',  icon: Award,            label: 'Badge livreur',  keywords: 'coursiers', roles: ['SUPER','MARKETING','ASSISTANCE_EXECUTIVE'] },
  { to: '/parrainage',      icon: GitBranch,        label: 'Parrainage',     roles: ['SUPER','MARKETING'] },
  { to: '/acquisition',     icon: TrendingUp,       label: 'Acquisition',    roles: ['SUPER'] },
  { to: '/recompenses',     icon: Gift,             label: 'Récompenses',    keywords: 'cadeaux bonus', roles: ['SUPER','MARKETING'] },
  { to: '/promotions',      icon: Percent,          label: 'Promotions',     keywords: 'codes promo réductions', roles: ['SUPER','MARKETING'] },
  { to: '/acquisition-overview', icon: TrendingUp,  label: 'Acquisition',    roles: ['ASSISTANCE_EXECUTIVE'], hideForSuper: true },
  { to: '/broadcast',       icon: Bell,             label: 'Notification',   keywords: 'push broadcast envoi messages', roles: ['SUPER','MARKETING'] },
  { to: '/equipes',          icon: UsersRound,       label: 'Equipes',        keywords: 'admins comptes rôles', roles: ['SUPER'] },
  { to: '/maintenance',      icon: Wrench,           label: 'Maintenance',    keywords: 'code secret sms otp interrupteurs version', roles: ['SUPER'] },
]

const ROLE_LABELS = {
  SUPER:                { label: 'Super Admin',           color: '#f59e0b' },
  DEV:                  { label: 'Dev Admin',             color: '#6366f1' },
  FINANCE:              { label: 'Finance Admin',         color: '#22c55e' },
  MARKETING:            { label: 'Marketing Admin',       color: '#ec4899' },
  SERVICE_CLIENT:       { label: 'Service Client',        color: '#06b6d4' },
  ASSISTANCE_EXECUTIVE: { label: 'Assistance Executive',  color: '#a855f7' },
}

// Sans accents ni majuscules : « recompense » retrouve « Récompenses ».
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function canSeeNav(item, adminRole) {
  // Dashboards Community/Service Client : leurs KPI sont intégrés au Dashboard
  // principal, SUPER n'a donc pas besoin de l'entrée de menu dédiée.
  if (item.hideForSuper && (!adminRole || adminRole === 'SUPER')) return false
  if (!item.roles) return true          // pas de restriction
  if (!adminRole || adminRole === 'SUPER') return true  // SUPER voit tout
  return item.roles.includes(adminRole)
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobile, isTablet } = useResponsive()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pageQuery, setPageQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const pageSearchRef = useRef(null)

  // Ferme le menu mobile à chaque changement de route
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // « / » place le curseur dans la recherche du menu (hors saisie en cours).
  useEffect(() => {
    function onKey(e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      e.preventDefault()
      if (isMobile) setMobileOpen(true)
      pageSearchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile])

  const visibleNav = NAV.filter(item => canSeeNav(item, user?.adminRole))
    .map(item => ({ ...item, label: item.labelForRole?.[user?.adminRole] ?? item.label }))
  const terms = normalize(pageQuery).split(/\s+/).filter(Boolean)
  const shownNav = terms.length === 0
    ? visibleNav
    : visibleNav.filter(item => {
      const haystack = normalize(`${item.label} ${item.keywords ?? ''} ${item.to}`)
      return terms.every(term => haystack.includes(term))
    })

  function openPage(to) {
    setPageQuery('')
    setActiveIndex(0)
    pageSearchRef.current?.blur()
    navigate(to)
  }

  function onPageSearchKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, shownNav.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && shownNav[activeIndex]) {
      e.preventDefault()
      openPage(shownNav[activeIndex].to)
    } else if (e.key === 'Escape') {
      setPageQuery('')
      setActiveIndex(0)
      e.currentTarget.blur()
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const collapsed = isTablet  // sidebar icônes seules sur tablette

  const sidebarW = collapsed ? 60 : 220

  const sidebar = (
    <aside style={{
      width: sidebarW,
      background: 'linear-gradient(175deg, #00b4d8 0%, #0077b6 100%)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: isMobile ? 'fixed' : 'fixed',
      top: 0, left: isMobile ? (mobileOpen ? 0 : -260) : 0, bottom: 0,
      zIndex: 200,
      boxShadow: '4px 0 20px rgba(0,119,182,0.20)',
      transition: 'left .25s ease, width .2s ease',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '14px 10px' : '14px 14px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        minHeight: 64,
      }}>
        {collapsed ? (
          <img src={logoSrc} alt="DEM" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }} />
        ) : (
          <img src={logoSrc} alt="DEM" style={{ width: 56, height: 'auto', display: 'block' }} />
        )}
      </div>

      {/* Recherche d'une page du menu (masquée en icônes seules, sur tablette) */}
      {!collapsed && (
        <div style={{ padding: '10px 10px 2px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 10px', height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.16)',
            border: '1px solid rgba(255,255,255,0.22)',
          }}>
            <Search size={15} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
            <input
              ref={pageSearchRef}
              value={pageQuery}
              onChange={e => { setPageQuery(e.target.value); setActiveIndex(0) }}
              onKeyDown={onPageSearchKey}
              placeholder="Rechercher une page…"
              aria-label="Rechercher une page du menu"
              className="nav-page-search"
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none',
                background: 'transparent', color: '#ffffff', fontSize: 13,
              }}
            />
            {pageQuery ? (
              <button
                onClick={() => { setPageQuery(''); setActiveIndex(0); pageSearchRef.current?.focus() }}
                aria-label="Effacer la recherche"
                style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <X size={14} color="rgba(255,255,255,0.85)" />
              </button>
            ) : (
              !isMobile && (
                <kbd style={{
                  fontSize: 10, lineHeight: '16px', padding: '0 5px', borderRadius: 4,
                  color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.35)',
                  fontFamily: 'inherit',
                }}>/</kbd>
              )
            )}
          </div>
        </div>
      )}

      {/* Nav — filtré selon adminRole, puis par la recherche */}
      <nav style={{ flex: 1, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {shownNav.length === 0 && (
          <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>
            Aucune page pour « {pageQuery.trim()} »
          </div>
        )}
        {shownNav.map(({ to, icon: Icon, label: resolvedLabel }, index) => {
          // Avec une recherche en cours : la ligne choisie au clavier (Entrée l'ouvre)
          const highlighted = terms.length > 0 && index === activeIndex
          return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? resolvedLabel : undefined}
            onClick={() => { setPageQuery(''); setActiveIndex(0) }}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              background: isActive ? 'rgba(255,255,255,0.22)' : 'transparent',
              boxShadow: highlighted ? 'inset 0 0 0 1.5px rgba(255,255,255,0.75)' : 'none',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            })}
          >
            <Icon size={17} />
            {!collapsed && resolvedLabel}
          </NavLink>
          )
        })}
      </nav>

      {/* User + rôle + Logout */}
      <div style={{
        padding: collapsed ? '10px 6px' : '10px 10px',
        borderTop: '1px solid rgba(255,255,255,0.18)',
      }}>
        {!collapsed && (() => {
          const role = user?.adminRole ?? 'SUPER'
          const rl   = ROLE_LABELS[role] ?? ROLE_LABELS.SUPER
          return (
            <div style={{ marginBottom: 6, paddingLeft: 4 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? user?.email}
              </div>
              <div style={{ marginTop: 3, display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: rl.color + '33', color: rl.color, border: `1px solid ${rl.color}55` }}>
                {rl.label}
              </div>
            </div>
          )
        })()}
        <button
          onClick={() => navigate('/change-password')}
          title={collapsed ? 'Changer mon mot de passe' : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8,
            width: '100%', padding: collapsed ? '8px 0' : '7px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 13,
            transition: 'all .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
        >
          <KeyRound size={15} />
          {!collapsed && 'Changer mon mot de passe'}
        </button>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Déconnexion' : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8,
            width: '100%', padding: collapsed ? '8px 0' : '7px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 13,
            transition: 'all .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
        >
          <LogOut size={15} />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Overlay mobile */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.4)',
            backdropFilter: 'blur(3px)', zIndex: 199,
          }}
        />
      )}

      {sidebar}

      {/* Main */}
      <main style={{
        marginLeft: isMobile ? 0 : sidebarW,
        flex: 1,
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Topbar mobile/tablet */}
        {(isMobile || isTablet) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.7)',
            position: 'sticky', top: 0, zIndex: 100,
          }}>
            {isMobile && (
              <button
                onClick={() => setMobileOpen(v => !v)}
                style={{ background: 'none', border: 'none', padding: 4, color: '#0077b6', display: 'flex' }}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
            <img src={logoSrc} alt="DEM" style={{ height: 32, width: 'auto' }} />
            <div style={{ flex: 1, minWidth: 0 }}><GlobalSearch compact /></div>
          </div>
        )}

        <SosAlertBanner />

        <div style={{ padding: isMobile ? '16px 14px' : isTablet ? '20px 20px' : '28px 32px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {!(isMobile || isTablet) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <GlobalSearch />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
