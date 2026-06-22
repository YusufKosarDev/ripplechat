import { describe, expect, it } from 'vitest'
import reducer, { dismissToast, showToast } from './toastSlice'

describe('toastSlice', () => {
  it('adds a toast with a generated id and defaults to info', () => {
    const state = reducer({ toasts: [] }, showToast({ message: 'hi' }))
    expect(state.toasts).toHaveLength(1)
    expect(state.toasts[0].message).toBe('hi')
    expect(state.toasts[0].variant).toBe('info')
    expect(state.toasts[0].id).toBeTruthy()
  })

  it('keeps the requested variant', () => {
    const state = reducer({ toasts: [] }, showToast({ message: 'oops', variant: 'error' }))
    expect(state.toasts[0].variant).toBe('error')
  })

  it('dismisses a toast by id', () => {
    let state = reducer({ toasts: [] }, showToast({ message: 'a' }))
    const id = state.toasts[0].id
    state = reducer(state, dismissToast(id))
    expect(state.toasts).toHaveLength(0)
  })
})
