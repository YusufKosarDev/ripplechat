import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import blocksReducer from '../features/blocks/blocksSlice'
import channelOrgReducer from '../features/channelOrg/channelOrgSlice'
import channelsReducer from '../features/channels/channelsSlice'
import connectionReducer from '../features/connection/connectionSlice'
import callReducer from '../features/call/callSlice'
import e2eeReducer from '../features/e2ee/e2eeSlice'
import linkPreviewsReducer from '../features/linkPreviews/linkPreviewsSlice'
import messagesReducer from '../features/messages/messagesSlice'
import mutedReducer from '../features/muted/mutedSlice'
import pollsReducer from '../features/polls/pollsSlice'
import presenceReducer from '../features/presence/presenceSlice'
import readsReducer from '../features/reads/readsSlice'
import threadsReducer from '../features/threads/threadsSlice'
import toastReducer from '../features/toast/toastSlice'
import uiReducer from '../features/ui/uiSlice'
import unreadReducer from '../features/unread/unreadSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    blocks: blocksReducer,
    channelOrg: channelOrgReducer,
    channels: channelsReducer,
    connection: connectionReducer,
    call: callReducer,
    e2ee: e2eeReducer,
    linkPreviews: linkPreviewsReducer,
    messages: messagesReducer,
    muted: mutedReducer,
    polls: pollsReducer,
    presence: presenceReducer,
    reads: readsReducer,
    threads: threadsReducer,
    toast: toastReducer,
    ui: uiReducer,
    unread: unreadReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
