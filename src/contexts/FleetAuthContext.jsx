import { createContext, useContext, useState, useEffect } from 'react'
import fleetApi from '../lib/fleetApi'
import publicApi from '../lib/publicApi'

const FleetAuthContext = createContext(null)

export function FleetAuthProvider({ children }) {
  const [fleetUser, setFleetUser] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const token  = localStorage.getItem('dem_fleet_token')
    const stored = localStorage.getItem('dem_fleet_user')
    if (!token || !stored) { setLoading(false); return }

    fleetApi.get('/chefs-de-flotte/me/stats')
      .then(() => setFleetUser(JSON.parse(stored)))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('dem_fleet_token')
          localStorage.removeItem('dem_fleet_user')
        } else {
          setFleetUser(JSON.parse(stored))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function sendOtp(phone) {
    await publicApi.post('/auth/send-otp', { phone })
  }

  async function verifyOtp(phone, code) {
    const res = await publicApi.post('/auth/verify-otp', { phone, code })
    const { token, user } = res.data

    if (user.role !== 'CHEF_DE_FLOTTE') {
      throw new Error('Ce compte n\'est pas un compte chef de flotte.')
    }

    localStorage.setItem('dem_fleet_token', token)
    localStorage.setItem('dem_fleet_user', JSON.stringify(user))
    setFleetUser(user)
    return { hasPassword: !!user.hasPassword }
  }

  async function setPassword(password, email) {
    const res = await fleetApi.post('/chefs-de-flotte/me/set-password', {
      password, ...(email ? { email } : {}),
    })
    const updated = { ...fleetUser, ...res.data.user, hasPassword: true }
    localStorage.setItem('dem_fleet_user', JSON.stringify(updated))
    setFleetUser(updated)
    return updated
  }

  async function loginWithPassword(identifier, password) {
    const res = await publicApi.post('/chefs-de-flotte/auth/login', { identifier, password })
    const { token, user } = res.data
    const formatted = { ...user, hasPassword: true }
    localStorage.setItem('dem_fleet_token', token)
    localStorage.setItem('dem_fleet_user', JSON.stringify(formatted))
    setFleetUser(formatted)
    return formatted
  }

  function logout() {
    localStorage.removeItem('dem_fleet_token')
    localStorage.removeItem('dem_fleet_user')
    setFleetUser(null)
  }

  return (
    <FleetAuthContext.Provider value={{ fleetUser, loading, sendOtp, verifyOtp, setPassword, loginWithPassword, logout }}>
      {children}
    </FleetAuthContext.Provider>
  )
}

export const useFleetAuth = () => useContext(FleetAuthContext)
