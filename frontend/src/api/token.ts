const ACCESS_KEY = 'ripplechat_token'
const REFRESH_KEY = 'ripplechat_refresh'

export const getToken = (): string | null => localStorage.getItem(ACCESS_KEY)

export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY)

// Stores both tokens (login/register, and a rotated refresh token).
export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

// Updates only the access token.
export const setToken = (accessToken: string): void => localStorage.setItem(ACCESS_KEY, accessToken)

// Clears the whole session (both tokens).
export const clearToken = (): void => {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
