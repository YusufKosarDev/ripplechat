import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { clearPassphrase, setPassphrase } from './e2eeSlice'

const KEY = 'ripplechat_e2ee'
const emptyState = { passphrases: {} }

describe('e2eeSlice', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
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

  it('keeps the passphrases local — persisted only to this browser', () => {
    reducer(emptyState, setPassphrase({ channelId: 'c1', passphrase: 'gizli' }))
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ c1: 'gizli' })
  })
})
