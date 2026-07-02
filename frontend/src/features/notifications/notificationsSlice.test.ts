import { describe, expect, it } from 'vitest'
import reducer, {
  fetchNotifications,
  markAllNotificationsRead,
  notificationReceived,
} from './notificationsSlice'
import type { NotificationItem } from '../../api/types'

const actor = { id: 'u2', username: 'bob', displayName: 'Bob', avatarColor: 'red', avatarUrl: null, lastSeenAt: null }

function notif(id: string, read = false): NotificationItem {
  return { id, type: 'MENTION', actor, channelId: 'c1', messageId: 'm1', preview: 'hi', read, createdAt: '2026-01-01T00:00:00Z' }
}

const initial = { items: [], unreadCount: 0, status: 'idle' as const }

describe('notificationsSlice', () => {
  it('prepends a received notification and bumps the unread count', () => {
    let state = reducer(initial, notificationReceived(notif('n1')))
    state = reducer(state, notificationReceived(notif('n2')))
    expect(state.items.map((n) => n.id)).toEqual(['n2', 'n1'])
    expect(state.unreadCount).toBe(2)
  })

  it('dedupes a notification already in the list', () => {
    let state = reducer(initial, notificationReceived(notif('n1')))
    state = reducer(state, notificationReceived(notif('n1')))
    expect(state.items).toHaveLength(1)
    expect(state.unreadCount).toBe(1)
  })

  it('does not count an already-read notification', () => {
    const state = reducer(initial, notificationReceived(notif('n1', true)))
    expect(state.unreadCount).toBe(0)
  })

  it('caps the list at 50 items', () => {
    let state = initial
    for (let i = 0; i < 60; i++) state = reducer(state, notificationReceived(notif(`n${i}`)))
    expect(state.items).toHaveLength(50)
  })

  it('replaces items and count on fetch', () => {
    const state = reducer(initial, fetchNotifications.fulfilled({ items: [notif('a')], unreadCount: 3 }, '', undefined))
    expect(state.items).toHaveLength(1)
    expect(state.unreadCount).toBe(3)
    expect(state.status).toBe('ready')
  })

  it('marks every notification read and zeroes the count', () => {
    let state = reducer(initial, notificationReceived(notif('n1')))
    state = reducer(state, markAllNotificationsRead.fulfilled(undefined, '', undefined))
    expect(state.unreadCount).toBe(0)
    expect(state.items.every((n) => n.read)).toBe(true)
  })
})
