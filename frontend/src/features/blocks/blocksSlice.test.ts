import { describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { blockUser, fetchBlocks, unblockUser } from './blocksSlice'
import { client } from '../../api/client'

vi.mock('../../api/client', () => ({
  client: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

function makeStore() {
  return configureStore({ reducer: { blocks: reducer } })
}

describe('blocksSlice', () => {
  it('keeps only the ids of the blocked users it fetched', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: [{ id: 'u1' }, { id: 'u2' }] } as never)
    const store = makeStore()
    await store.dispatch(fetchBlocks())
    expect(store.getState().blocks.ids).toEqual(['u1', 'u2'])
  })

  it('adds a blocked user once, no matter how often you block them', async () => {
    vi.mocked(client.post).mockResolvedValue({} as never)
    const store = makeStore()
    await store.dispatch(blockUser('u1'))
    await store.dispatch(blockUser('u1'))
    expect(store.getState().blocks.ids).toEqual(['u1'])
  })

  it('removes the user again on unblock', async () => {
    vi.mocked(client.post).mockResolvedValue({} as never)
    vi.mocked(client.delete).mockResolvedValue({} as never)
    const store = makeStore()
    await store.dispatch(blockUser('u1'))
    await store.dispatch(blockUser('u2'))
    await store.dispatch(unblockUser('u1'))
    expect(store.getState().blocks.ids).toEqual(['u2'])
  })

  it('leaves the list alone when the block request fails', async () => {
    vi.mocked(client.post).mockRejectedValueOnce(new Error('403'))
    const store = makeStore()
    await store.dispatch(blockUser('u1'))
    expect(store.getState().blocks.ids).toEqual([])
  })
})
