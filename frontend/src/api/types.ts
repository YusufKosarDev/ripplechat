export interface User {
  id: string
  username: string
  email: string
  displayName: string | null
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: User
}

export interface LoginRequest {
  login: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  displayName?: string
  password: string
}

// Matches the backend's consistent error body.
export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  fieldErrors?: { field: string; message: string }[]
}
