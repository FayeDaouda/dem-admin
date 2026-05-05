import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

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
    const { token, admin } = res.data
    localStorage.setItem('dem_admin_token', token)
    localStorage.setItem('dem_admin_user', JSON.stringify(admin))
    setUser(admin)
    return admin
  }

  function logout() {
    localStorage.removeItem('dem_admin_token')
    localStorage.removeItem('dem_admin_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
