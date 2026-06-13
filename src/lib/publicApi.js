import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? ''

// Instance sans intercepteur — utilisée pour les endpoints publics (OTP, login)
// où une erreur 401 (ex: mauvais mot de passe) ne doit pas déclencher de redirection.
const publicApi = axios.create({
  baseURL: BASE || '/api',
  timeout: 10000,
})

export default publicApi
