import axios from 'axios'
import { config } from '../config'
import { clearToken, getToken } from './token'

export const client = axios.create({
  baseURL: config.apiUrl,
})

// Attach the JWT to every request when present.
client.interceptors.request.use((request) => {
  const token = getToken()
  if (token) {
    request.headers.Authorization = `Bearer ${token}`
  }
  return request
})

// On an expired/invalid session (401), drop the token and return to login.
// Login/register failures (also 401) are left for the forms to display.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? ''
    const isAuthRequest = url.includes('/api/auth/')
    if (error.response?.status === 401 && !isAuthRequest) {
      clearToken()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
