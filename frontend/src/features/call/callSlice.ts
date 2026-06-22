import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export interface IncomingCall {
  channelId: string
  senderId: string
}

export interface ActiveCall {
  channelId: string
  peerId: string
  isIncoming: boolean
}

export interface CallState {
  incomingCall: IncomingCall | null
  activeCall: ActiveCall | null
}

const initialState: CallState = {
  incomingCall: null,
  activeCall: null,
}

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    setIncomingCall: (state, action: PayloadAction<IncomingCall | null>) => {
      state.incomingCall = action.payload
    },
    setActiveCall: (state, action: PayloadAction<ActiveCall | null>) => {
      state.activeCall = action.payload
    },
    clearCall: (state) => {
      state.incomingCall = null
      state.activeCall = null
    },
  },
})

export const { setIncomingCall, setActiveCall, clearCall } = callSlice.actions
export default callSlice.reducer
