import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { Channel } from '../../api/types'

interface ChannelsState {
  items: Channel[]
  selectedId: string | null
  status: 'idle' | 'loading'
}

const initialState: ChannelsState = {
  items: [],
  selectedId: null,
  status: 'idle',
}

export const fetchChannels = createAsyncThunk('channels/fetch', async () => {
  const { data } = await client.get<Channel[]>('/api/channels')
  return data
})

export const createChannel = createAsyncThunk(
  'channels/create',
  async (body: { name: string; description?: string; isPrivate?: boolean }) => {
    const { data } = await client.post<Channel>('/api/channels', body)
    return data
  },
)

export const joinChannel = createAsyncThunk('channels/join', async (channelId: string) => {
  await client.post(`/api/channels/${channelId}/join`)
  // Re-read the list so a newly accessible (e.g. private) channel shows up.
  const { data } = await client.get<Channel[]>('/api/channels')
  return { channelId, channels: data }
})

const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    selectChannel(state, action: PayloadAction<string>) {
      state.selectedId = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChannels.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.status = 'idle'
        state.items = action.payload
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.items.push(action.payload)
        state.selectedId = action.payload.id
      })
      .addCase(joinChannel.fulfilled, (state, action) => {
        state.items = action.payload.channels
        state.selectedId = action.payload.channelId
      })
  },
})

export const { selectChannel } = channelsSlice.actions
export default channelsSlice.reducer
