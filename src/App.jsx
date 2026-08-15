import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { lazy, Suspense } from 'react'
import { homeRouteForRole } from './lib/roleHome'
import Layout      from './components/Layout'
import Login       from './pages/Login'
import ChangePasswordRequired from './pages/ChangePasswordRequired'
import Dashboard   from './pages/Dashboard'
import Payments    from './pages/Payments'
import Orders      from './pages/Orders'
import Drivers     from './pages/Drivers'
import Clients     from './pages/Clients'
import Config      from './pages/Config'
import Acquisition from './pages/Acquisition'
import AcquisitionOverview from './pages/AcquisitionOverview'
import Promotions from './pages/Promotions'
import NewProfiles from './pages/NewProfiles'
import OutreachTable from './pages/OutreachTable'
import Validation    from './pages/Validation'
import Incidents    from './pages/Incidents'
import Audit        from './pages/Audit'
import ChefsDeFlotte from './pages/ChefsDeFlotte'
import ChefDetailPage from './pages/ChefDetailPage'
import DemPro from './pages/DemPro'
import ServiceClient from './pages/service-client'
import Marketing from './pages/marketing'
import Finance from './pages/finance'
import Equipes from './pages/Equipes'
import { ClientBadgesPage, DriverBadgesPage } from './pages/Badges'
import Parrainage from './pages/Parrainage'
import Broadcast from './pages/Broadcast'

const LiveMap     = lazy(() => import('./pages/LiveMap'))
const FleetSection = lazy(() => import('./pages/fleet/FleetSection'))

const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
    Chargement…
  </div>
)

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Layout>{children}</Layout>
}

// Comme ProtectedRoute, mais réservée aux routes dont TOUTES les données
// viennent d'endpoints strictement SUPER côté backend (voir admin.routes.js
// — `onlySuper`) : gestion des comptes admin, approbation des demandes de
// reset de mot de passe. Aucun autre rôle n'a le moindre accès légitime en
// lecture ici (contrairement à la plupart des pages, où le backend autorise
// déjà une lecture partagée à plusieurs rôles — les restreindre ici casserait
// un accès réel, voir diagnostic pré-prod). Même règle de bypass que
// `requireAdminRole()` côté backend : pas d'adminRole (vieux compte) ou SUPER.
function SuperOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  if (user.adminRole && user.adminRole !== 'SUPER') {
    return <Navigate to={homeRouteForRole(user.adminRole)} replace />
  }
  return <Layout>{children}</Layout>
}

// Accessible dès qu'une session existe, même si mustChangePassword est vrai
// (sinon ProtectedRoute ci-dessus bouclerait indéfiniment vers cette page).
function ChangePasswordRoute() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <ChangePasswordRequired />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={
        user
          ? <Navigate to={user.mustChangePassword ? '/change-password' : homeRouteForRole(user.adminRole)} replace />
          : <Login />
      } />
      <Route path="/change-password" element={<ChangePasswordRoute />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/service-client" element={<ProtectedRoute><ServiceClient /></ProtectedRoute>} />
      <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/drivers"  element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
      <Route path="/clients"  element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/config"      element={<ProtectedRoute><Config /></ProtectedRoute>} />
      <Route path="/acquisition" element={<ProtectedRoute><Acquisition /></ProtectedRoute>} />
      <Route path="/acquisition-overview" element={<ProtectedRoute><AcquisitionOverview /></ProtectedRoute>} />
      <Route path="/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
      <Route path="/nouveaux-profils" element={<ProtectedRoute><NewProfiles /></ProtectedRoute>} />
      <Route path="/tableau" element={<ProtectedRoute><OutreachTable /></ProtectedRoute>} />
      <Route path="/badges/clients" element={<ProtectedRoute><ClientBadgesPage /></ProtectedRoute>} />
      <Route path="/badges/drivers" element={<ProtectedRoute><DriverBadgesPage /></ProtectedRoute>} />
      <Route path="/parrainage" element={<ProtectedRoute><Parrainage /></ProtectedRoute>} />
      <Route path="/broadcast"  element={<ProtectedRoute><Broadcast /></ProtectedRoute>} />
      <Route path="/incidents"   element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/audit"       element={<ProtectedRoute><Audit /></ProtectedRoute>} />
      <Route path="/validation"      element={<ProtectedRoute><Validation /></ProtectedRoute>} />
      <Route path="/equipes"         element={<SuperOnlyRoute><Equipes /></SuperOnlyRoute>} />
      <Route path="/dem-pro"          element={<ProtectedRoute><DemPro /></ProtectedRoute>} />
      <Route path="/chefs-de-flotte" element={<ProtectedRoute><ChefsDeFlotte /></ProtectedRoute>} />
      <Route path="/chefs-de-flotte/:id" element={<ProtectedRoute><ChefDetailPage /></ProtectedRoute>} />
      <Route path="/fleet/*" element={<ProtectedRoute><FleetSection /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
