import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'
import { client } from '../../api/client'
import type { Message, PageResponse, ReactionSummary, ThreadSummary } from '../../api/types'

const PAGE_SIZE = 50

interface Paging {
  nextPage: number
  hasMore: boolean
  loadingOlder: boolean
}

interface MessagesState {
  byChannel: Record<string, Message[]>
  // Pagination cursor per channel for "load older" (scroll-up) history.
  paging: Record<string, Paging>
  status: 'idle' | 'loading'
  // Set when the current channel's history could not be loaded (e.g. 403 not a member).
  loadError: { channelId: string; forbidden: boolean } | null
}

const initialState: MessagesState = {
  byChannel: {},
  paging: {},
  status: 'idle',
  loadError: null,
}

// Newest-first page from the API, reversed to chronological (oldest→newest) order.
async function fetchPage(channelId: string, page: number) {
  const { data } = await client.get<PageResponse<Message>>(`/api/channels/${channelId}/messages`, {
    params: { page, size: PAGE_SIZE, sort: 'createdAt,desc' },
  })
  return { messages: [...data.content].reverse(), last: data.last }
}

// Initial load: the most recent page of messages.
export const fetchMessages = createAsyncThunk(
  'messages/fetch',
  async (channelId: string, { rejectWithValue }) => {
    try {
      const { messages, last } = await fetchPage(channelId, 0)
      return { channelId, messages, last }
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      return rejectWithValue({ channelId, status })
    }
  },
)

// Scroll-up: an older page, prepended to the existing history.
export const fetchOlderMessages = createAsyncThunk(
  'messages/fetchOlder',
  async ({ channelId, page }: { channelId: string; page: number }) => {
    const { messages, last } = await fetchPage(channelId, page)
    return { channelId, older: messages, last, page }
  },
)

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    // Appends a message that arrived over WebSocket (deduped by id or merging optimistic ones).
    messageReceived(state, action: PayloadAction<Message>) {
      const msg = action.payload
      const list = state.byChannel[msg.channelId] ?? []
      const optIdx = list.findIndex(
        (m) =>
          m.sending &&
          m.sender.id === msg.sender.id &&
          (m.content === msg.content || (msg.attachmentUrl !== null && m.attachmentUrl === msg.attachmentUrl))
      )
      if (optIdx >= 0) {
        list[optIdx] = msg
      } else {
        if (!list.some((m) => m.id === msg.id)) {
          state.byChannel[msg.channelId] = [...list, msg]
        }
      }
    },
    // Adds a temporary local message before server confirmation.
    addOptimisticMessage(state, action: PayloadAction<Message>) {
      const msg = action.payload
      const list = state.byChannel[msg.channelId] ?? []
      state.byChannel[msg.channelId] = [...list, msg]
    },
    // Discards a temporary local message if it times out without server confirmation.
    removeOptimisticMessage(state, action: PayloadAction<{ channelId: string; id: string }>) {
      const { channelId, id } = action.payload
      const list = state.byChannel[channelId]
      if (list) {
        state.byChannel[channelId] = list.filter((m) => m.id !== id || !m.sending)
      }
    },
    // Updates one message's reaction summary (from the WebSocket broadcast).
    messageReactionsUpdated(
      state,
      action: PayloadAction<{ channelId: string; messageId: string; reactions: ReactionSummary[] }>,
    ) {
      const { channelId, messageId, reactions } = action.payload
      const msg = state.byChannel[channelId]?.find((m) => m.id === messageId)
      if (msg) {
        msg.reactions = reactions
      }
    },
    // Removes a message from the local view ("delete for me").
    messageHidden(state, action: PayloadAction<{ channelId: string; messageId: string }>) {
      const list = state.byChannel[action.payload.channelId]
      if (list) {
        state.byChannel[action.payload.channelId] = list.filter((m) => m.id !== action.payload.messageId)
      }
    },
    // Replaces a top-level message in place (edit/delete broadcast).
    messageUpdated(state, action: PayloadAction<Message>) {
      const updated = action.payload
      const list = state.byChannel[updated.channelId]
      if (!list) return
      const idx = list.findIndex((m) => m.id === updated.id)
      if (idx >= 0) list[idx] = updated
    },
    // Updates a top-level message's thread summary (from the WebSocket broadcast).
    threadSummaryUpdated(
      state,
      action: PayloadAction<{ channelId: string; parentMessageId: string; thread: ThreadSummary }>,
    ) {
      const { channelId, parentMessageId, thread } = action.payload
      const msg = state.byChannel[channelId]?.find((m) => m.id === parentMessageId)
      if (msg) {
        msg.thread = thread
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
        const { channelId, messages, last } = action.payload
        state.status = 'idle'
        state.byChannel[channelId] = messages
        state.paging[channelId] = { nextPage: 1, hasMore: !last, loadingOlder: false }
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.status = 'idle'
        const payload = action.payload as { channelId: string; status?: number } | undefined
        if (payload) {
          state.loadError = { channelId: payload.channelId, forbidden: payload.status === 403 }
        }
      })
      .addCase(fetchOlderMessages.pending, (state, action) => {
        const paging = state.paging[action.meta.arg.channelId]
        if (paging) paging.loadingOlder = true
      })
      .addCase(fetchOlderMessages.fulfilled, (state, action) => {
        const { channelId, older, last, page } = action.payload
        const existing = state.byChannel[channelId] ?? []
        const seen = new Set(existing.map((m) => m.id))
        const fresh = older.filter((m) => !seen.has(m.id))
        state.byChannel[channelId] = [...fresh, ...existing]
        state.paging[channelId] = { nextPage: page + 1, hasMore: !last, loadingOlder: false }
      })
      .addCase(fetchOlderMessages.rejected, (state, action) => {
        const paging = state.paging[action.meta.arg.channelId]
        if (paging) paging.loadingOlder = false
      })
  },
})

export const {
  messageReceived,
  messageHidden,
  messageUpdated,
  messageReactionsUpdated,
  threadSummaryUpdated,
  addOptimisticMessage,
  removeOptimisticMessage,
} = messagesSlice.actions
export default messagesSlice.reducer
