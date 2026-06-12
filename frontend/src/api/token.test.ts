import { beforeEach, describe, expect, it } from 'vitest'
import { clearToken, getToken, setToken } from './token'

describe('token storage', () => {
  beforeEach(() => localStorage.clear())

  it('set/get/clear round-trips via localStorage', () => {
    expect(getToken()).toBeNull()
    setToken('abc123')
    expect(getToken()).toBe('abc123')
    clearToken()
    expect(getToken()).toBeNull()
  })
})
