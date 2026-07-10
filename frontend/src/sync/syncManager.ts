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
    const { sendChatMessage } = await import('../realtime/chatSocket')
    // Sadece henüz STOMP'a gitmemiş, offline'da yazılmış olanları sıralı gönder.
    const sorted = [...pendingMessages].sort((a, b) => a.timestamp - b.timestamp)

    for (const msg of sorted) {
      if (navigator.onLine) {
        // Sunucuya tekrar gönder
        sendChatMessage(
          msg.channelId,
          msg.content,
          undefined,
          msg.attachmentUrl ?? undefined,
          msg.quotedMessageId ?? undefined,
          msg.attachmentName ?? undefined,
          msg.attachmentType ?? undefined
        )
        // Gönderildi sayıp yerel IndexedDB'den sil (gerçek mesaj websocket'ten geri dönecek)
        await removePendingMessage(msg.tempId)
      } else {
        break // Hâlâ offline ise dur.
      }
    }
  } catch (err) {
    console.error('Failed to sync offline messages:', err)
  } finally {
    isSyncing = false
  }
}

// Global listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncPendingMessages)
}
