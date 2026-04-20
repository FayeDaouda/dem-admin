import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('dem_admin_token')
    const stored = localStorage.getItem('dem_admin_user')
    if (token && stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        logout()
      }
    }
    setLoading(false)
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
