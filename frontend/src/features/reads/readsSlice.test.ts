import { describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchReads, readReceived } from './readsSlice'
import { client } from '../../api/client'
import type { ReadReceipt } from '../../api/types'

vi.mock('../../api/client', () => ({ client: { get: vi.fn() } }))

const receipt = (userId: string, lastReadAt: string): ReadReceipt =>
  ({ channelId: 'c1', userId, lastReadAt }) as ReadReceipt

const emptyState = { byChannel: {} }

describe('readsSlice', () => {
  it('records a live receipt for a channel it has never seen', () => {
    const state = reducer(emptyState, readReceived(receipt('u1', '2026-01-01T10:00:00Z')))
    expect(state.byChannel.c1).toEqual({ u1: '2026-01-01T10:00:00Z' })
  })

  it('advances a reader without disturbing the others', () => {
    let state = reducer(emptyState, readReceived(receipt('u1', '2026-01-01T10:00:00Z')))
    state = reducer(state, readReceived(receipt('u2', '2026-01-01T10:05:00Z')))
    state = reducer(state, readReceived(receipt('u1', '2026-01-01T11:00:00Z')))
    expect(state.byChannel.c1).toEqual({
      u1: '2026-01-01T11:00:00Z',
      u2: '2026-01-01T10:05:00Z',
    })
  })

  it('replaces a channel\'s receipts with the fetched snapshot', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({
      data: [receipt('u2', '2026-01-02T09:00:00Z')],
    } as never)
    const store = configureStore({ reducer: { reads: reducer } })
    store.dispatch(readReceived(receipt('u1', '2026-01-01T10:00:00Z')))
    await store.dispatch(fetchReads('c1'))
    expect(store.getState().reads.byChannel.c1).toEqual({ u2: '2026-01-02T09:00:00Z' })
  })
})
