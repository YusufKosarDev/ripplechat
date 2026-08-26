import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { toggleMute } from './mutedSlice'

const KEY = 'ripplechat_muted'
const emptyState = { muted: {} }

describe('mutedSlice', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
  })

  it('toggles a conversation between muted and unmuted', () => {
    let state = reducer(emptyState, toggleMute('c1'))
    expect(state.muted).toEqual({ c1: true })
    state = reducer(state, toggleMute('c1'))
    expect(state.muted).toEqual({})
  })

  it('persists the choice so it survives a reload', () => {
    reducer(emptyState, toggleMute('c1'))
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ c1: true })
  })

  it('mutes conversations independently', () => {
    let state = reducer(emptyState, toggleMute('c1'))
    state = reducer(state, toggleMute('dm-2'))
    state = reducer(state, toggleMute('c1'))
    expect(state.muted).toEqual({ 'dm-2': true })
  })
})
