import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { config } from '../config'
import type { TokenResponse } from './types'
import { clearToken, getRefreshToken, getToken, setTokens } from './token'

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
 *
 * Budget: attempts × the 30 s client timeout (+ the small delays) ≈ 4.8 min —
 * a full JVM wake-up on the free tier is measured in minutes, and a budget
 * shorter than that made the retry give up (and error out) mid-wake.
 */
export async function withColdStartRetry<T>(fn: () => Promise<T>, attempts = 9, delayMs = 2000): Promise<T> {
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

// Single-flight refresh: concurrent 401s share one refresh round-trip. Exposed
// so the WebSocket layer can renew the token on a STOMP auth error too.
let refreshPromise: Promise<string | null> | null = null

export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    // Bare axios (not `client`) so the response interceptor can't recurse.
    const { data } = await axios.post<TokenResponse>(`${config.apiUrl}/api/auth/refresh`, { refreshToken })
    setTokens(data.accessToken, data.refreshToken)
    return data.accessToken
  } catch {
    clearToken()
    return null
  }
}

// On a 401, transparently refresh the access token once and replay the request.
// If refresh fails, the session is over: clear it and return to login.
// Auth endpoints (login/register/refresh) are exempt — their 401s are real.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const url: string = original?.url ?? ''
    const isAuthRequest = url.includes('/api/auth/')
    if (error.response?.status === 401 && !isAuthRequest && original && !original._retry) {
      original._retry = true
      const newToken = await refreshSession()
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return client(original)
      }
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
