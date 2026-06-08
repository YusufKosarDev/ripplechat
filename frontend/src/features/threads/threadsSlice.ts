import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { Message } from '../../api/types'

interface ThreadsState {
  openParentId: string | null
  repliesByParent: Record<string, Message[]>
}

const initialState: ThreadsState = {
  openParentId: null,
  repliesByParent: {},
}

export const fetchThread = createAsyncThunk(
  'threads/fetch',
  async ({ channelId, parentId }: { channelId: string; parentId: string }) => {
    const { data } = await client.get<Message[]>(
      `/api/channels/${channelId}/messages/${parentId}/thread`,
    )
    return { parentId, replies: data }
  },
)

const threadsSlice = createSlice({
  name: 'threads',
  initialState,
  reducers: {
    openThread(state, action: PayloadAction<string>) {
      state.openParentId = action.payload
    },
    closeThread(state) {
      state.openParentId = null
    },
    // A reply that arrived over WebSocket (deduped by id).
    threadReplyReceived(state, action: PayloadAction<Message>) {
      const reply = action.payload
      if (!reply.parentMessageId) return
      const list = state.repliesByParent[reply.parentMessageId] ?? []
      if (!list.some((m) => m.id === reply.id)) {
        state.repliesByParent[reply.parentMessageId] = [...list, reply]
      }
    },
    // A reply was edited/deleted — replace it in place.
    threadReplyUpdated(state, action: PayloadAction<Message>) {
      const updated = action.payload
      if (!updated.parentMessageId) return
      const list = state.repliesByParent[updated.parentMessageId]
      if (!list) return
      const idx = list.findIndex((m) => m.id === updated.id)
      if (idx >= 0) list[idx] = updated
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchThread.fulfilled, (state, action) => {
      state.repliesByParent[action.payload.parentId] = action.payload.replies
    })
  },
})

export const { openThread, closeThread, threadReplyReceived, threadReplyUpdated } = threadsSlice.actions
export default threadsSlice.reducer
