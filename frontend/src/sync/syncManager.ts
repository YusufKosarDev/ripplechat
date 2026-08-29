import { getPendingMessages, removePendingMessage } from '../db'

let isSyncing = false

export async function syncPendingMessages() {
  if (isSyncing) return
  isSyncing = true

  try {
    const pendingMessages = await getPendingMessages()
    if (pendingMessages.length === 0) return

    // This module is imported from main.tsx, so a static chatSocket import
    // would drag STOMP+SockJS into the entry chunk that every landing-page
    // visitor downloads. Load the realtime layer only when there is actually
    // something to sync (by then the chat route has cached the chunk anyway).
    const { sendChatMessage, isStompConnected } = await import('../realtime/chatSocket')

    // navigator.onLine is not the condition that matters — the message travels
    // over STOMP, and the socket reconnects seconds after the network returns.
    // Replaying while it was still down published nothing and deleted the queue
    // anyway, losing the message outright.
    if (!isStompConnected()) return

    // Replay only what was written offline and never reached STOMP, in order.
    const sorted = [...pendingMessages].sort((a, b) => a.timestamp - b.timestamp)

    for (const msg of sorted) {
      const sent = sendChatMessage(
        msg.channelId,
        msg.content,
        msg.parentMessageId ?? undefined,
        msg.attachmentUrl ?? undefined,
        msg.quotedMessageId ?? undefined,
        msg.attachmentName ?? undefined,
        msg.attachmentType ?? undefined,
      )
      // Drop from IndexedDB only once the frame is actually on the wire; the
      // real message comes back over the socket. If the socket went away
      // mid-replay, the rest stays queued for the next attempt.
      if (!sent) break
      await removePendingMessage(msg.tempId)
    }
  } catch (err) {
    console.error('Failed to sync offline messages:', err)
  } finally {
    isSyncing = false
  }
}
