import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { getInitialTheme } from '../../theme'
import type { Theme } from '../../theme'

interface UiState {
  theme: Theme
  // Message to scroll to / highlight after navigating from search.
  jumpTargetId: string | null
}

const initialState: UiState = {
  theme: getInitialTheme(),
  jumpTargetId: null,
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
    setJumpTarget(state, action: PayloadAction<string | null>) {
      state.jumpTargetId = action.payload
    },
  },
})

export const { setTheme, toggleTheme, setJumpTarget } = uiSlice.actions
export default uiSlice.reducer
