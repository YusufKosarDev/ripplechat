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
      return json(200, { accessToken: 'access-1', refreshToken: 'refresh-1', tokenType: 'Bearer', user: USER })
    }
    if (pathname.endsWith('/api/users/me')) return json(200, USER)
    if (pathname.endsWith('/api/channels') && method === 'GET') return json(200, [CHANNEL])
    if (pathname.includes('/members')) return json(200, [{ user: OWNER, role: 'OWNER', joinedAt: CHANNEL.createdAt }])
    if (pathname.includes('/messages')) return json(200, EMPTY_PAGE)

    // polls, presence and anything else: empty.
    return json(200, [])
  })
}
