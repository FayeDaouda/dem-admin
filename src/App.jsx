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
import Validation  from './pages/Validation'

const LiveMap = lazy(() => import('./pages/LiveMap'))

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
      <Route path="/map" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/drivers"  element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
      <Route path="/clients"  element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/config"      element={<ProtectedRoute><Config /></ProtectedRoute>} />
      <Route path="/acquisition" element={<ProtectedRoute><Acquisition /></ProtectedRoute>} />
      <Route path="/validation"  element={<ProtectedRoute><Validation /></ProtectedRoute>} />
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
