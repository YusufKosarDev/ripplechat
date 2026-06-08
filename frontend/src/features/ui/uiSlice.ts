import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { getInitialTheme } from '../../theme'
import type { Theme } from '../../theme'

interface UiState {
  theme: Theme
}

const initialState: UiState = {
  theme: getInitialTheme(),
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
    },
  },
})

export const { setTheme, toggleTheme } = uiSlice.actions
export default uiSlice.reducer
