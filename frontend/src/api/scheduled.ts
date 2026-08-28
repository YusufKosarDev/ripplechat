import { client } from './client'

export interface ScheduledMessage {
  id: string
  channelId: string
  channelName: string
  content: string
  scheduledAt: string
  /** Why the last delivery attempt failed; null while the message is just waiting. */
  failureReason: string | null
}

export async function scheduleMessage(
  channelId: string,
  content: string,
  scheduledAt: string,
): Promise<ScheduledMessage> {
  const { data } = await client.post<ScheduledMessage>(
    `/api/channels/${channelId}/messages/schedule`,
    { content, scheduledAt },
  )
  return data
}

export async function listScheduledMessages(): Promise<ScheduledMessage[]> {
  const { data } = await client.get<ScheduledMessage[]>('/api/scheduled-messages')
  return data
}

export async function cancelScheduledMessage(id: string): Promise<void> {
  await client.delete(`/api/scheduled-messages/${id}`)
}
