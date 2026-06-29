import { client } from './client'

export interface Webhook {
  id: string
  channelId: string
  name: string
  botUsername: string
  createdAt: string
  /** Full ingest path, returned only once on creation. */
  url: string | null
}

export async function createWebhook(channelId: string, name: string): Promise<Webhook> {
  const { data } = await client.post<Webhook>(`/api/channels/${channelId}/webhooks`, { name })
  return data
}

export async function listWebhooks(channelId: string): Promise<Webhook[]> {
  const { data } = await client.get<Webhook[]>(`/api/channels/${channelId}/webhooks`)
  return data
}

export async function deleteWebhook(channelId: string, id: string): Promise<void> {
  await client.delete(`/api/channels/${channelId}/webhooks/${id}`)
}
