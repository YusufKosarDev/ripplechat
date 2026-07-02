import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { NotificationItem, PageResponse } from '../../api/types'

interface NotificationsState {
  items: NotificationItem[]
  unreadCount: number
  status: 'idle' | 'loading' | 'ready'
}

const initialState: NotificationsState = { items: [], unreadCount: 0, status: 'idle' }

// Fetch the activity feed (a page) plus the authoritative unread count.
export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  const [list, count] = await Promise.all([
    client.get<PageResponse<NotificationItem>>('/api/notifications', { params: { size: 30 } }),
    client.get<{ count: number }>('/api/notifications/unread-count'),
  ])
  return { items: list.data.content, unreadCount: count.data.count }
})

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async () => {
  await client.post('/api/notifications/read-all')
})

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // A live notification arrived over the user's personal STOMP topic.
    notificationReceived(state, action: PayloadAction<NotificationItem>) {
      if (state.items.some((n) => n.id === action.payload.id)) return
      state.items.unshift(action.payload)
      if (state.items.length > 50) state.items.pop()
      if (!action.payload.read) state.unreadCount += 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload.items
        state.unreadCount = action.payload.unreadCount
        state.status = 'ready'
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((n) => ({ ...n, read: true }))
        state.unreadCount = 0
      })
  },
})

export const { notificationReceived } = notificationsSlice.actions
export default notificationsSlice.reducer
