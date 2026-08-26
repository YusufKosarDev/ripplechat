import { useEffect, useState } from 'react'
import { client } from '../api/client'

/**
 * The Claude channel summary. `aiEnabled` reflects whether the server has an
 * API key configured at all — the button stays hidden when it does not.
 */
export function useChannelSummary(channelId: string | null) {
  const [aiEnabled, setAiEnabled] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  useEffect(() => {
    client
      .get<{ enabled: boolean }>('/api/ai/status')
      .then(({ data }) => setAiEnabled(data.enabled))
      .catch(() => setAiEnabled(false))
  }, [])

  const summarize = async (fallbackMessage: string) => {
    if (!channelId) return
    setSummarizing(true)
    setSummary(null)
    try {
      const { data } = await client.post<{ summary: string }>(`/api/ai/channels/${channelId}/summary`)
      setSummary(data.summary)
    } catch {
      setSummary(fallbackMessage)
    } finally {
      setSummarizing(false)
    }
  }

  return { aiEnabled, summary, setSummary, summarizing, summarize }
}
