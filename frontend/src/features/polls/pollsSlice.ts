import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { Poll } from '../../api/types'

interface PollsState {
  byChannel: Record<string, Poll[]>
  myVotes: Record<string, string> // pollId -> optionId chosen by the current user
}

const initialState: PollsState = {
  byChannel: {},
  myVotes: {},
}

export const fetchPolls = createAsyncThunk('polls/fetch', async (channelId: string) => {
  const { data } = await client.get<Poll[]>(`/api/channels/${channelId}/polls`)
  return { channelId, polls: data }
})

const pollsSlice = createSlice({
  name: 'polls',
  initialState,
  reducers: {
    // Insert or replace a poll (from the WebSocket broadcast).
    pollUpserted(state, action: PayloadAction<Poll>) {
      const poll = action.payload
      const list = state.byChannel[poll.channelId] ?? []
      const idx = list.findIndex((p) => p.id === poll.id)
      if (idx >= 0) {
        list[idx] = poll
        state.byChannel[poll.channelId] = list
      } else {
        state.byChannel[poll.channelId] = [...list, poll]
      }
    },
    setMyVote(state, action: PayloadAction<{ pollId: string; optionId: string }>) {
      state.myVotes[action.payload.pollId] = action.payload.optionId
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchPolls.fulfilled, (state, action) => {
      state.byChannel[action.payload.channelId] = action.payload.polls
    })
  },
})

export const { pollUpserted, setMyVote } = pollsSlice.actions
export default pollsSlice.reducer
