import axios from 'axios'
import { config } from '../config'
import { clearToken, getToken } from './token'

export const client = axios.create({
  baseURL: config.apiUrl,
  // Cap each request so a sleeping host (Render free tier cold start) doesn't
  // hang forever, while still being generous enough to ride out a wake-up.
  timeout: 30000,
})

/**
 * Retries a request through a cold start. Render free-tier instances sleep and
 * the first hit can time out or return 502/503/504 while waking; those are
 * retried with a short backoff. Real errors (4xx like 401/409) are not retried.
 * Used for the auth calls behind the landing/login/demo buttons.
 */
export async function withColdStartRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 2000): Promise<T> {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn()
    } catch (e) {
      const ax = axios.isAxiosError(e) ? e : undefined
      const noResponse = !!ax && !ax.response // network error or timeout (ECONNABORTED)
      const status = ax?.response?.status
      const coldStart = noResponse || status === 502 || status === 503 || status === 504
      if (!coldStart || i === attempts) throw e
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw new Error('unreachable')
}

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
