import { describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchPolls, pollUpserted, setMyVote } from './pollsSlice'
import { client } from '../../api/client'
import type { Poll } from '../../api/types'

vi.mock('../../api/client', () => ({ client: { get: vi.fn() } }))

const poll = (over: Partial<Poll> = {}): Poll =>
  ({
    id: 'p1',
    channelId: 'c1',
    question: 'Hangi gün?',
    options: [{ id: 'o1', text: 'Salı', votes: 0 }],
    ...over,
  }) as Poll

const emptyState = { byChannel: {}, myVotes: {} }

describe('pollsSlice', () => {
  it('inserts a poll broadcast for a channel with none yet', () => {
    const state = reducer(emptyState, pollUpserted(poll()))
    expect(state.byChannel.c1.map((p) => p.id)).toEqual(['p1'])
  })

  it('replaces an existing poll in place when the vote counts change', () => {
    let state = reducer(emptyState, pollUpserted(poll()))
    state = reducer(state, pollUpserted(poll({ options: [{ id: 'o1', text: 'Salı', votes: 3 }] })))
    expect(state.byChannel.c1).toHaveLength(1)
    expect(state.byChannel.c1[0].options[0].votes).toBe(3)
  })

  it('keeps polls from different channels apart', () => {
    let state = reducer(emptyState, pollUpserted(poll()))
    state = reducer(state, pollUpserted(poll({ id: 'p2', channelId: 'c2' })))
    expect(state.byChannel.c1.map((p) => p.id)).toEqual(['p1'])
    expect(state.byChannel.c2.map((p) => p.id)).toEqual(['p2'])
  })

  it('remembers which option the current user picked', () => {
    let state = reducer(emptyState, setMyVote({ pollId: 'p1', optionId: 'o1' }))
    expect(state.myVotes).toEqual({ p1: 'o1' })
    // Changing your mind overwrites rather than accumulating.
    state = reducer(state, setMyVote({ pollId: 'p1', optionId: 'o2' }))
    expect(state.myVotes).toEqual({ p1: 'o2' })
  })

  it('replaces a channel\'s polls with the fetched list', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: [poll({ id: 'p9' })] } as never)
    const store = configureStore({ reducer: { polls: reducer } })
    store.dispatch(pollUpserted(poll()))
    await store.dispatch(fetchPolls('c1'))
    expect(store.getState().polls.byChannel.c1.map((p) => p.id)).toEqual(['p9'])
  })
})
