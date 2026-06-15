import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

// Per-channel E2EE passphrases, persisted locally only (never sent to the server).
const KEY = 'ripplechat_e2ee'

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

interface E2eeState {
  // channelId/dmId -> shared passphrase
  passphrases: Record<string, string>
}

const initialState: E2eeState = { passphrases: load() }

const e2eeSlice = createSlice({
  name: 'e2ee',
  initialState,
  reducers: {
    setPassphrase(state, action: PayloadAction<{ channelId: string; passphrase: string }>) {
      const { channelId, passphrase } = action.payload
      if (passphrase) state.passphrases[channelId] = passphrase
      else delete state.passphrases[channelId]
      localStorage.setItem(KEY, JSON.stringify(state.passphrases))
    },
    clearPassphrase(state, action: PayloadAction<string>) {
      delete state.passphrases[action.payload]
      localStorage.setItem(KEY, JSON.stringify(state.passphrases))
    },
  },
})

export const { setPassphrase, clearPassphrase } = e2eeSlice.actions
export default e2eeSlice.reducer
