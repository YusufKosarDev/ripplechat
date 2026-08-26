import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { refreshSession } from '../api/client'
import {
  connectChat,
  disconnectChat,
  forceReconnectChat,
  isStompConnected,
  sendChatMessage,
  sendMessageReaction,
  sendPollVote,
  sendTyping,
  setNotificationHandler,
  setPresenceHandler,
  unwatchThread,
  watchAllChannels,
  watchChannel,
  watchThread,
} from './chatSocket'

/**
 * The realtime layer is a module-level singleton around one STOMP client, so
 * these tests drive a fake Client: activate() plays the broker's CONNECT ack,
 * emit() plays a frame arriving on a topic. disconnectChat() in afterEach
 * resets the module's own state between tests.
 */
interface FakeSub {
  destination: string
  unsubscribe: ReturnType<typeof vi.fn>
}

class FakeClient {
  static last: FakeClient | null = null

  conf: Record<string, unknown>
  connectHeaders: Record<string, string>
  connected = false
  active = false
  publish = vi.fn()
  subscriptions: FakeSub[] = []
  private callbacks = new Map<string, (frame: { body: string }) => void>()

  constructor(conf: Record<string, unknown>) {
    this.conf = conf
    this.connectHeaders = conf.connectHeaders as Record<string, string>
    FakeClient.last = this
  }

  activate = vi.fn(() => {
    this.active = true
    this.connected = true
    ;(this.conf.onConnect as () => void)?.()
  })

  deactivate = vi.fn(async () => {
    this.active = false
    this.connected = false
  })

  subscribe(destination: string, cb: (frame: { body: string }) => void): FakeSub {
    this.callbacks.set(destination, cb)
    const sub: FakeSub = { destination, unsubscribe: vi.fn() }
    this.subscriptions.push(sub)
    return sub
  }

  /** Plays a server frame on a topic the code subscribed to. */
  emit(destination: string, payload: unknown) {
    const cb = this.callbacks.get(destination)
    if (!cb) throw new Error(`nothing subscribed to ${destination}`)
    cb({ body: JSON.stringify(payload) })
  }

  destinations() {
    return this.subscriptions.map((s) => s.destination)
  }
}

vi.mock('@stomp/stompjs', () => ({
  // A plain function (not an arrow) so `new Client(...)` works; returning an
  // object from a constructor makes that object the result.
  Client: vi.fn(function (conf: Record<string, unknown>) {
    return new FakeClient(conf)
  }),
}))
vi.mock('sockjs-client', () => ({ default: vi.fn() }))
vi.mock('../api/token', () => ({ getToken: vi.fn(() => 'jwt-abc') }))
vi.mock('../api/client', () => ({ refreshSession: vi.fn(async () => null) }))

function channelHandlers(overrides: Record<string, unknown> = {}) {
  return {
    onMessage: vi.fn(),
    onTyping: vi.fn(),
    onReaction: vi.fn(),
    onMessageReaction: vi.fn(),
    onMessageUpdate: vi.fn(),
    onThreadUpdate: vi.fn(),
    onChannelDeleted: vi.fn(),
    onPoll: vi.fn(),
    onRead: vi.fn(),
    onCallSignal: vi.fn(),
    ...overrides,
  } as never
}

function fake() {
  const c = FakeClient.last
  if (!c) throw new Error('no client was constructed')
  return c
}

