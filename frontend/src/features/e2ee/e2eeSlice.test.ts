import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { clearAllPassphrases, clearPassphrase, setPassphrase } from './e2eeSlice'

const KEY = 'ripplechat_e2ee'
const emptyState = { passphrases: {} }

describe('e2eeSlice', () => {
  beforeEach(() => {
    sessionStorage.removeItem(KEY)
  })

  it('stores a channel passphrase', () => {
    const state = reducer(emptyState, setPassphrase({ channelId: 'c1', passphrase: 'gizli' }))
    expect(state.passphrases).toEqual({ c1: 'gizli' })
  })

  it('treats an emptied passphrase as turning encryption off', () => {
    let state = reducer(emptyState, setPassphrase({ channelId: 'c1', passphrase: 'gizli' }))
    state = reducer(state, setPassphrase({ channelId: 'c1', passphrase: '' }))
    expect(state.passphrases).toEqual({})
  })

  it('clears one conversation without touching the others', () => {
    let state = reducer(emptyState, setPassphrase({ channelId: 'c1', passphrase: 'bir' }))
    state = reducer(state, setPassphrase({ channelId: 'dm-2', passphrase: 'iki' }))
    state = reducer(state, clearPassphrase('c1'))
    expect(state.passphrases).toEqual({ 'dm-2': 'iki' })
  })

  it('keeps the passphrases in sessionStorage, so they die with the session', () => {
    reducer(emptyState, setPassphrase({ channelId: 'c1', passphrase: 'gizli' }))
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({ c1: 'gizli' })
    // Never localStorage: a passphrase must not outlive the browsing session.
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('drops every passphrase from state and storage on sign-out', () => {
    let state = reducer(emptyState, setPassphrase({ channelId: 'c1', passphrase: 'bir' }))
    state = reducer(state, setPassphrase({ channelId: 'dm-2', passphrase: 'iki' }))
    state = reducer(state, clearAllPassphrases())
    expect(state.passphrases).toEqual({})
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({})
  })
})
