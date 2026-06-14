import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { UserSummary } from '../../api/types'

interface BlocksState {
  ids: string[]
}

const initialState: BlocksState = { ids: [] }

export const fetchBlocks = createAsyncThunk('blocks/fetch', async () => {
  const { data } = await client.get<UserSummary[]>('/api/users/blocks')
  return data.map((u) => u.id)
})

export const blockUser = createAsyncThunk('blocks/block', async (userId: string) => {
  await client.post(`/api/users/${userId}/block`)
  return userId
})

export const unblockUser = createAsyncThunk('blocks/unblock', async (userId: string) => {
  await client.delete(`/api/users/${userId}/block`)
  return userId
})

const blocksSlice = createSlice({
  name: 'blocks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBlocks.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.ids = action.payload
      })
      .addCase(blockUser.fulfilled, (state, action: PayloadAction<string>) => {
        if (!state.ids.includes(action.payload)) state.ids.push(action.payload)
      })
      .addCase(unblockUser.fulfilled, (state, action: PayloadAction<string>) => {
        state.ids = state.ids.filter((id) => id !== action.payload)
      })
  },
})

export default blocksSlice.reducer
