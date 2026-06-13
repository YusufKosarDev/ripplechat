import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

const KEY = 'ripplechat_muted'

function load(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

interface MutedState {
  // channelId/dmId -> muted
  muted: Record<string, boolean>
}

const initialState: MutedState = { muted: load() }

const mutedSlice = createSlice({
  name: 'muted',
  initialState,
  reducers: {
    toggleMute(state, action: PayloadAction<string>) {
      const id = action.payload
      if (state.muted[id]) delete state.muted[id]
      else state.muted[id] = true
      localStorage.setItem(KEY, JSON.stringify(state.muted))
    },
  },
})

export const { toggleMute } = mutedSlice.actions
export default mutedSlice.reducer
