import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastState {
  toasts: Toast[]
}

const initialState: ToastState = { toasts: [] }

let nextId = 0

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload)
      },
      prepare(payload: { message: string; variant?: ToastVariant }) {
        return {
          payload: {
            id: String(nextId++),
            message: payload.message,
            variant: payload.variant ?? 'info',
          } satisfies Toast,
        }
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
  },
})

export const { showToast, dismissToast } = toastSlice.actions
export default toastSlice.reducer
