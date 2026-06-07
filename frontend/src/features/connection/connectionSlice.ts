import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

interface ConnectionState {
  status: ConnectionStatus
}

const initialState: ConnectionState = {
  status: 'connecting',
}

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus(state, action: PayloadAction<ConnectionStatus>) {
      state.status = action.payload
    },
  },
})

export const { setConnectionStatus } = connectionSlice.actions
export default connectionSlice.reducer
