import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import { client } from '../../api/client'
import type { Message, PageResponse } from '../../api/types'

interface MessagesState {
  byChannel: Record<string, Message[]>
  status: 'idle' | 'loading'
  // Set when the current channel's history could not be loaded (e.g. 403 not a member).
  loadError: { channelId: string; forbidden: boolean } | null
}

const initialState: MessagesState = {
  byChannel: {},
  status: 'idle',
  loadError: null,
}

export const fetchMessages = createAsyncThunk(
  'messages/fetch',
  async (channelId: string, { rejectWithValue }) => {
    try {
      const { data } = await client.get<PageResponse<Message>>(
        `/api/channels/${channelId}/messages`,
      )
      return { channelId, messages: data.content }
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      return rejectWithValue({ channelId, status })
    }
  },
)

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    // Appends a message that arrived over WebSocket (deduped by id).
    messageReceived(state, action: PayloadAction<Message>) {
      const msg = action.payload
      const list = state.byChannel[msg.channelId] ?? []
      if (!list.some((m) => m.id === msg.id)) {
        state.byChannel[msg.channelId] = [...list, msg]
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.status = 'loading'
        state.loadError = null
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.status = 'idle'
        state.byChannel[action.payload.channelId] = action.payload.messages
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.status = 'idle'
        const payload = action.payload as { channelId: string; status?: number } | undefined
        if (payload) {
          state.loadError = { channelId: payload.channelId, forbidden: payload.status === 403 }
        }
      })
  },
})

export const { messageReceived } = messagesSlice.actions
export default messagesSlice.reducer
