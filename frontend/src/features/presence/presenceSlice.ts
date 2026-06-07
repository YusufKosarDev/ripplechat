import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { PresenceEvent, UserSummary } from '../../api/types'

interface PresenceState {
  onlineUserIds: string[]
}

const initialState: PresenceState = {
  onlineUserIds: [],
}

export const fetchOnline = createAsyncThunk('presence/fetch', async () => {
  const { data } = await client.get<UserSummary[]>('/api/presence/online')
  return data.map((u) => u.id)
})

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    presenceChanged(state, action: PayloadAction<PresenceEvent>) {
      const { userId, status } = action.payload
      if (status === 'ONLINE') {
        if (!state.onlineUserIds.includes(userId)) {
          state.onlineUserIds.push(userId)
        }
      } else {
        state.onlineUserIds = state.onlineUserIds.filter((id) => id !== userId)
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchOnline.fulfilled, (state, action) => {
      state.onlineUserIds = action.payload
    })
  },
})

export const { presenceChanged } = presenceSlice.actions
export default presenceSlice.reducer
