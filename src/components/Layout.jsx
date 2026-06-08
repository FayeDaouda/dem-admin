import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, CreditCard, Package, Users, Settings, LogOut, Truck, Map, Menu, X, TrendingUp, ShieldCheck, AlertTriangle, ScrollText, UserCog,
} from 'lucide-react'
import logoSrc from '../assets/logo-dem.svg'
import { useResponsive } from '../lib/useResponsive'

// roles: undefined = tous les rôles. Sinon tableau des rôles autorisés (SUPER bypass toujours).
const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/map',         icon: Map,             label: 'Carte live',   roles: ['SUPER','DEV'] },
  { to: '/payments',    icon: CreditCard,      label: 'Paiements',    roles: ['SUPER','FINANCE'] },
  { to: '/orders',      icon: Package,         label: 'Courses',      roles: ['SUPER','DEV','FINANCE'] },
  { to: '/drivers',          icon: Truck,     label: 'Drivers',          roles: ['SUPER','DEV'] },
  { to: '/clients',          icon: Users,     label: 'Clients',          roles: ['SUPER','DEV'] },
  { to: '/chefs-de-flotte',  icon: UserCog,   label: 'Chefs de flotte',  roles: ['SUPER'] },
  { to: '/acquisition', icon: TrendingUp,      label: 'Acquisition',  roles: ['SUPER','MARKETING'] },
  { to: '/incidents',   icon: AlertTriangle,   label: 'Incidents',    roles: ['SUPER','DEV'] },
  { to: '/audit',       icon: ScrollText,      label: 'Audit',        roles: ['SUPER','DEV'] },
  { to: '/validation',  icon: ShieldCheck,     label: 'Validation',   roles: ['SUPER'] },
  { to: '/config',      icon: Settings,        label: 'Tarifs',       roles: ['SUPER','DEV'] },
]

const ROLE_LABELS = {
  SUPER:     { label: 'Super Admin',     color: '#f59e0b' },
  DEV:       { label: 'Dev Admin',       color: '#6366f1' },
  FINANCE:   { label: 'Finance Admin',   color: '#22c55e' },
  MARKETING: { label: 'Marketing Admin', color: '#ec4899' },
}

function canSeeNav(item, adminRole) {
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

  // Ferme le menu mobile à chaque changement de route
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

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
          <img src={logoSrc} alt="DEM" style={{ width: 120, height: 'auto', display: 'block' }} />
        )}
      </div>

      {/* Nav — filtré selon adminRole */}
      <nav style={{ flex: 1, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.filter(item => canSeeNav(item, user?.adminRole)).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              background: isActive ? 'rgba(255,255,255,0.22)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            })}
          >
            <Icon size={17} />
            {!collapsed && label}
          </NavLink>
        ))}
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
        minHeight: '100vh',
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
          </div>
        )}

        <div style={{ padding: isMobile ? '16px 14px' : isTablet ? '20px 20px' : '28px 32px', flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
