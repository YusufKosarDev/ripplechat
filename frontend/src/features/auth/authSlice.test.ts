import { configureStore } from '@reduxjs/toolkit'
import { beforeEach, describe, expect, it } from 'vitest'
import authReducer, { login, logout } from './authSlice'
import { getToken } from '../../api/token'

const makeStore = () => configureStore({ reducer: { auth: authReducer } })
const authSuccess = {
  type: login.fulfilled.type,
  payload: { accessToken: 'tok123', tokenType: 'Bearer', user: { id: '1', username: 'demo' } },
}

describe('authSlice', () => {
  beforeEach(() => localStorage.clear())

  it('stores the token + user and persists the token on successful auth', () => {
    const store = makeStore()
    store.dispatch(authSuccess)

    const state = store.getState().auth
    expect(state.token).toBe('tok123')
    expect(state.user?.username).toBe('demo')
    expect(state.status).toBe('idle')
    expect(getToken()).toBe('tok123') // persisted to storage
  })

  it('clears the token, user, and storage on logout', () => {
    const store = makeStore()
    store.dispatch(authSuccess)
    store.dispatch(logout())

    const state = store.getState().auth
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(getToken()).toBeNull()
  })
})
