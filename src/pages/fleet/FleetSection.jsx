import { Routes, Route, Navigate } from 'react-router-dom'
import { FleetAuthProvider, useFleetAuth } from '../../contexts/FleetAuthContext'
import FleetLayout from '../../components/FleetLayout'
import FleetLogin from './FleetLogin'
import FleetSetPassword from './FleetSetPassword'
import FleetDashboard from './FleetDashboard'
import FleetDrivers from './FleetDrivers'
import FleetMap from './FleetMap'
import FleetExtension from './FleetExtension'

const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
    Chargement…
  </div>
)

function FleetProtectedRoute({ children }) {
  const { fleetUser, loading } = useFleetAuth()
  if (loading) return <PageLoader />
  if (!fleetUser) return <Navigate to="/fleet/login" replace />
  if (!fleetUser.hasPassword) return <Navigate to="/fleet/set-password" replace />
  return <FleetLayout>{children}</FleetLayout>
}

function FleetLoginRoute() {
  const { fleetUser, loading } = useFleetAuth()
  if (loading) return <PageLoader />
  if (fleetUser?.hasPassword) return <Navigate to="/fleet" replace />
  if (fleetUser) return <Navigate to="/fleet/set-password" replace />
  return <FleetLogin />
}

function FleetRoutes() {
  return (
    <Routes>
      <Route path="login" element={<FleetLoginRoute />} />
      <Route path="set-password" element={<FleetSetPassword />} />
      <Route path="" element={<FleetProtectedRoute><FleetDashboard /></FleetProtectedRoute>} />
      <Route path="drivers" element={<FleetProtectedRoute><FleetDrivers /></FleetProtectedRoute>} />
      <Route path="map" element={<FleetProtectedRoute><FleetMap /></FleetProtectedRoute>} />
      <Route path="extension" element={<FleetProtectedRoute><FleetExtension /></FleetProtectedRoute>} />
      <Route path="*" element={<Navigate to="/fleet" replace />} />
    </Routes>
  )
}

export default function FleetSection() {
  return (
    <FleetAuthProvider>
      <FleetRoutes />
    </FleetAuthProvider>
  )
}
