import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

const KEY = 'ripplechat_unread'

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(counts: Record<string, number>): void {
  localStorage.setItem(KEY, JSON.stringify(counts))
}

interface UnreadState {
  counts: Record<string, number>
}

const initialState: UnreadState = {
  counts: load(),
}

const unreadSlice = createSlice({
  name: 'unread',
  initialState,
  reducers: {
    incrementUnread(state, action: PayloadAction<string>) {
      const id = action.payload
      state.counts[id] = (state.counts[id] ?? 0) + 1
      save(state.counts)
    },
    clearUnread(state, action: PayloadAction<string>) {
      if (state.counts[action.payload]) {
        state.counts[action.payload] = 0
        save(state.counts)
      }
    },
  },
})

export const { incrementUnread, clearUnread } = unreadSlice.actions
export default unreadSlice.reducer
