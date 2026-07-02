import type { Page } from '@playwright/test'

/**
 * Stubs the backend so e2e tests exercise the real UI without a live server.
 * Covers the endpoints touched by the landing/login/chat flows; everything
 * else returns an empty list so slices don't error.
 */

const USER = {
  id: 'u-1',
  username: 'demo',
  email: 'demo@ripplechat.app',
  displayName: 'Demo Kullanıcı',
  avatarColor: 'indigo',
  createdAt: '2026-01-01T00:00:00Z',
}

const OWNER = { id: USER.id, username: USER.username, displayName: USER.displayName, avatarColor: USER.avatarColor }

const CHANNEL = {
  id: 'c-1',
  name: 'genel',
  description: 'Genel sohbet',
  isPrivate: false,
  createdBy: OWNER,
  createdAt: '2026-01-01T00:00:00Z',
}

const EMPTY_PAGE = { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0, last: true }

// A fully-shaped message so the channel feed renders without missing-field errors.
const MESSAGE = {
  id: 'm-1',
  content: 'merhaba dünya e2e',
  channelId: CHANNEL.id,
  sender: OWNER,
  createdAt: '2026-01-01T10:00:00Z',
  reactions: [],
  parentMessageId: null,
  thread: { replyCount: 0, lastRepliers: [] },
  editedAt: null,
  deleted: false,
  attachmentUrl: null,
  attachmentName: null,
  attachmentType: null,
  quotedMessageId: null,
  quotedSender: null,
  quotedContent: null,
  forwarded: false,
  pinned: false,
  expiresAt: null,
}
const MESSAGE_PAGE = { content: [MESSAGE], page: 0, size: 50, totalElements: 1, totalPages: 1, last: true }

const NOTIFICATION = {
  id: 'n-1',
  type: 'MENTION',
  actor: OWNER,
  channelId: CHANNEL.id,
  messageId: MESSAGE.id,
  preview: 'merhaba dünya e2e',
  read: false,
  createdAt: '2026-01-01T10:05:00Z',
}
const NOTIFICATION_PAGE = { content: [NOTIFICATION], page: 0, size: 20, totalElements: 1, totalPages: 1, last: true }

const SAVED = {
  messageId: MESSAGE.id,
  channelId: CHANNEL.id,
  channelName: CHANNEL.name,
  sender: OWNER,
  content: 'kaydedilen mesaj icerigi',
  createdAt: MESSAGE.createdAt,
  savedAt: '2026-01-01T10:06:00Z',
}

const DISCOVER_CHANNEL = {
  id: 'c-2',
  name: 'kesfedilecek-kanal',
  description: 'katilinabilir herkese acik kanal',
  isPrivate: false,
  createdBy: OWNER,
  createdAt: '2026-01-01T00:00:00Z',
}

/**
 * Layered on top of {@link mockApi}: returns sample content for the chat-surface
 * endpoints (a message in the feed, a notification, a bookmark, a discoverable
 * channel) and defers everything else back to mockApi via route.fallback().
 */
export async function mockChatData(page: Page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const method = route.request().method()
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

    if (pathname.includes('/messages') && method === 'GET') return json(MESSAGE_PAGE)
    if (pathname.endsWith('/api/notifications')) return json(NOTIFICATION_PAGE)
    if (pathname.endsWith('/api/notifications/unread-count')) return json({ count: 1 })
    if (pathname.endsWith('/api/bookmarks')) return json([SAVED])
    if (pathname.endsWith('/api/channels/discover')) return json([DISCOVER_CHANNEL])
    return route.fallback()
  })
}

export async function mockApi(page: Page, opts: { loginStatus?: number } = {}) {
  const loginStatus = opts.loginStatus ?? 200

  // No WebSocket server in e2e — let SockJS fail fast.
  await page.route('**/ws/**', (route) => route.abort())

  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const method = route.request().method()
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (pathname.endsWith('/api/auth/login') && method === 'POST') {
      if (loginStatus !== 200) {
        return json(loginStatus, {
          status: loginStatus,
          error: 'Unauthorized',
          message: 'invalid username/email or password',
          path: pathname,
        })
      }
      return json(200, { accessToken: 'access-1', refreshToken: 'refresh-1', tokenType: 'Bearer', user: USER, requires2Fa: false, preAuthToken: null })
    }
    if (pathname.endsWith('/api/users/me')) return json(200, USER)
    if (pathname.endsWith('/api/channels') && method === 'GET') return json(200, [CHANNEL])
    if (pathname.includes('/members')) return json(200, [{ user: OWNER, role: 'OWNER', joinedAt: CHANNEL.createdAt }])
    if (pathname.includes('/messages')) return json(200, EMPTY_PAGE)

    // polls, presence and anything else: empty.
    return json(200, [])
  })
}
