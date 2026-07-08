import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { config } from '../config'
import { refreshSession } from '../api/client'
import { getToken } from '../api/token'
import type { ConnectionStatus } from '../features/connection/connectionSlice'
import type {
  Message,
  MessageReactionUpdate,
  NotificationItem,
  Poll,
  PresenceEvent,
  ReactionEvent,
  ReadReceipt,
  ThreadUpdate,
  TypingEvent,
  CallSignal,
} from '../api/types'

type MessageHandler = (message: Message) => void
type TypingHandler = (event: TypingEvent) => void
type ReactionHandler = (event: ReactionEvent) => void
type MessageReactionHandler = (update: MessageReactionUpdate) => void
type MessageUpdateHandler = (message: Message) => void
type ThreadUpdateHandler = (update: ThreadUpdate) => void
type ChannelDeletedHandler = () => void
type ReplyHandler = (reply: Message) => void
type PollHandler = (poll: Poll) => void
type ReadHandler = (receipt: ReadReceipt) => void
type PresenceHandler = (event: PresenceEvent) => void
type CallSignalHandler = (signal: CallSignal) => void

interface ChatHandlers {
  onStatus?: (status: ConnectionStatus) => void
  onReconnect?: () => void
  onAuthError?: () => void
}

interface ChannelHandlers {
  onMessage: MessageHandler
  onTyping: TypingHandler
  onReaction: ReactionHandler
  onMessageReaction: MessageReactionHandler
  onMessageUpdate: MessageUpdateHandler
  onThreadUpdate: ThreadUpdateHandler
  onChannelDeleted: ChannelDeletedHandler
  onPoll: PollHandler
  onRead: ReadHandler
  onCallSignal: CallSignalHandler
}

let client: Client | null = null
let messageSub: StompSubscription | null = null
let typingSub: StompSubscription | null = null
let reactionSub: StompSubscription | null = null
let messageReactionSub: StompSubscription | null = null
let messageUpdateSub: StompSubscription | null = null
let threadUpdateSub: StompSubscription | null = null
let channelDeletedSub: StompSubscription | null = null
let pollSub: StompSubscription | null = null
let readSub: StompSubscription | null = null
let presenceSub: StompSubscription | null = null
let callSignalSub: StompSubscription | null = null

// Separate single subscription for the currently open thread's replies.
let threadSub: StompSubscription | null = null
let desiredThread: { channelId: string; parentId: string; onReply: ReplyHandler } | null = null

// Lightweight message subscriptions for ALL of the user's channels (for unread
// tracking) — only the message topic, not typing/reactions/etc.
let allChannelSubs: Map<string, StompSubscription> = new Map()
let desiredAll: { channelIds: string[]; onMessage: MessageHandler } | null = null

let desired: ({ channelId: string } & ChannelHandlers) | null = null
let presenceHandler: PresenceHandler | null = null
let handlers: ChatHandlers = {}
let hasConnectedBefore = false

// The user's personal activity-notification topic (only they may subscribe).
let notificationSub: StompSubscription | null = null
let desiredNotifications: { username: string; handler: (n: NotificationItem) => void } | null = null

function resolveChannelSubs() {
  if (!client?.connected || !desired) {
    return
  }
  messageSub?.unsubscribe()
  typingSub?.unsubscribe()
  reactionSub?.unsubscribe()
  messageReactionSub?.unsubscribe()
  messageUpdateSub?.unsubscribe()
  threadUpdateSub?.unsubscribe()
  channelDeletedSub?.unsubscribe()
  pollSub?.unsubscribe()
  readSub?.unsubscribe()
  callSignalSub?.unsubscribe()
  const {
    channelId,
    onMessage,
    onTyping,
    onReaction,
    onMessageReaction,
    onMessageUpdate,
    onThreadUpdate,
    onChannelDeleted,
    onPoll,
    onRead,
    onCallSignal,
  } = desired
  messageSub = client.subscribe(`/topic/channels/${channelId}`, (frame) => {
    onMessage(JSON.parse(frame.body) as Message)
  })
  typingSub = client.subscribe(`/topic/channels/${channelId}/typing`, (frame) => {
    onTyping(JSON.parse(frame.body) as TypingEvent)
  })
  reactionSub = client.subscribe(`/topic/channels/${channelId}/reactions`, (frame) => {
    onReaction(JSON.parse(frame.body) as ReactionEvent)
  })
  messageReactionSub = client.subscribe(`/topic/channels/${channelId}/message-reactions`, (frame) => {
    onMessageReaction(JSON.parse(frame.body) as MessageReactionUpdate)
  })
  messageUpdateSub = client.subscribe(`/topic/channels/${channelId}/message-updates`, (frame) => {
    onMessageUpdate(JSON.parse(frame.body) as Message)
  })
  channelDeletedSub = client.subscribe(`/topic/channels/${channelId}/deleted`, () => {
    onChannelDeleted()
  })
  threadUpdateSub = client.subscribe(`/topic/channels/${channelId}/thread-updates`, (frame) => {
    onThreadUpdate(JSON.parse(frame.body) as ThreadUpdate)
  })
  pollSub = client.subscribe(`/topic/channels/${channelId}/polls`, (frame) => {
    onPoll(JSON.parse(frame.body) as Poll)
  })
  readSub = client.subscribe(`/topic/channels/${channelId}/reads`, (frame) => {
    onRead(JSON.parse(frame.body) as ReadReceipt)
  })
  callSignalSub = client.subscribe(`/topic/channels/${channelId}/calls`, (frame) => {
    onCallSignal(JSON.parse(frame.body) as CallSignal)
  })
}

