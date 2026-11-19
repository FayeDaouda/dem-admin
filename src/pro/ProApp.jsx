import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './pro.css'
import { ProAuthProvider } from './ProAuth'
import { useProAuth } from './proAuthContext'
import { NotifyProvider } from './ui/notify'
import ProLayout from './ProLayout'
import Login from './pages/Login'

// Espace web DEM Pro : pro.dem.sn (racine) ou admin.dem.sn/pro.
// Indépendant de l'admin : sa propre connexion (compte DEM Pro), son menu.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Deliveries = lazy(() => import('./pages/Deliveries'))
const NewDelivery = lazy(() => import('./pages/NewDelivery'))
const Shop = lazy(() => import('./pages/Shop'))
const Requests = lazy(() => import('./pages/Requests'))
const WalletPage = lazy(() => import('./pages/WalletPage'))
const Account = lazy(() => import('./pages/Account'))

function Loader() {
  return (
    <div className="pro" style={{ display: 'grid', placeItems: 'center' }} role="status" aria-label="Chargement de votre espace">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }} className="anim-in">
        <p className="label-caps" style={{ margin: 0, color: 'var(--p-ink)' }}>DEM <span style={{ color: 'var(--p-cyan-2)' }}>Pro</span></p>
        <div style={{ width: 120, height: 2, background: 'var(--p-line)', overflow: 'hidden' }}>
          <div className="skel" style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, #00D2FF, transparent)', backgroundSize: '240px 100%' }} />
        </div>
      </div>
    </div>
  )
}

function Protected({ children }) {
  const { user, loading } = useProAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/connexion" replace />
  return <ProLayout><Suspense fallback={<div />}>{children}</Suspense></ProLayout>
}

function PublicOnly({ children }) {
  const { user, loading } = useProAuth()
  if (loading) return <Loader />
  return user ? <Navigate to="/" replace /> : children
}

export default function ProApp({ basename = '' }) {
  useEffect(() => {
    document.title = 'DEM Pro'
    document.body.style.background = '#F6F8FB'
  }, [])
  return (
    <BrowserRouter basename={basename}>
      <NotifyProvider>
        <ProAuthProvider>
          <Routes>
            <Route path="/connexion" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/livraisons" element={<Protected><Deliveries /></Protected>} />
            <Route path="/livraisons/nouvelle" element={<Protected><NewDelivery /></Protected>} />
            <Route path="/boutique" element={<Protected><Shop /></Protected>} />
            <Route path="/commandes" element={<Protected><Requests /></Protected>} />
            <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
            <Route path="/compte" element={<Protected><Account /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProAuthProvider>
      </NotifyProvider>
    </BrowserRouter>
  )
}
