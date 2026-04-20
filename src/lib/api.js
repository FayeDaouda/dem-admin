import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? ''

const api = axios.create({
  baseURL: BASE || '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dem_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dem_admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
