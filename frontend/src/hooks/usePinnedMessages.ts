import { useCallback, useState } from 'react'
import { client } from '../api/client'
import type { Message } from '../api/types'

interface UsePinnedMessagesProps {
  channelId: string | null
  onError: (message: string) => void
}

/** The pinned-message drawer: its contents, its visibility, and pin/unpin. */
export function usePinnedMessages({ channelId, onError }: UsePinnedMessagesProps) {
  const [pinned, setPinned] = useState<Message[]>([])
  const [showPinned, setShowPinned] = useState(false)

  // Stable so the realtime hook can depend on it without resubscribing.
  const refreshPinned = useCallback((chanId: string) => {
    client
      .get<Message[]>(`/api/channels/${chanId}/messages/pinned`)
      .then((r) => setPinned(r.data))
      .catch(() => setPinned([]))
  }, [])

  const togglePin = async (msg: Message) => {
    if (!channelId) return
    try {
      if (msg.pinned) await client.delete(`/api/channels/${channelId}/messages/${msg.id}/pin`)
      else await client.post(`/api/channels/${channelId}/messages/${msg.id}/pin`)
      refreshPinned(channelId)
    } catch {
      onError('panel.pinFailed')
    }
  }

  return { pinned, showPinned, setShowPinned, refreshPinned, togglePin }
}
