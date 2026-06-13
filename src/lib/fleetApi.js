import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? ''

const fleetApi = axios.create({
  baseURL: BASE || '/api',
  timeout: 10000,
})

fleetApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('dem_fleet_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

fleetApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dem_fleet_token')
      localStorage.removeItem('dem_fleet_user')
      window.location.href = '/fleet/login'
    }
    return Promise.reject(err)
  }
)

export default fleetApi
