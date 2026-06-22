import { getPendingMessages, removePendingMessage } from '../db'
import { sendChatMessage } from '../realtime/chatSocket'

let isSyncing = false

export async function syncPendingMessages() {
  if (isSyncing) return
  isSyncing = true

  try {
    const pendingMessages = await getPendingMessages()
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
