import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncPendingMessages } from './syncManager'
import { getPendingMessages, removePendingMessage } from '../db'
import { isStompConnected, sendChatMessage } from '../realtime/chatSocket'
import type { PendingMessage } from '../db'

vi.mock('../db', () => ({
  getPendingMessages: vi.fn(async () => []),
  removePendingMessage: vi.fn(async () => undefined),
}))
vi.mock('../realtime/chatSocket', () => ({
  isStompConnected: vi.fn(() => true),
  sendChatMessage: vi.fn(() => true),
}))

const queued = (tempId: string, timestamp: number, content = tempId) =>
  ({ tempId, timestamp, content, channelId: 'c1' }) as unknown as PendingMessage

describe('syncPendingMessages', () => {
  beforeEach(() => {
    vi.mocked(getPendingMessages).mockResolvedValue([])
    vi.mocked(removePendingMessage).mockClear()
    vi.mocked(sendChatMessage).mockClear().mockReturnValue(true)
    vi.mocked(isStompConnected).mockReturnValue(true)
  })

  it('replays the queue oldest-first and clears what it sent', async () => {
    vi.mocked(getPendingMessages).mockResolvedValue([queued('b', 200), queued('a', 100)])

    await syncPendingMessages()

    expect(vi.mocked(sendChatMessage).mock.calls.map((c) => c[1])).toEqual(['a', 'b'])
    expect(vi.mocked(removePendingMessage).mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
  })

  it('keeps the queue intact when the socket is not connected', async () => {
    vi.mocked(getPendingMessages).mockResolvedValue([queued('a', 100)])
    vi.mocked(isStompConnected).mockReturnValue(false)

    await syncPendingMessages()

    // The old code published into a closed socket and deleted the row anyway,
    // silently losing the message the user wrote offline.
    expect(sendChatMessage).not.toHaveBeenCalled()
    expect(removePendingMessage).not.toHaveBeenCalled()
  })

  it('stops at the first frame the socket refuses, leaving the rest queued', async () => {
    vi.mocked(getPendingMessages).mockResolvedValue([queued('a', 100), queued('b', 200)])
    vi.mocked(sendChatMessage).mockReturnValueOnce(true).mockReturnValueOnce(false)

    await syncPendingMessages()

    expect(vi.mocked(removePendingMessage).mock.calls.map((c) => c[0])).toEqual(['a'])
  })
})
