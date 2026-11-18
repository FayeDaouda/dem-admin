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
    <div className="pro" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }} className="anim-in">
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--p-gradient)', animation: 'pro-pulse 1.6s infinite' }} />
        <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>Chargement de votre espace…</span>
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
    document.title = 'DEM Pro — Votre espace'
    document.body.style.background = '#f3f6fb'
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
