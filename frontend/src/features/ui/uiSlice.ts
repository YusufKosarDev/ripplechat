import { createSlice } from '@reduxjs/toolkit'

// Placeholder slice so the store is valid. Real feature slices (auth, channels,
// messages, presence) will be added in later steps.
interface UiState {
  ready: boolean
}

const initialState: UiState = {
  ready: true,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {},
})

export default uiSlice.reducer