function resolveThread() {
  if (!client?.connected || !desiredThread) {
    return
  }
  threadSub?.unsubscribe()
  const { channelId, parentId, onReply } = desiredThread
  threadSub = client.subscribe(`/topic/channels/${channelId}/thread/${parentId}`, (frame) => {
    onReply(JSON.parse(frame.body) as Message)
  })
}

function resolveAllChannels() {
  if (!client?.connected || !desiredAll) {
    return
  }
  const { channelIds, onMessage } = desiredAll
  const newIds = new Set(channelIds)

  // Unsubscribe from channels we left
  allChannelSubs.forEach((sub, id) => {
    if (!newIds.has(id)) {
      sub.unsubscribe()
      allChannelSubs.delete(id)
    }
  })

  // Subscribe to newly joined channels
  for (const id of channelIds) {
    if (!allChannelSubs.has(id)) {
      const sub = client.subscribe(`/topic/channels/${id}`, (frame) =>
        onMessage(JSON.parse(frame.body) as Message),
      )
      allChannelSubs.set(id, sub)
    }
  }
}

function resolvePresence() {
  if (!client?.connected || !presenceHandler || presenceSub) {
    return
  }
  presenceSub = client.subscribe('/topic/presence', (frame) => {
    presenceHandler!(JSON.parse(frame.body) as PresenceEvent)
  })
}

function resolveNotifications() {
  if (!client?.connected || !desiredNotifications || notificationSub) {
    return
  }
  const { username, handler } = desiredNotifications
  notificationSub = client.subscribe(`/topic/users/${username}/notifications`, (frame) => {
    handler(JSON.parse(frame.body) as NotificationItem)
  })
}

export function connectChat(chatHandlers: ChatHandlers = {}) {
  if (client) {
    return
  }
  handlers = chatHandlers
  hasConnectedBefore = false
  // Absolute URL (production: cross-origin backend) is used as-is; a relative
  // path (dev) is resolved against the current origin so the Vite proxy handles it.
  const url = /^https?:\/\//i.test(config.wsUrl) ? config.wsUrl : window.location.origin + config.wsUrl
  client = new Client({
    webSocketFactory: () => new SockJS(url),
    connectHeaders: { Authorization: `Bearer ${getToken() ?? ''}` },
    reconnectDelay: 3000,
    beforeConnect: () => {
      handlers.onStatus?.('connecting')
    },
    onConnect: () => {
      // Subscriptions are dropped on (re)connect; recreate them fresh.
      messageSub = null
      typingSub = null
      reactionSub = null
      messageReactionSub = null
      messageUpdateSub = null
      threadUpdateSub = null
      channelDeletedSub = null
      pollSub = null
      readSub = null
      presenceSub = null
      callSignalSub = null
      threadSub = null
      notificationSub = null
      allChannelSubs = new Map()
      resolvePresence()
      resolveNotifications()
      resolveChannelSubs()
      resolveThread()
      resolveAllChannels()
      handlers.onStatus?.('connected')
      if (hasConnectedBefore) {
        handlers.onReconnect?.()
      }
      hasConnectedBefore = true
    },
    onWebSocketClose: () => {
      handlers.onStatus?.('disconnected')
    },
    onWebSocketError: () => {
      handlers.onStatus?.('disconnected')
    },
    // A STOMP ERROR on a live socket means the server rejected the CONNECT —
    // most often an expired access token. Try a silent refresh and reconnect
    // with the new token; only give up (real auth failure) if refresh fails.
    onStompError: () => {
      void refreshSession().then((newToken) => {
        if (newToken && client) {
          client.connectHeaders = { Authorization: `Bearer ${newToken}` }
          // STOMP will retry per reconnectDelay using the refreshed header.
        } else {
          handlers.onAuthError?.()
        }
      })
    },
  })
  client.activate()
}

export function setPresenceHandler(handler: PresenceHandler) {
  presenceHandler = handler
  resolvePresence()
}

