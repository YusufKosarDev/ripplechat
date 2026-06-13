import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import channelsReducer from '../features/channels/channelsSlice'
import connectionReducer from '../features/connection/connectionSlice'
import messagesReducer from '../features/messages/messagesSlice'
import mutedReducer from '../features/muted/mutedSlice'
import pollsReducer from '../features/polls/pollsSlice'
import presenceReducer from '../features/presence/presenceSlice'
import readsReducer from '../features/reads/readsSlice'
import threadsReducer from '../features/threads/threadsSlice'
import uiReducer from '../features/ui/uiSlice'
import unreadReducer from '../features/unread/unreadSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    channels: channelsReducer,
    connection: connectionReducer,
    messages: messagesReducer,
    muted: mutedReducer,
    polls: pollsReducer,
    presence: presenceReducer,
    reads: readsReducer,
    threads: threadsReducer,
    ui: uiReducer,
    unread: unreadReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
