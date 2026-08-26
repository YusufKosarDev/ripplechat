import { describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchOnline, presenceChanged } from './presenceSlice'
import { client } from '../../api/client'
import type { PresenceEvent } from '../../api/types'

vi.mock('../../api/client', () => ({ client: { get: vi.fn() } }))

const event = (userId: string, status: PresenceEvent['status']): PresenceEvent =>
  ({ userId, status }) as PresenceEvent

const emptyState = { onlineUserIds: [] }

describe('presenceSlice', () => {
  it('marks a user online exactly once', () => {
    let state = reducer(emptyState, presenceChanged(event('u1', 'ONLINE')))
    state = reducer(state, presenceChanged(event('u1', 'ONLINE')))
    expect(state.onlineUserIds).toEqual(['u1'])
  })

  it('drops a user when they go offline', () => {
    let state = reducer(emptyState, presenceChanged(event('u1', 'ONLINE')))
    state = reducer(state, presenceChanged(event('u2', 'ONLINE')))
    state = reducer(state, presenceChanged(event('u1', 'OFFLINE')))
    expect(state.onlineUserIds).toEqual(['u2'])
  })

  it('ignores an offline event for someone who was never online', () => {
    const state = reducer(emptyState, presenceChanged(event('u9', 'OFFLINE')))
    expect(state.onlineUserIds).toEqual([])
  })

  it('replaces the roster with the fetched snapshot', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: [{ id: 'u3' }] } as never)
    const store = configureStore({ reducer: { presence: reducer } })
    store.dispatch(presenceChanged(event('u1', 'ONLINE')))
    await store.dispatch(fetchOnline())
    expect(store.getState().presence.onlineUserIds).toEqual(['u3'])
  })
})
