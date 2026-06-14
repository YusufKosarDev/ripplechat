import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { LinkPreview } from '../../api/types'

interface Entry {
  status: 'loading' | 'done'
  data: LinkPreview | null
}

interface LinkPreviewsState {
  byUrl: Record<string, Entry>
}

const initialState: LinkPreviewsState = { byUrl: {} }

export const fetchLinkPreview = createAsyncThunk('linkPreviews/fetch', async (url: string) => {
  const res = await client.get<LinkPreview>('/api/link-preview', { params: { url } })
  return { url, data: res.status === 204 ? null : res.data }
})

const linkPreviewsSlice = createSlice({
  name: 'linkPreviews',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLinkPreview.pending, (state, action) => {
        state.byUrl[action.meta.arg] = { status: 'loading', data: null }
      })
      .addCase(fetchLinkPreview.fulfilled, (state, action) => {
        state.byUrl[action.payload.url] = { status: 'done', data: action.payload.data }
      })
      .addCase(fetchLinkPreview.rejected, (state, action) => {
        state.byUrl[action.meta.arg] = { status: 'done', data: null }
      })
  },
})

export default linkPreviewsSlice.reducer
