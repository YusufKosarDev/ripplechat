import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import { config } from '../../config'
import { client, withColdStartRetry } from '../../api/client'
import { clearToken, getRefreshToken, getToken, setTokens } from '../../api/token'
import type { ApiError, AuthResponse, LoginRequest, RegisterRequest, User } from '../../api/types'

function extractError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data) {
    const data = e.response.data as ApiError
    if (data.fieldErrors && data.fieldErrors.length > 0) {
      return data.fieldErrors.map((f) => f.message).join(', ')
    }
    // RFC 7807 problem responses carry the message in `detail`; keep `message`
    // as a fallback for any non-problem error body.
    if (data.detail) {
      return data.detail
    }
    if (data.message) {
      return data.message
    }
  }
  return 'auth.genericError'
}

interface AuthState {
  token: string | null
  user: User | null
  status: 'idle' | 'loading'
  error: string | null
  requires2Fa: boolean
  preAuthToken: string | null
}

const initialState: AuthState = {
  token: getToken(),
  user: null,
  status: 'idle',
  error: null,
  requires2Fa: false,
  preAuthToken: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async (body: LoginRequest, { rejectWithValue }) => {
    try {
      const { data } = await withColdStartRetry(() => client.post<AuthResponse>('/api/auth/login', body))
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

export const verify2Fa = createAsyncThunk(
  'auth/verify2Fa',
  async (body: { preAuthToken: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await client.post<AuthResponse>('/api/auth/2fa/verify', body)
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

export const register = createAsyncThunk(
  'auth/register',
  async (body: RegisterRequest, { rejectWithValue }) => {
    try {
      const { data } = await withColdStartRetry(() => client.post<AuthResponse>('/api/auth/register', body))
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

// Server-side logout: revoke the refresh token so it can't renew a session.
// Best-effort — the local session is cleared regardless of the network result.
export const logout = createAsyncThunk('auth/logout', async () => {
  const refreshToken = getRefreshToken()
  clearToken()
  if (refreshToken) {
    try {
      await axios.post(`${config.apiUrl}/api/auth/logout`, { refreshToken }, { timeout: 5000 })
    } catch {
      // ignore — the refresh token will expire on its own
    }
  }
})

export const fetchCurrentUser = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await client.get<User>('/api/users/me')
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

export const updateMe = createAsyncThunk(
  'auth/updateMe',
  async (body: { displayName?: string; email?: string; avatarColor?: string; avatarUrl?: string }, { rejectWithValue }) => {
    try {
      const { data } = await client.put<User>('/api/users/me', body)
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

export const setStatus = createAsyncThunk(
  'auth/setStatus',
  async (body: { emoji?: string; text?: string; expiresInMinutes?: number | null }, { rejectWithValue }) => {
    try {
      const { data } = await client.put<User>('/api/users/me/status', body)
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

export const setDnd = createAsyncThunk(
  'auth/setDnd',
  async (body: { minutes: number | null }, { rejectWithValue }) => {
    try {
      const { data } = await client.put<User>('/api/users/me/dnd', body)
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (body: { currentPassword: string; newPassword: string }, { rejectWithValue }) => {
    try {
      await client.put('/api/users/me/password', body)
      return true
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
    oauth2LoginSuccess(state) {
      state.token = getToken()
      state.status = 'idle'
      state.error = null
      state.requires2Fa = false
      state.preAuthToken = null
    },
  },
  extraReducers: (builder) => {
    const onAuthSuccess = (state: AuthState, action: PayloadAction<AuthResponse>) => {
      state.status = 'idle'
      state.error = null
      
      if (action.payload.requires2Fa) {
        state.requires2Fa = true
        state.preAuthToken = action.payload.preAuthToken ?? null
        return
      }

      state.requires2Fa = false
      state.preAuthToken = null
      state.token = action.payload.accessToken ?? null
      state.user = action.payload.user ?? null
      if (action.payload.accessToken && action.payload.refreshToken) {
        setTokens(action.payload.accessToken, action.payload.refreshToken)
      }
    }
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, onAuthSuccess)
      .addCase(login.rejected, (state, action) => {
        state.status = 'idle'
        state.error = action.payload as string
      })
      .addCase(verify2Fa.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(verify2Fa.fulfilled, onAuthSuccess)
      .addCase(verify2Fa.rejected, (state, action) => {
        state.status = 'idle'
        state.error = action.payload as string
      })
      .addCase(register.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(register.fulfilled, onAuthSuccess)
      .addCase(register.rejected, (state, action) => {
        state.status = 'idle'
        state.error = action.payload as string
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(updateMe.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(setStatus.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(setDnd.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        // Token is invalid/expired; drop it so route guards send us to login.
        state.token = null
        state.user = null
        clearToken()
      })
      .addCase(logout.pending, (state) => {
        // Clear immediately so route guards redirect without waiting on the network.
        state.token = null
        state.user = null
        state.error = null
        state.requires2Fa = false
        state.preAuthToken = null
      })
  },
})

export const { clearError, oauth2LoginSuccess } = authSlice.actions
export default authSlice.reducer
