import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChannelSocket } from './useChannelSocket'
import { watchChannel } from '../realtime/chatSocket'
import type { Message, ReactionEvent, TypingEvent } from '../api/types'

const dispatch = vi.fn()
vi.mock('../app/hooks', () => ({ useAppDispatch: () => dispatch }))
vi.mock('../realtime/chatSocket', () => ({ watchChannel: vi.fn() }))

type Handlers = Parameters<typeof watchChannel>[1]

/** The handler bundle the hook handed to the realtime layer. */
function handlers(): Handlers {
  const calls = vi.mocked(watchChannel).mock.calls
  return calls[calls.length - 1][1]
}

function message(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    content: 'hi',
    channelId: 'c1',
    sender: { id: 'u-other', username: 'alice', displayName: null, avatarColor: null, avatarUrl: null, lastSeenAt: null },
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

const typing = (over: Partial<TypingEvent> = {}): TypingEvent => ({
  userId: 'u-other',
  username: 'alice',
  displayName: 'Alice',
  typing: true,
  ...over,
})

const reaction = (over: Partial<ReactionEvent> = {}): ReactionEvent => ({
  userId: 'u-other',
  username: 'alice',
  emoji: '🎉',
  ...over,
})

function mount(props: Partial<Parameters<typeof useChannelSocket>[0]> = {}) {
  const onRefreshPinned = vi.fn()
  const view = renderHook((p: Parameters<typeof useChannelSocket>[0]) => useChannelSocket(p), {
    initialProps: {
      channelId: 'c1',
      currentUserId: 'u-me',
      blockedIds: [],
      onRefreshPinned,
      ...props,
    },
  })
  return { ...view, onRefreshPinned }
}

describe('useChannelSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('subscription', () => {
    it('watches the channel and refreshes its pins on mount', () => {
      const { onRefreshPinned } = mount()
      expect(vi.mocked(watchChannel)).toHaveBeenCalledWith('c1', expect.any(Object))
      expect(onRefreshPinned).toHaveBeenCalledWith('c1')
    })

    it('re-subscribes when the open channel changes', () => {
      const { rerender, onRefreshPinned } = mount()
      rerender({ channelId: 'c2', currentUserId: 'u-me', blockedIds: [], onRefreshPinned })
      expect(vi.mocked(watchChannel).mock.calls.map(([id]) => id)).toEqual(['c1', 'c2'])
    })

    it('does not subscribe without a channel', () => {
      mount({ channelId: '' })
      expect(vi.mocked(watchChannel)).not.toHaveBeenCalled()
    })
  })

  describe('typing indicators', () => {
    it('shows a typist and forgets them after the TTL', () => {
      const { result } = mount()
      act(() => handlers().onTyping(typing()))
      expect(result.current.typingUsers).toEqual({ 'u-other': 'Alice' })

      act(() => vi.advanceTimersByTime(4000))
      expect(result.current.typingUsers).toEqual({})
    })

    it('clears a typist immediately when they stop', () => {
      const { result } = mount()
      act(() => handlers().onTyping(typing()))
      act(() => handlers().onTyping(typing({ typing: false })))
      expect(result.current.typingUsers).toEqual({})
    })

    it('falls back to the username when no display name is set', () => {
      const { result } = mount()
      act(() => handlers().onTyping(typing({ displayName: null })))
      expect(result.current.typingUsers).toEqual({ 'u-other': 'alice' })
    })

    it('ignores your own typing and anyone you blocked', () => {
      const { result } = mount({ blockedIds: ['u-blocked'] })
      act(() => handlers().onTyping(typing({ userId: 'u-me' })))
      act(() => handlers().onTyping(typing({ userId: 'u-blocked' })))
      expect(result.current.typingUsers).toEqual({})
    })

    it('reads the latest block list rather than the one captured at subscribe time', () => {
      const onRefreshPinned = vi.fn()
      const initialProps: Parameters<typeof useChannelSocket>[0] = {
        channelId: 'c1',
        currentUserId: 'u-me',
        blockedIds: [],
        onRefreshPinned,
      }
      const { result, rerender } = renderHook(
        (p: Parameters<typeof useChannelSocket>[0]) => useChannelSocket(p),
        { initialProps },
      )
      // Blocking mid-session must take effect without re-subscribing.
      rerender({ channelId: 'c1', currentUserId: 'u-me', blockedIds: ['u-other'], onRefreshPinned })
      act(() => handlers().onTyping(typing()))
      expect(result.current.typingUsers).toEqual({})
    })
  })

  describe('flying reactions', () => {
    it('adds an emoji and retires it once its animation is over', () => {
      const { result } = mount()
      act(() => handlers().onReaction(reaction()))
      expect(result.current.flying).toHaveLength(1)
      expect(result.current.flying[0].emoji).toBe('🎉')

      // Longest possible animation (3.8s) plus the 300ms grace.
      act(() => vi.advanceTimersByTime(4200))
      expect(result.current.flying).toHaveLength(0)
    })

    it('caps the overlay so a reaction storm cannot grow unbounded', () => {
      const { result } = mount()
      act(() => {
        for (let i = 0; i < 45; i += 1) handlers().onReaction(reaction())
      })
      expect(result.current.flying).toHaveLength(40)
    })

    it('ignores reactions from a blocked user', () => {
      const { result } = mount({ blockedIds: ['u-blocked'] })
      act(() => handlers().onReaction(reaction({ userId: 'u-blocked' })))
      expect(result.current.flying).toHaveLength(0)
    })
  })

  describe('dispatching', () => {
    it('forwards an incoming message to the store', () => {
      mount()
      act(() => handlers().onMessage(message()))
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'messages/messageReceived' }),
      )
    })

    it('drops a message from a blocked sender', () => {
      mount({ blockedIds: ['u-other'] })
      act(() => handlers().onMessage(message()))
      expect(dispatch).not.toHaveBeenCalled()
    })

    it('routes an edited reply to the thread slice, not the channel timeline', () => {
      mount()
      act(() => handlers().onMessageUpdate(message({ parentMessageId: 'p1' })))
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'threads/threadReplyUpdated' }),
      )

      dispatch.mockClear()
      act(() => handlers().onMessageUpdate(message()))
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'messages/messageUpdated' }),
      )
    })

    it('raises an incoming call on OFFER and clears it on HANG_UP', () => {
      mount()
      act(() => handlers().onCallSignal({ type: 'OFFER', senderId: 'u-other', receiverId: null, payload: {} }))
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'call/setIncomingCall' }))

      dispatch.mockClear()
      act(() => handlers().onCallSignal({ type: 'HANG_UP', senderId: 'u-other', receiverId: null, payload: {} }))
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'call/clearCall' }))
    })
  })

  describe('cleanup', () => {
    it('clears both timer sets on unmount so nothing fires into a dead component', () => {
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
      const { unmount, result } = mount()

      act(() => handlers().onTyping(typing()))
      act(() => handlers().onReaction(reaction()))
      expect(result.current.flying).toHaveLength(1)

      clearSpy.mockClear()
      unmount()

      // One typing TTL timer and one flying-emoji timer.
      expect(clearSpy).toHaveBeenCalledTimes(2)

      // Advancing past both deadlines must not raise a state update on the
      // unmounted hook.
      expect(() => act(() => vi.advanceTimersByTime(10_000))).not.toThrow()
      clearSpy.mockRestore()
    })

    it('clears the previous channel timers when switching channels', () => {
      const { rerender, result, onRefreshPinned } = mount()
      act(() => handlers().onReaction(reaction()))
      expect(result.current.flying).toHaveLength(1)

      rerender({ channelId: 'c2', currentUserId: 'u-me', blockedIds: [], onRefreshPinned })
      // The overlay belongs to the channel you left.
      expect(result.current.flying).toHaveLength(0)
      expect(result.current.typingUsers).toEqual({})
    })
  })
})