/** Subscribes to the current user's personal activity-notification topic. */
export function setNotificationHandler(username: string, handler: (n: NotificationItem) => void) {
  desiredNotifications = { username, handler }
  resolveNotifications()
}

// Switches the active channel's message + typing + reaction subscriptions.
export function watchChannel(channelId: string, channelHandlers: ChannelHandlers) {
  desired = { channelId, ...channelHandlers }
  resolveChannelSubs()
}

function safePublish(params: { destination: string; body: string }) {
  try {
    if (client && client.connected) {
      client.publish(params)
    } else {
      console.warn('STOMP client is not connected. Cannot publish to:', params.destination)
    }
  } catch (err) {
    console.error('Failed to publish STOMP message:', err)
  }
}

export function isStompConnected() {
  return client?.connected ?? false
}

export function sendChatMessage(
  channelId: string,
  content: string,
  parentMessageId?: string,
  attachmentUrl?: string,
  quotedMessageId?: string,
  attachmentName?: string,
  attachmentType?: string,
) {
  safePublish({
    destination: `/app/channels/${channelId}/send`,
    body: JSON.stringify({ content, parentMessageId, attachmentUrl, quotedMessageId, attachmentName, attachmentType }),
  })
}

export function sendEditMessage(channelId: string, messageId: string, content: string) {
  safePublish({
    destination: `/app/channels/${channelId}/messages/${messageId}/edit`,
    body: JSON.stringify({ content }),
  })
}

export function sendDeleteMessage(channelId: string, messageId: string) {
  safePublish({
    destination: `/app/channels/${channelId}/messages/${messageId}/delete`,
    body: JSON.stringify({}),
  })
}

// Subscribes to the replies of one open thread (only one open at a time).
export function watchThread(channelId: string, parentId: string, onReply: ReplyHandler) {
  desiredThread = { channelId, parentId, onReply }
  resolveThread()
}

export function unwatchThread() {
  threadSub?.unsubscribe()
  threadSub = null
  desiredThread = null
}

// Subscribes to the message topics of all the user's channels (unread tracking).
export function watchAllChannels(channelIds: string[], onMessage: MessageHandler) {
  desiredAll = { channelIds, onMessage }
  resolveAllChannels()
}

export function sendTyping(channelId: string, typing: boolean) {
  safePublish({
    destination: `/app/channels/${channelId}/typing`,
    body: JSON.stringify({ typing }),
  })
}

// Marks the channel read up to now (the server broadcasts the receipt).
export function sendRead(channelId: string) {
  safePublish({ destination: `/app/channels/${channelId}/read`, body: '{}' })
}

export function sendReaction(channelId: string, emoji: string) {
  safePublish({
    destination: `/app/channels/${channelId}/reaction`,
    body: JSON.stringify({ emoji }),
  })
}

export function sendPoll(channelId: string, question: string, options: string[]) {
  safePublish({
    destination: `/app/channels/${channelId}/poll`,
    body: JSON.stringify({ question, options }),
  })
}

export function sendPollVote(channelId: string, pollId: string, optionId: string) {
  safePublish({
    destination: `/app/channels/${channelId}/poll/${pollId}/vote`,
    body: JSON.stringify({ optionId }),
  })
}

export function sendMessageReaction(channelId: string, messageId: string, emoji: string) {
  safePublish({
    destination: `/app/channels/${channelId}/messages/${messageId}/reaction`,
    body: JSON.stringify({ emoji }),
  })
}

export function sendCallSignal(channelId: string, signal: CallSignal) {
  safePublish({
    destination: `/app/channels/${channelId}/call`,
    body: JSON.stringify(signal),
  })
}

export function disconnectChat() {
  messageSub?.unsubscribe()
  typingSub?.unsubscribe()
  reactionSub?.unsubscribe()
  messageReactionSub?.unsubscribe()
  messageUpdateSub?.unsubscribe()
  threadUpdateSub?.unsubscribe()
  channelDeletedSub?.unsubscribe()
  pollSub?.unsubscribe()
  readSub?.unsubscribe()
  presenceSub?.unsubscribe()
  threadSub?.unsubscribe()
  allChannelSubs.forEach((s) => s.unsubscribe())
  messageSub = null
  typingSub = null
  reactionSub = null
  messageReactionSub = null
  messageUpdateSub = null
  threadUpdateSub = null
  channelDeletedSub = null
  pollSub = null
  readSub = null
  presenceSub = null
  threadSub = null
  allChannelSubs = new Map()
  desired = null
  desiredThread = null
  desiredAll = null
  presenceHandler = null
  handlers = {}
  hasConnectedBefore = false
  void client?.deactivate()
  client = null
}

export function forceReconnectChat() {
  if (client) {
    if (!client.active) {
      void client.activate()
    } else {
      void client.deactivate().then(() => {
        void client?.activate()
      })
    }
  } else {
    connectChat(handlers)
  }
}

