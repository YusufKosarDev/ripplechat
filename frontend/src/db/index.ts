import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Message, Channel } from '../api/types'

export interface PendingMessage extends Omit<Message, 'id' | 'createdAt'> {
  tempId: string
  timestamp: number
}

interface RippleChatDB extends DBSchema {
  messages: {
    key: string // messageId
    value: Message
    indexes: { 'by-channel': string }
  }
  channels: {
    key: string // channelId
    value: Channel
  }
  pending_messages: {
    key: string // tempId
    value: PendingMessage
    indexes: { 'by-channel': string }
  }
}

let dbPromise: Promise<IDBPDatabase<RippleChatDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<RippleChatDB>('ripplechat-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' })
          messageStore.createIndex('by-channel', 'channelId')
        }
        if (!db.objectStoreNames.contains('channels')) {
          db.createObjectStore('channels', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('pending_messages')) {
          const pendingStore = db.createObjectStore('pending_messages', { keyPath: 'tempId' })
          pendingStore.createIndex('by-channel', 'channelId')
        }
      },
    })
  }
  return dbPromise
}

// Helpers
export async function saveMessagesToDB(messages: Message[]) {
  const db = await getDB()
  const tx = db.transaction('messages', 'readwrite')
  await Promise.all(messages.map((m) => tx.store.put(m)))
  await tx.done
}

export async function getMessagesFromDB(channelId: string): Promise<Message[]> {
  const db = await getDB()
  const tx = db.transaction('messages', 'readonly')
  const index = tx.store.index('by-channel')
  const all = await index.getAll(channelId)
  // Sort by createdAt desc
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function addPendingMessage(msg: PendingMessage) {
  const db = await getDB()
  await db.put('pending_messages', msg)
}

export async function removePendingMessage(tempId: string) {
  const db = await getDB()
  await db.delete('pending_messages', tempId)
}

export async function getPendingMessages(): Promise<PendingMessage[]> {
  const db = await getDB()
  return await db.getAll('pending_messages')
}
