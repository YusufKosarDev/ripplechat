import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { ReadReceipt } from '../../api/types'

interface ReadsState {
  // channelId -> userId -> ISO lastReadAt
  byChannel: Record<string, Record<string, string>>
}

const initialState: ReadsState = { byChannel: {} }

export const fetchReads = createAsyncThunk('reads/fetch', async (channelId: string) => {
  const { data } = await client.get<ReadReceipt[]>(`/api/channels/${channelId}/reads`)
  return { channelId, reads: data }
})

const readsSlice = createSlice({
  name: 'reads',
  initialState,
  reducers: {
    // Live read receipt from the WebSocket.
    readReceived(state, action: PayloadAction<ReadReceipt>) {
      const { channelId, userId, lastReadAt } = action.payload
      const map = (state.byChannel[channelId] ??= {})
      map[userId] = lastReadAt
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchReads.fulfilled, (state, action) => {
      const map: Record<string, string> = {}
      for (const r of action.payload.reads) map[r.userId] = r.lastReadAt
      state.byChannel[action.payload.channelId] = map
    })
  },
})

export const { readReceived } = readsSlice.actions
export default readsSlice.reducer
