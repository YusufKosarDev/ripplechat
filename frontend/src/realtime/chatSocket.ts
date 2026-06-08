import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { config } from '../config'
import { getToken } from '../api/token'
import type { ConnectionStatus } from '../features/connection/connectionSlice'
import type {
  Message,
  MessageReactionUpdate,
  Poll,
  PresenceEvent,
  ReactionEvent,
  ThreadUpdate,
  TypingEvent,
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
type PresenceHandler = (event: PresenceEvent) => void

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
let presenceSub: StompSubscription | null = null

// Separate single subscription for the currently open thread's replies.
let threadSub: StompSubscription | null = null
let desiredThread: { channelId: string; parentId: string; onReply: ReplyHandler } | null = null

let desired: ({ channelId: string } & ChannelHandlers) | null = null
let presenceHandler: PresenceHandler | null = null
let handlers: ChatHandlers = {}
let hasConnectedBefore = false

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

function resolvePresence() {
  if (!client?.connected || !presenceHandler || presenceSub) {
    return
  }
  presenceSub = client.subscribe('/topic/presence', (frame) => {
    presenceHandler!(JSON.parse(frame.body) as PresenceEvent)
  })
}

export function connectChat(chatHandlers: ChatHandlers = {}) {
  if (client) {
    return
  }
  handlers = chatHandlers
  hasConnectedBefore = false
  const url = window.location.origin + config.wsUrl
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
      presenceSub = null
      threadSub = null
      resolvePresence()
      resolveChannelSubs()
      resolveThread()
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
    // A STOMP ERROR on a live socket means the server rejected us (e.g. the
    // JWT is invalid/expired) — treat it as an auth failure, not a retry.
    onStompError: () => {
      handlers.onAuthError?.()
    },
  })
  client.activate()
}

export function setPresenceHandler(handler: PresenceHandler) {
  presenceHandler = handler
  resolvePresence()
}

// Switches the active channel's message + typing + reaction subscriptions.
export function watchChannel(channelId: string, channelHandlers: ChannelHandlers) {
  desired = { channelId, ...channelHandlers }
  resolveChannelSubs()
}

export function sendChatMessage(channelId: string, content: string, parentMessageId?: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/send`,
    body: JSON.stringify({ content, parentMessageId }),
  })
}

export function sendEditMessage(channelId: string, messageId: string, content: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/messages/${messageId}/edit`,
    body: JSON.stringify({ content }),
  })
}

export function sendDeleteMessage(channelId: string, messageId: string) {
  client?.publish({
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

export function sendTyping(channelId: string, typing: boolean) {
  client?.publish({
    destination: `/app/channels/${channelId}/typing`,
    body: JSON.stringify({ typing }),
  })
}

export function sendReaction(channelId: string, emoji: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/reaction`,
    body: JSON.stringify({ emoji }),
  })
}

export function sendPoll(channelId: string, question: string, options: string[]) {
  client?.publish({
    destination: `/app/channels/${channelId}/poll`,
    body: JSON.stringify({ question, options }),
  })
}

export function sendPollVote(channelId: string, pollId: string, optionId: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/poll/${pollId}/vote`,
    body: JSON.stringify({ optionId }),
  })
}

export function sendMessageReaction(channelId: string, messageId: string, emoji: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/messages/${messageId}/reaction`,
    body: JSON.stringify({ emoji }),
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
  presenceSub?.unsubscribe()
  threadSub?.unsubscribe()
  messageSub = null
  typingSub = null
  reactionSub = null
  messageReactionSub = null
  messageUpdateSub = null
  threadUpdateSub = null
  channelDeletedSub = null
  pollSub = null
  presenceSub = null
  threadSub = null
  desired = null
  desiredThread = null
  presenceHandler = null
  handlers = {}
  hasConnectedBefore = false
  void client?.deactivate()
  client = null
}