describe('chatSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeClient.last = null
  })

  afterEach(() => {
    disconnectChat()
  })

  describe('connection', () => {
    it('authenticates the CONNECT frame with the stored access token', () => {
      connectChat()
      expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer jwt-abc' })
      expect(fake().activate).toHaveBeenCalled()
    })

    it('resolves a relative ws path against the current origin for the dev proxy', () => {
      connectChat()
      // The factory is what the real client would call to open the socket.
      ;(fake().conf.webSocketFactory as () => unknown)()
      expect(vi.mocked(SockJS)).toHaveBeenCalledWith(`${window.location.origin}/ws`)
    })

    it('is idempotent — a second connect does not open a second socket', () => {
      connectChat()
      connectChat()
      expect(vi.mocked(Client)).toHaveBeenCalledTimes(1)
    })

    it('reports status transitions and only announces a reconnect the second time', () => {
      const onStatus = vi.fn()
      const onReconnect = vi.fn()
      connectChat({ onStatus, onReconnect })

      expect(onStatus).toHaveBeenCalledWith('connected')
      expect(onReconnect).not.toHaveBeenCalled()

      // A dropped socket, then the broker acking a fresh CONNECT.
      ;(fake().conf.onWebSocketClose as () => void)()
      expect(onStatus).toHaveBeenCalledWith('disconnected')
      ;(fake().conf.onConnect as () => void)()
      expect(onReconnect).toHaveBeenCalledTimes(1)
    })

    it('refreshes the token on a STOMP error and retries with the new one', async () => {
      vi.mocked(refreshSession).mockResolvedValueOnce('jwt-fresh')
      const onAuthError = vi.fn()
      connectChat({ onAuthError })

      await (fake().conf.onStompError as () => void)()
      await vi.waitFor(() => {
        expect(fake().connectHeaders).toEqual({ Authorization: 'Bearer jwt-fresh' })
      })
      expect(onAuthError).not.toHaveBeenCalled()
    })

    it('surfaces an auth error only once the refresh itself fails', async () => {
      vi.mocked(refreshSession).mockResolvedValueOnce(null)
      const onAuthError = vi.fn()
      connectChat({ onAuthError })

      await (fake().conf.onStompError as () => void)()
      await vi.waitFor(() => expect(onAuthError).toHaveBeenCalled())
    })
  })

  describe('channel subscriptions', () => {
    it('subscribes every channel topic once connected', () => {
      connectChat()
      watchChannel('c1', channelHandlers())

      expect(fake().destinations()).toEqual(
        expect.arrayContaining([
          '/topic/channels/c1',
          '/topic/channels/c1/typing',
          '/topic/channels/c1/reactions',
          '/topic/channels/c1/message-reactions',
          '/topic/channels/c1/deleted',
        ]),
      )
    })

    it('replays a subscription requested before the socket was up', () => {
      // watchChannel can land before CONNECT is acked; the intent is stored and
      // resolved on connect rather than dropped.
      watchChannel('c1', channelHandlers())
      connectChat()
      expect(fake().destinations()).toContain('/topic/channels/c1')
    })

    it('routes each topic to its own handler', () => {
      const h = channelHandlers() as unknown as Record<string, ReturnType<typeof vi.fn>>
      connectChat()
      watchChannel('c1', h as never)

      fake().emit('/topic/channels/c1', { id: 'm1' })
      fake().emit('/topic/channels/c1/typing', { username: 'alice', typing: true })
      fake().emit('/topic/channels/c1/reactions', { emoji: '🎉' })

      expect(h.onMessage).toHaveBeenCalledWith({ id: 'm1' })
      expect(h.onTyping).toHaveBeenCalledWith({ username: 'alice', typing: true })
      expect(h.onReaction).toHaveBeenCalledWith({ emoji: '🎉' })
    })

    it('drops the previous channel topics when switching channels', () => {
      connectChat()
      watchChannel('c1', channelHandlers())
      const firstChannelSubs = [...fake().subscriptions]

      watchChannel('c2', channelHandlers())

      expect(firstChannelSubs.every((s) => s.unsubscribe.mock.calls.length > 0)).toBe(true)
      expect(fake().destinations()).toContain('/topic/channels/c2')
    })

    it('subscribes the per-user notification and presence topics', () => {
      connectChat()
      setPresenceHandler(vi.fn())
      setNotificationHandler('alice', vi.fn())

      expect(fake().destinations()).toContain('/topic/presence')
      expect(fake().destinations()).toContain('/topic/users/alice/notifications')
    })

    it('moves the notification topic when a different user signs in', () => {
      connectChat()
      setNotificationHandler('alice', vi.fn())
      const aliceSub = fake().subscriptions.find((s) => s.destination.includes('/users/alice/'))

      const onBobNotification = vi.fn()
      setNotificationHandler('bob', onBobNotification)

      expect(aliceSub!.unsubscribe).toHaveBeenCalled()
      expect(fake().destinations()).toContain('/topic/users/bob/notifications')
      fake().emit('/topic/users/bob/notifications', { id: 'n1' })
      expect(onBobNotification).toHaveBeenCalledWith({ id: 'n1' })
    })

    it('does not carry a signed-out user\'s notification topic into the next session', () => {
      connectChat()
      setNotificationHandler('alice', vi.fn())
      disconnectChat()

      // A fresh sign-in: only the new user's topic may be subscribed.
      connectChat()
      setNotificationHandler('bob', vi.fn())
      expect(fake().destinations()).toContain('/topic/users/bob/notifications')
      expect(fake().destinations()).not.toContain('/topic/users/alice/notifications')
    })

    it('watches every channel for unread tracking, and only the message topic', () => {
      connectChat()
      const onMessage = vi.fn()
      watchAllChannels(['c1', 'c2'], onMessage)

      expect(fake().destinations()).toEqual(
        expect.arrayContaining(['/topic/channels/c1', '/topic/channels/c2']),
      )
      fake().emit('/topic/channels/c2', { id: 'm9' })
      expect(onMessage).toHaveBeenCalledWith({ id: 'm9' })
    })

    it('keeps at most one open thread subscription', () => {
      connectChat()
      const onReply = vi.fn()
      watchThread('c1', 'p1', onReply)
      const threadSub = fake().subscriptions.find((s) => s.destination.includes('/thread/'))
      expect(threadSub).toBeDefined()

      fake().emit(threadSub!.destination, { id: 'r1' })
      expect(onReply).toHaveBeenCalledWith({ id: 'r1' })

      unwatchThread()
      expect(threadSub!.unsubscribe).toHaveBeenCalled()
    })
  })

  describe('publishing', () => {
    it('publishes to the destination the server expects', () => {
      connectChat()
      sendChatMessage('c1', 'merhaba')
      sendTyping('c1', true)
      sendMessageReaction('c1', 'm1', '👍')
      sendPollVote('c1', 'p1', 'o2')

      const calls = fake().publish.mock.calls.map(([p]) => p.destination)
      expect(calls).toEqual([
        '/app/channels/c1/send',
        '/app/channels/c1/typing',
        '/app/channels/c1/messages/m1/reaction',
        '/app/channels/c1/poll/p1/vote',
      ])
      expect(JSON.parse(fake().publish.mock.calls[0][0].body).content).toBe('merhaba')
    })

    it('swallows a publish attempted while disconnected instead of throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // No connectChat(): there is no client at all.
      expect(() => sendChatMessage('c1', 'lost')).not.toThrow()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('teardown', () => {
    it('unsubscribes everything and drops the client', () => {
      connectChat()
      watchChannel('c1', channelHandlers())
      const subs = [...fake().subscriptions]
      const client = fake()

      disconnectChat()

      expect(subs.every((s) => s.unsubscribe.mock.calls.length > 0)).toBe(true)
      expect(client.deactivate).toHaveBeenCalled()
      expect(isStompConnected()).toBe(false)
    })

    it('reconnects from scratch after a disconnect', () => {
      connectChat()
      disconnectChat()
      forceReconnectChat()
      expect(vi.mocked(Client)).toHaveBeenCalledTimes(2)
      expect(isStompConnected()).toBe(true)
    })
  })
})
