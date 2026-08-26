import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { setCategory, toggleArchive } from './channelOrgSlice'

const KEY = 'ripplechat_channel_org'
const emptyState = { category: {}, archived: {} }

describe('channelOrgSlice', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
  })

  it('files a channel under a category', () => {
    const state = reducer(emptyState, setCategory({ channelId: 'c1', name: 'Takım' }))
    expect(state.category).toEqual({ c1: 'Takım' })
  })

  it('clears the category when the name is emptied rather than storing a blank', () => {
    let state = reducer(emptyState, setCategory({ channelId: 'c1', name: 'Takım' }))
    state = reducer(state, setCategory({ channelId: 'c1', name: '' }))
    expect(state.category).toEqual({})
  })

  it('toggles the archived flag', () => {
    let state = reducer(emptyState, toggleArchive('c1'))
    expect(state.archived).toEqual({ c1: true })
    state = reducer(state, toggleArchive('c1'))
    expect(state.archived).toEqual({})
  })

  it('persists both halves together', () => {
    const withCategory = reducer(emptyState, setCategory({ channelId: 'c1', name: 'Takım' }))
    reducer(withCategory, toggleArchive('c2'))
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      category: { c1: 'Takım' },
      archived: { c2: true },
    })
  })
})
