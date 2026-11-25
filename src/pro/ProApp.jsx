import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './pro.css'
import { ProAuthProvider } from './ProAuth'
import { useProAuth } from './proAuthContext'
import { NotifyProvider } from './ui/notify'
import ProLayout from './ProLayout'
import AccountGate from './AccountGate'
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
const Batches = lazy(() => import('./pages/Batches'))
const NewBatch = lazy(() => import('./pages/NewBatch'))
const Clients = lazy(() => import('./pages/Clients'))
const Stats = lazy(() => import('./pages/Stats'))
const Team = lazy(() => import('./pages/Team'))
const ApiDem = lazy(() => import('./pages/ApiDem'))
const Referral = lazy(() => import('./pages/Referral'))

// Accueil : tableau de bord, ou Livraisons pour un employé (sans accès au tableau de bord)
function Home() {
  const { can } = useProAuth()
  return can('dashboard') ? <Dashboard /> : <Navigate to="/livraisons" replace />
}

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
  return <AccountGate><ProLayout><Suspense fallback={<div />}>{children}</Suspense></ProLayout></AccountGate>
}

function PublicOnly({ children }) {
  const { user, loading } = useProAuth()
  if (loading) return <Loader />
  return user ? <Navigate to="/" replace /> : children
}

export default function ProApp({ basename = '' }) {
  useEffect(() => {
    document.title = 'DEM Pro'
    // index.html est celui de l'admin (lang="en") : lecteurs d'écran et traduction
    document.documentElement.lang = 'fr'
    document.body.style.background = '#F6F8FB'
  }, [])
  return (
    <BrowserRouter basename={basename}>
      <NotifyProvider>
        <ProAuthProvider>
          <Routes>
            <Route path="/connexion" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/" element={<Protected><Home /></Protected>} />
            <Route path="/livraisons" element={<Protected><Deliveries /></Protected>} />
            <Route path="/livraisons/nouvelle" element={<Protected><NewDelivery /></Protected>} />
            <Route path="/boutique" element={<Protected><Shop /></Protected>} />
            <Route path="/commandes" element={<Protected><Requests /></Protected>} />
            <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
            <Route path="/compte" element={<Protected><Account /></Protected>} />
            <Route path="/compte/equipe" element={<Protected><Team /></Protected>} />
            <Route path="/compte/api" element={<Protected><ApiDem /></Protected>} />
            <Route path="/compte/parrainage" element={<Protected><Referral /></Protected>} />
            <Route path="/tournees" element={<Protected><Batches /></Protected>} />
            <Route path="/tournees/nouvelle" element={<Protected><NewBatch /></Protected>} />
            <Route path="/clients" element={<Protected><Clients /></Protected>} />
            <Route path="/statistiques" element={<Protected><Stats /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProAuthProvider>
      </NotifyProvider>
    </BrowserRouter>
  )
}
