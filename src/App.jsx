import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { lazy, Suspense } from 'react'
import Layout      from './components/Layout'
import Login       from './pages/Login'
import Dashboard   from './pages/Dashboard'
import Payments    from './pages/Payments'
import Orders      from './pages/Orders'
import Drivers     from './pages/Drivers'
import Clients     from './pages/Clients'
import Config      from './pages/Config'
import Acquisition from './pages/Acquisition'
import Validation    from './pages/Validation'
import Incidents    from './pages/Incidents'
import Audit        from './pages/Audit'
import ChefsDeFlotte from './pages/ChefsDeFlotte'
import ChefDetailPage from './pages/ChefDetailPage'
import DemPro from './pages/DemPro'
import ServiceClient from './pages/ServiceClient'
import Equipes from './pages/Equipes'
import Badges from './pages/Badges'
import Parrainage from './pages/Parrainage'

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
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/service-client" element={<ProtectedRoute><ServiceClient /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/drivers"  element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
      <Route path="/clients"  element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/config"      element={<ProtectedRoute><Config /></ProtectedRoute>} />
      <Route path="/acquisition" element={<ProtectedRoute><Acquisition /></ProtectedRoute>} />
      <Route path="/badges"     element={<ProtectedRoute><Badges /></ProtectedRoute>} />
      <Route path="/parrainage" element={<ProtectedRoute><Parrainage /></ProtectedRoute>} />
      <Route path="/incidents"   element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/audit"       element={<ProtectedRoute><Audit /></ProtectedRoute>} />
      <Route path="/validation"      element={<ProtectedRoute><Validation /></ProtectedRoute>} />
      <Route path="/equipes"         element={<ProtectedRoute><Equipes /></ProtectedRoute>} />
      <Route path="/dem-pro"          element={<ProtectedRoute><DemPro /></ProtectedRoute>} />
      <Route path="/chefs-de-flotte" element={<ProtectedRoute><ChefsDeFlotte /></ProtectedRoute>} />
      <Route path="/chefs-de-flotte/:id" element={<ProtectedRoute><ChefDetailPage /></ProtectedRoute>} />
      <Route path="/fleet/*" element={<FleetSection />} />
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
