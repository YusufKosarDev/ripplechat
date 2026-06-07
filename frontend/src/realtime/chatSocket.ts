import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { config } from '../config'
import { getToken } from '../api/token'
import type { Message, PresenceEvent, TypingEvent } from '../api/types'

type MessageHandler = (message: Message) => void
type TypingHandler = (event: TypingEvent) => void
type PresenceHandler = (event: PresenceEvent) => void

let client: Client | null = null
let messageSub: StompSubscription | null = null
let typingSub: StompSubscription | null = null
let presenceSub: StompSubscription | null = null

let desired: { channelId: string; onMessage: MessageHandler; onTyping: TypingHandler } | null = null
let presenceHandler: PresenceHandler | null = null

function resolveChannelSubs() {
  if (!client?.connected || !desired) {
    return
  }
  messageSub?.unsubscribe()
  typingSub?.unsubscribe()
  const { channelId, onMessage, onTyping } = desired
  messageSub = client.subscribe(`/topic/channels/${channelId}`, (frame) => {
    onMessage(JSON.parse(frame.body) as Message)
  })
  typingSub = client.subscribe(`/topic/channels/${channelId}/typing`, (frame) => {
    onTyping(JSON.parse(frame.body) as TypingEvent)
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

export function connectChat() {
  if (client) {
    return
  }
  const url = window.location.origin + config.wsUrl
  client = new Client({
    webSocketFactory: () => new SockJS(url),
    connectHeaders: { Authorization: `Bearer ${getToken() ?? ''}` },
    reconnectDelay: 5000,
    onConnect: () => {
      // Subscriptions are dropped on (re)connect; recreate them fresh.
      messageSub = null
      typingSub = null
      presenceSub = null
      resolvePresence()
      resolveChannelSubs()
    },
  })
  client.activate()
}

export function setPresenceHandler(handler: PresenceHandler) {
  presenceHandler = handler
  resolvePresence()
}

// Switches the active channel's message + typing subscriptions together.
export function watchChannel(channelId: string, onMessage: MessageHandler, onTyping: TypingHandler) {
  desired = { channelId, onMessage, onTyping }
  resolveChannelSubs()
}

export function sendChatMessage(channelId: string, content: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/send`,
    body: JSON.stringify({ content }),
  })
}

export function sendTyping(channelId: string, typing: boolean) {
  client?.publish({
    destination: `/app/channels/${channelId}/typing`,
    body: JSON.stringify({ typing }),
  })
}

export function disconnectChat() {
  messageSub?.unsubscribe()
  typingSub?.unsubscribe()
  presenceSub?.unsubscribe()
  messageSub = null
  typingSub = null
  presenceSub = null
  desired = null
  presenceHandler = null
  void client?.deactivate()
  client = null
}
