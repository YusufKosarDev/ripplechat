import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  addOptimisticMessage,
  fetchMessages,
  fetchOlderMessages,
  loadOfflineMessages,
  messageHidden,
  messageReactionsUpdated,
  messageReceived,
  messageUpdated,
  removeOptimisticMessage,
  threadSummaryUpdated,
} from './messagesSlice'
import { client } from '../../api/client'
import { getMessagesFromDB } from '../../db'
import type { Message } from '../../api/types'

vi.mock('../../api/client', () => ({ client: { get: vi.fn() } }))
vi.mock('../../db', () => ({
  getMessagesFromDB: vi.fn(async () => []),
  saveMessagesToDB: vi.fn(async () => undefined),
}))

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

  it('updates a thread summary on the parent message', () => {
    let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
    state = reducer(
      state,
      threadSummaryUpdated({
        channelId: 'c1',
        parentMessageId: 'm1',
        thread: { replyCount: 3, lastRepliers: [] },
      }),
    )
    expect(state.byChannel.c1[0].thread.replyCount).toBe(3)
  })

  it('ignores updates addressed to an unknown channel or message', () => {
    const seeded = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
    // Neither of these should throw or invent an entry.
    const other = reducer(seeded, messageUpdated(makeMessage({ id: 'm1', channelId: 'c-none' })))
    expect(other.byChannel['c-none']).toBeUndefined()
    const missing = reducer(seeded, messageUpdated(makeMessage({ id: 'm-none', content: 'x' })))
    expect(missing.byChannel.c1.map((m) => m.content)).toEqual(['hi'])
  })

  describe('optimistic messages', () => {
    it('adds an optimistic message and replaces it when the real one arrives', () => {
      const pending = makeMessage({ id: 'temp-1', content: 'merhaba', sending: true })
      let state = reducer(emptyState, addOptimisticMessage(pending))
      expect(state.byChannel.c1).toHaveLength(1)

      // Same sender and content: the server copy takes the optimistic slot
      // rather than appending a visual duplicate.
      state = reducer(state, messageReceived(makeMessage({ id: 'm-real', content: 'merhaba' })))
      expect(state.byChannel.c1).toHaveLength(1)
      expect(state.byChannel.c1[0].id).toBe('m-real')
      expect(state.byChannel.c1[0].sending).toBeUndefined()
    })

    it('matches an optimistic attachment upload by url rather than content', () => {
      const pending = makeMessage({ id: 'temp-1', content: '', sending: true, attachmentUrl: 'https://cdn/x.png' })
      let state = reducer(emptyState, addOptimisticMessage(pending))
      state = reducer(
        state,
        messageReceived(makeMessage({ id: 'm-real', content: 'caption', attachmentUrl: 'https://cdn/x.png' })),
      )
      expect(state.byChannel.c1.map((m) => m.id)).toEqual(['m-real'])
    })

    it('drops only the optimistic copy when a send times out', () => {
      let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
      state = reducer(state, addOptimisticMessage(makeMessage({ id: 'temp-1', sending: true })))
      state = reducer(state, removeOptimisticMessage({ channelId: 'c1', id: 'temp-1' }))
      expect(state.byChannel.c1.map((m) => m.id)).toEqual(['m1'])
    })

    it('keeps a confirmed message that happens to share the id', () => {
      // Guard on `!m.sending`: a confirmed message must survive the cleanup.
      let state = reducer(emptyState, messageReceived(makeMessage({ id: 'm1' })))
      state = reducer(state, removeOptimisticMessage({ channelId: 'c1', id: 'm1' }))
      expect(state.byChannel.c1).toHaveLength(1)
    })
  })

  describe('thunks', () => {
    const mockGet = vi.mocked(client.get)

    function makeStore() {
      return configureStore({ reducer: { messages: reducer } })
    }
    function page(content: Message[], last: boolean) {
      return { data: { content, last } }
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('loads the newest page in chronological order and opens paging', async () => {
      // The API returns newest-first; the slice stores oldest→newest.
      mockGet.mockResolvedValueOnce(
        page([makeMessage({ id: 'm2' }), makeMessage({ id: 'm1' })], false) as never,
      )
      const store = makeStore()
      await store.dispatch(fetchMessages('c1'))

      const state = store.getState().messages
      expect(state.byChannel.c1.map((m) => m.id)).toEqual(['m1', 'm2'])
      expect(state.paging.c1).toEqual({ nextPage: 1, hasMore: true, loadingOlder: false })
      expect(state.status).toBe('idle')
      expect(state.loadError).toBeNull()
    })

    it('flags a 403 as forbidden so the panel can show the membership notice', async () => {
      mockGet.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } })
      const store = makeStore()
      await store.dispatch(fetchMessages('c1'))

      expect(store.getState().messages.loadError).toEqual({ channelId: 'c1', forbidden: true })
    })

    it('records a non-403 failure without claiming it was a permission problem', async () => {
      mockGet.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } })
      const store = makeStore()
      await store.dispatch(fetchMessages('c1'))

      expect(store.getState().messages.loadError).toEqual({ channelId: 'c1', forbidden: false })
      expect(store.getState().messages.status).toBe('idle')
    })

    it('prepends an older page, dropping ids already on screen', async () => {
      mockGet.mockResolvedValueOnce(page([makeMessage({ id: 'm3' })], false) as never)
      const store = makeStore()
      await store.dispatch(fetchMessages('c1'))

      // m3 overlaps the page already loaded and must not be duplicated.
      mockGet.mockResolvedValueOnce(
        page([makeMessage({ id: 'm3' }), makeMessage({ id: 'm2' }), makeMessage({ id: 'm1' })], true) as never,
      )
      await store.dispatch(fetchOlderMessages({ channelId: 'c1', page: 1 }))

      const state = store.getState().messages
      expect(state.byChannel.c1.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
      expect(state.paging.c1).toEqual({ nextPage: 2, hasMore: false, loadingOlder: false })
    })

    it('clears the loadingOlder flag when an older page fails', async () => {
      mockGet.mockResolvedValueOnce(page([makeMessage({ id: 'm1' })], false) as never)
      const store = makeStore()
      await store.dispatch(fetchMessages('c1'))

      mockGet.mockRejectedValueOnce(new Error('offline'))
      await store.dispatch(fetchOlderMessages({ channelId: 'c1', page: 1 }))

      expect(store.getState().messages.paging.c1.loadingOlder).toBe(false)
    })

    it('falls back to the offline cache only while the channel is still empty', async () => {
      vi.mocked(getMessagesFromDB).mockResolvedValueOnce([makeMessage({ id: 'cached' })])
      const store = makeStore()
      await store.dispatch(loadOfflineMessages('c1'))
      expect(store.getState().messages.byChannel.c1.map((m) => m.id)).toEqual(['cached'])

      // Once the network page has landed, a late cache read must not clobber it.
      mockGet.mockResolvedValueOnce(page([makeMessage({ id: 'live' })], true) as never)
      await store.dispatch(fetchMessages('c1'))
      vi.mocked(getMessagesFromDB).mockResolvedValueOnce([makeMessage({ id: 'cached' })])
      await store.dispatch(loadOfflineMessages('c1'))

      expect(store.getState().messages.byChannel.c1.map((m) => m.id)).toEqual(['live'])
    })
  })
})
