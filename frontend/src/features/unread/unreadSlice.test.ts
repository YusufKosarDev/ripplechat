import { beforeEach, describe, expect, it } from 'vitest'
import reducer, { addMention, clearUnread, incrementUnread } from './unreadSlice'

const empty = { counts: {}, mentions: {} }

describe('unreadSlice', () => {
  beforeEach(() => localStorage.clear())

  it('increments the unread count per channel', () => {
    let state = reducer(empty, incrementUnread('c1'))
    state = reducer(state, incrementUnread('c1'))
    state = reducer(state, incrementUnread('c2'))
    expect(state.counts).toEqual({ c1: 2, c2: 1 })
  })

  it('marks a mention and clears it on read', () => {
    let state = reducer(empty, addMention('c1'))
    expect(state.mentions.c1).toBe(true)
    state = reducer(state, clearUnread('c1'))
    expect(state.mentions.c1).toBeUndefined()
  })

  it('resets the count to zero on clear', () => {
    let state = reducer(empty, incrementUnread('c1'))
    state = reducer(state, clearUnread('c1'))
    expect(state.counts.c1).toBe(0)
  })
})
