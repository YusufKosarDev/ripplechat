import { describe, expect, it } from 'vitest'
import reducer, {
  messageHidden,
  messageReactionsUpdated,
  messageReceived,
  messageUpdated,
} from './messagesSlice'
import type { Message } from '../../api/types'

function makeMessage(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'hi',
    channelId: 'c1',
    sender: { id: 'u1', username: 'alice', displayName: null, avatarColor: null, avatarUrl: null, lastSeenAt: null },
    createdAt: '2026-01-01T00:00:00Z',
    reactions: [],
    parentMessageId: null,
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

const emptyState = { byChannel: {}, paging: {}, status: 'idle' as const, loadError: null }

describe('messagesSlice', () => {
  it('appends a received message and dedupes by id', () => {
    let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
    state = reducer(state, messageReceived(makeMessage({ id: 'm1' }))) // duplicate ignored
    state = reducer(state, messageReceived(makeMessage({ id: 'm2' })))
    expect(state.byChannel.c1.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('hides a message from the local view', () => {
    let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
    state = reducer(state, messageHidden({ channelId: 'c1', messageId: 'm1' }))
    expect(state.byChannel.c1).toHaveLength(0)
  })

  it('replaces a message in place on update', () => {
    let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1', content: 'old' })))
    state = reducer(state, messageUpdated(makeMessage({ id: 'm1', content: 'edited' })))
    expect(state.byChannel.c1[0].content).toBe('edited')
  })

  it('updates a message reaction summary', () => {
    let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
    state = reducer(
      state,
      messageReactionsUpdated({
        channelId: 'c1',
        messageId: 'm1',
        reactions: [{ emoji: '👍', count: 1, users: ['bob'] }],
      }),
    )
    expect(state.byChannel.c1[0].reactions).toEqual([{ emoji: '👍', count: 1, users: ['bob'] }])
  })
})
