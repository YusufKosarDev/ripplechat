import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import { client } from '../../api/client'
import { clearToken, getToken, setToken } from '../../api/token'
import type { ApiError, AuthResponse, LoginRequest, RegisterRequest, User } from '../../api/types'

function extractError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data) {
    const data = e.response.data as ApiError
    if (data.fieldErrors && data.fieldErrors.length > 0) {
      return data.fieldErrors.map((f) => f.message).join(', ')
    }
    if (data.message) {
      return data.message
    }
  }
  return 'Bir hata oluştu, lütfen tekrar deneyin.'
}

interface AuthState {
  token: string | null
  user: User | null
  status: 'idle' | 'loading'
  error: string | null
}

const initialState: AuthState = {
  token: getToken(),
  user: null,
  status: 'idle',
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async (body: LoginRequest, { rejectWithValue }) => {
    try {
      const { data } = await client.post<AuthResponse>('/api/auth/login', body)
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
      const { data } = await client.post<AuthResponse>('/api/auth/register', body)
      return data
    } catch (e) {
      return rejectWithValue(extractError(e))
    }
  },
)

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

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null
      state.user = null
      state.error = null
      clearToken()
    },
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    const onAuthSuccess = (state: AuthState, action: PayloadAction<AuthResponse>) => {
      state.status = 'idle'
      state.error = null
      state.token = action.payload.accessToken
      state.user = action.payload.user
      setToken(action.payload.accessToken)
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
      .addCase(fetchCurrentUser.rejected, (state) => {
        // Token is invalid/expired; drop it so route guards send us to login.
        state.token = null
        state.user = null
        clearToken()
      })
  },
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
