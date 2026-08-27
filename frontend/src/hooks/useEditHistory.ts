import { useState } from 'react'
import { client } from '../api/client'
import type { Message } from '../api/types'

export interface EditHistoryEntry {
  content: string
  editedAt: string
}

/** The "(edited)" badge's history dialog: every superseded version. */
export function useEditHistory(channelId: string | null) {
  const [history, setHistory] = useState<EditHistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const showHistory = async (msg: Message) => {
    if (!channelId) return
    setHistory(null)
    setHistoryLoading(true)
    try {
      const { data } = await client.get<EditHistoryEntry[]>(
        `/api/channels/${channelId}/messages/${msg.id}/history`,
      )
      setHistory(data)
    } catch {
      // An empty list renders as "no earlier versions" rather than an error.
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  return { history, historyLoading, showHistory, closeHistory: () => setHistory(null) }
}
