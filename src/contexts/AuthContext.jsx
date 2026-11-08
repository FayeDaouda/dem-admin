import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { setCurrentAccess } from '../lib/droits'
import { getPreview, savePreview } from '../lib/preview'

const isSuperAccount = admin => !!admin && (!admin.adminRole || admin.adminRole === 'SUPER')

// Compte vu par l'admin : le vrai compte, ou — pendant un aperçu d'un rôle
// par le Super Admin — le même compte avec le rôle regardé.
function viewedAs(admin, preview) {
  if (!preview || !isSuperAccount(admin)) return admin
  return {
    ...admin,
    adminRole: preview.key, adminAccess: preview.access, adminHiddenPages: preview.hiddenPages ?? [],
    adminRoleLabel: preview.label, adminRoleColor: preview.color,
    previewing: true,
  }
}

const AuthContext = createContext(null)

// Les droits d'affichage (lib/droits.js) suivent les accès du rôle vu.
function applyAccess(admin, preview) {
  const viewed = viewedAs(admin, preview)
  setCurrentAccess(viewed?.adminRole, viewed?.adminAccess, viewed?.adminHiddenPages)
}

export function AuthProvider({ children }) {
  const [realUser, setUserState] = useState(null)
  const [preview, setPreview]    = useState(getPreview)
  const [loading, setLoading]    = useState(true)
  const user = viewedAs(realUser, preview)

  function setUser(admin) {
    applyAccess(admin, getPreview()) // même valeur que `preview`, lue du stockage
    setUserState(admin)
  }

  // Aperçu d'un rôle (Super Admin) : { key, label, color, access, hiddenPages }
  function startPreview(role) {
    if (!isSuperAccount(realUser)) return
    savePreview(role)
    applyAccess(realUser, role)
    setPreview(role)
  }

  function stopPreview() {
    savePreview(null)
    applyAccess(realUser, null)
    setPreview(null)
  }

  useEffect(() => {
    const token  = localStorage.getItem('dem_admin_token')
    const stored = localStorage.getItem('dem_admin_user')
    if (!token || !stored) { setLoading(false); return }

    // Vérifie que le token est toujours valide côté serveur
    api.get('/admin/auth/me')
      .then(res => {
        const admin = res.data?.admin ?? res.data
        localStorage.setItem('dem_admin_user', JSON.stringify(admin))
        setUser(admin)
      })
      .catch((err) => {
        // Seul un 401 signifie token invalide → déconnexion
        // 404/500/réseau = backend indisponible → on garde la session stockée
        if (err.response?.status === 401) {
          localStorage.removeItem('dem_admin_token')
          localStorage.removeItem('dem_admin_user')
        } else {
          setUser(JSON.parse(stored))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const res = await api.post('/admin/auth/login', { email, password })
    const { token, admin, mustChangePassword } = res.data
    localStorage.setItem('dem_admin_token', token)
    localStorage.setItem('dem_admin_user', JSON.stringify({ ...admin, mustChangePassword }))
    setUser({ ...admin, mustChangePassword })
    return { ...admin, mustChangePassword }
  }

  function logout() {
    localStorage.removeItem('dem_admin_token')
    localStorage.removeItem('dem_admin_user')
    savePreview(null)
    setPreview(null)
    setUser(null)
  }

  // Rafraîchit la session en place (ex: après un changement de mot de passe
  // réussi) sans repasser par /auth/login.
  function applySession(token, admin) {
    localStorage.setItem('dem_admin_token', token)
    localStorage.setItem('dem_admin_user', JSON.stringify(admin))
    setUser(admin)
  }

  return (
    <AuthContext.Provider value={{ user, realUser, preview: user?.previewing ? preview : null, startPreview, stopPreview, loading, login, logout, applySession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
