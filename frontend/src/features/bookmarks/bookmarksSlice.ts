import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { SavedMessage } from '../../api/types'

interface BookmarksState {
  ids: string[] // bookmarked message ids (for the save-toggle state in the feed)
  items: SavedMessage[] // the full saved list (loaded when the panel opens)
  status: 'idle' | 'loading' | 'ready'
}

const initialState: BookmarksState = { ids: [], items: [], status: 'idle' }

export const fetchBookmarkIds = createAsyncThunk('bookmarks/fetchIds', async () => {
  const { data } = await client.get<string[]>('/api/bookmarks/ids')
  return data
})

export const fetchBookmarks = createAsyncThunk('bookmarks/fetchList', async () => {
  const { data } = await client.get<SavedMessage[]>('/api/bookmarks')
  return data
})

// `saved` is the current state; the thunk flips it.
export const toggleBookmark = createAsyncThunk(
  'bookmarks/toggle',
  async ({ messageId, saved }: { messageId: string; saved: boolean }) => {
    if (saved) {
      await client.delete(`/api/bookmarks/${messageId}`)
    } else {
      await client.post(`/api/bookmarks/${messageId}`)
    }
    return { messageId, saved: !saved }
  },
)

const bookmarksSlice = createSlice({
  name: 'bookmarks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookmarkIds.fulfilled, (state, action) => {
        state.ids = action.payload
      })
      .addCase(fetchBookmarks.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        state.items = action.payload
        state.ids = action.payload.map((s) => s.messageId)
        state.status = 'ready'
      })
      .addCase(toggleBookmark.fulfilled, (state, action) => {
        const { messageId, saved } = action.payload
        if (saved) {
          if (!state.ids.includes(messageId)) state.ids.push(messageId)
        } else {
          state.ids = state.ids.filter((id) => id !== messageId)
          state.items = state.items.filter((i) => i.messageId !== messageId)
        }
      })
  },
})

export default bookmarksSlice.reducer
