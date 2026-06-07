import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import channelsReducer from '../features/channels/channelsSlice'
import messagesReducer from '../features/messages/messagesSlice'
import presenceReducer from '../features/presence/presenceSlice'
import uiReducer from '../features/ui/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    channels: channelsReducer,
    messages: messagesReducer,
    presence: presenceReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
