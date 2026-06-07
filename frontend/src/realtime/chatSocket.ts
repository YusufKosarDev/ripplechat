import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { config } from '../config'
import { getToken } from '../api/token'
import type { Message } from '../api/types'

type MessageHandler = (message: Message) => void

let client: Client | null = null
let subscription: StompSubscription | null = null
let desired: { channelId: string; handler: MessageHandler } | null = null

function resolveSubscription() {
  if (!client?.connected || !desired) {
    return
  }
  subscription?.unsubscribe()
  const { channelId, handler } = desired
  subscription = client.subscribe(`/topic/channels/${channelId}`, (frame) => {
    handler(JSON.parse(frame.body) as Message)
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
    // Re-subscribe to the active channel after (re)connect.
    onConnect: () => resolveSubscription(),
  })
  client.activate()
}

// Switches the active channel subscription. Old subscription is dropped first.
export function watchChannel(channelId: string, handler: MessageHandler) {
  desired = { channelId, handler }
  resolveSubscription()
}

export function sendChatMessage(channelId: string, content: string) {
  client?.publish({
    destination: `/app/channels/${channelId}/send`,
    body: JSON.stringify({ content }),
  })
}

export function disconnectChat() {
  subscription?.unsubscribe()
  subscription = null
  desired = null
  void client?.deactivate()
  client = null
}
