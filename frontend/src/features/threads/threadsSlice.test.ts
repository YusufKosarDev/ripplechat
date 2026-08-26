import { describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  closeThread,
  fetchThread,
  openThread,
  threadReplyReceived,
  threadReplyUpdated,
} from './threadsSlice'
import { client } from '../../api/client'
import type { Message } from '../../api/types'

vi.mock('../../api/client', () => ({ client: { get: vi.fn() } }))

function reply(over: Partial<Message> = {}): Message {
  return {
    id: 'r1',
    content: 'reply',
    channelId: 'c1',
    sender: { id: 'u1', username: 'alice', displayName: null, avatarColor: null, avatarUrl: null, lastSeenAt: null },
    createdAt: '2026-01-01T00:00:00Z',
    reactions: [],
    parentMessageId: 'p1',
    thread: { replyCount: 0, lastRepliers: [] },
    editedAt: null,
    deleted: false,
    attachmentUrl: null,
    attachmentName: null,
    attachmentType: null,
    quotedMessageId: null,
    quotedSender: null,
    quotedContent: null,
    forwarded: false,
    pinned: false,
    expiresAt: null,
    ...over,
  }
}

const emptyState = { openParentId: null, repliesByParent: {} }

describe('threadsSlice', () => {
  it('opens and closes the thread panel', () => {
    let state = reducer(emptyState, openThread('p1'))
    expect(state.openParentId).toBe('p1')
    state = reducer(state, closeThread())
    expect(state.openParentId).toBeNull()
  })

  it('appends a live reply and dedupes by id', () => {
    let state = reducer(emptyState, threadReplyReceived(reply({ id: 'r1' })))
    state = reducer(state, threadReplyReceived(reply({ id: 'r1' })))
    state = reducer(state, threadReplyReceived(reply({ id: 'r2' })))
    expect(state.repliesByParent.p1.map((m) => m.id)).toEqual(['r1', 'r2'])
  })

  it('ignores a message that is not a reply', () => {
    // A top-level message belongs to the channel timeline, not a thread.
    const state = reducer(emptyState, threadReplyReceived(reply({ parentMessageId: null })))
    expect(state.repliesByParent).toEqual({})
  })

  it('replaces an edited reply in place', () => {
    let state = reducer(emptyState, threadReplyReceived(reply({ id: 'r1', content: 'old' })))
    state = reducer(state, threadReplyUpdated(reply({ id: 'r1', content: 'edited' })))
    expect(state.repliesByParent.p1[0].content).toBe('edited')
  })

  it('ignores an update for a thread that was never loaded', () => {
    const state = reducer(emptyState, threadReplyUpdated(reply({ parentMessageId: 'p-unknown' })))
    expect(state.repliesByParent).toEqual({})
  })

  it('stores the fetched replies under their parent', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: [reply({ id: 'r1' })] } as never)
    const store = configureStore({ reducer: { threads: reducer } })
    await store.dispatch(fetchThread({ channelId: 'c1', parentId: 'p1' }))
    expect(store.getState().threads.repliesByParent.p1.map((m) => m.id)).toEqual(['r1'])
  })
})
