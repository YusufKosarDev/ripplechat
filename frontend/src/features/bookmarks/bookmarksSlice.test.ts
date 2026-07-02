import { describe, expect, it } from 'vitest'
import reducer, { fetchBookmarkIds, fetchBookmarks, toggleBookmark } from './bookmarksSlice'
import type { SavedMessage } from '../../api/types'

const sender = { id: 'u1', username: 'a', displayName: 'A', avatarColor: 'blue', avatarUrl: null, lastSeenAt: null }

function saved(id: string): SavedMessage {
  return { messageId: id, channelId: 'c1', channelName: 'genel', sender, content: 'x', createdAt: 't', savedAt: 't' }
}

const initial = { ids: [], items: [], status: 'idle' as const }

describe('bookmarksSlice', () => {
  it('sets the id set from fetchBookmarkIds', () => {
    const state = reducer(initial, fetchBookmarkIds.fulfilled(['m1', 'm2'], '', undefined))
    expect(state.ids).toEqual(['m1', 'm2'])
  })

  it('sets items and derives the id set from fetchBookmarks', () => {
    const state = reducer(initial, fetchBookmarks.fulfilled([saved('m1'), saved('m2')], '', undefined))
    expect(state.items).toHaveLength(2)
    expect(state.ids).toEqual(['m1', 'm2'])
    expect(state.status).toBe('ready')
  })

  it('adds an id when a message is bookmarked', () => {
    const state = reducer(initial, toggleBookmark.fulfilled({ messageId: 'm1', saved: true }, '', { messageId: 'm1', saved: false }))
    expect(state.ids).toContain('m1')
  })

  it('removes the id and the item when a bookmark is cleared', () => {
    let state = reducer(initial, fetchBookmarks.fulfilled([saved('m1'), saved('m2')], '', undefined))
    state = reducer(state, toggleBookmark.fulfilled({ messageId: 'm1', saved: false }, '', { messageId: 'm1', saved: true }))
    expect(state.ids).toEqual(['m2'])
    expect(state.items.map((i) => i.messageId)).toEqual(['m2'])
  })

  it('does not duplicate an id already present', () => {
    let state = reducer(initial, toggleBookmark.fulfilled({ messageId: 'm1', saved: true }, '', { messageId: 'm1', saved: false }))
    state = reducer(state, toggleBookmark.fulfilled({ messageId: 'm1', saved: true }, '', { messageId: 'm1', saved: false }))
    expect(state.ids).toEqual(['m1'])
  })
})
