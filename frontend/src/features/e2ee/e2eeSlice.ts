import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

// Per-channel E2EE passphrases, held locally only (never sent to the server).
//
// sessionStorage, not localStorage: the passphrase is the root of trust for a
// passphrase-encrypted conversation, so it must not outlive the browsing
// session on a shared machine. It is also cleared explicitly on sign-out (see
// clearLocalUserData in ../../db).
const KEY = 'ripplechat_e2ee'

function load(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

function persist(passphrases: Record<string, string>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(passphrases))
  } catch {
    // Storage can be unavailable (private mode); the in-memory state still works.
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
      persist(state.passphrases)
    },
    clearPassphrase(state, action: PayloadAction<string>) {
      delete state.passphrases[action.payload]
      persist(state.passphrases)
    },
    /** Drops every passphrase from memory and storage (sign-out). */
    clearAllPassphrases(state) {
      state.passphrases = {}
      persist(state.passphrases)
    },
  },
})

export const { setPassphrase, clearPassphrase, clearAllPassphrases } = e2eeSlice.actions
export default e2eeSlice.reducer
