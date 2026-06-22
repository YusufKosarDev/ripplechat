import { describe, expect, it } from 'vitest'
import reducer, { setJumpTarget, setTheme, toggleTheme } from './uiSlice'

describe('uiSlice', () => {
  it('toggles the theme between dark and light', () => {
    let state = reducer({ theme: 'dark', jumpTargetId: null }, toggleTheme())
    expect(state.theme).toBe('light')
    state = reducer(state, toggleTheme())
    expect(state.theme).toBe('dark')
  })

  it('sets the theme explicitly', () => {
    const state = reducer({ theme: 'dark', jumpTargetId: null }, setTheme('light'))
    expect(state.theme).toBe('light')
  })

  it('sets and clears the jump target', () => {
    let state = reducer({ theme: 'light', jumpTargetId: null }, setJumpTarget('m1'))
    expect(state.jumpTargetId).toBe('m1')
    state = reducer(state, setJumpTarget(null))
    expect(state.jumpTargetId).toBeNull()
  })
})
