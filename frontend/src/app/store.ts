import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import channelsReducer from '../features/channels/channelsSlice'
import messagesReducer from '../features/messages/messagesSlice'
import uiReducer from '../features/ui/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    channels: channelsReducer,
    messages: messagesReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
