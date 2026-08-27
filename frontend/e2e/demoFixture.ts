import { type Page } from '@playwright/test'

/**
 * The stubbed English workspace behind the README screenshots and the demo
 * recording. Shared so the two stay in step: the GIF and the stills have to
 * show the same product, and this data is also mirrored by the backend demo
 * seed (DemoSeedService), so the hosted demo matches what the README promises.
 *
 * Distinct from e2e/mocks.ts, which is the Turkish fixture the functional
 * specs assert against.
 */
export const VIEWPORT = { width: 1440, height: 900 }

export const me = { id: 'u-me', username: 'demo', displayName: 'Demo User', avatarColor: 'indigo' }
export const elif = { id: 'u-elif', username: 'elif', displayName: 'Elif', avatarColor: 'rose' }
export const kerem = { id: 'u-kerem', username: 'kerem', displayName: 'Kerem', avatarColor: 'emerald' }

export const channels = [
  { id: 'c-genel', name: 'general', description: 'Open to everyone', isPrivate: false, createdBy: me, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'c-yazilim', name: 'engineering', description: 'Code, tooling and releases', isPrivate: false, createdBy: me, createdAt: '2026-01-01T09:00:00Z' },
]
export const dms = [{ id: 'dm-1', otherUser: { ...elif, publicKey: '{"kty":"EC","crv":"P-256"}', lastSeenAt: '2026-01-02T11:50:00Z' }, createdAt: '2026-01-02T10:00:00Z' }]

function msg(id: string, channelId: string, sender: typeof me, content: string, extras: Record<string, unknown> = {}) {
  return {
    id, content, channelId, sender,
    createdAt: '2026-01-02T12:00:00Z',
    reactions: [], parentMessageId: null, thread: { replyCount: 0, lastRepliers: [] },
    editedAt: null, deleted: false, ...extras,
  }
}

export const genelMessages = [
  msg('m6', 'c-genel', kerem, '```js\nfunction greet(name) {\n  return `Hello, ${name}!`\n}\nconsole.log(greet("RippleChat"))\n```'),
  msg('m5', 'c-genel', elif, 'Markdown works too: **bold**, *italic* and `inline code` 🙂'),
  msg('m4', 'c-genel', me, 'React with an emoji, or open a thread on any message 🧵', {
    reactions: [{ emoji: '🎉', count: 2, users: ['elif', 'kerem'] }],
    thread: { replyCount: 2, lastRepliers: [elif, kerem] },
  }),
  msg('m3', 'c-genel', kerem, 'It is realtime — messages land the moment you hit send ⚡'),
  msg('m2', 'c-genel', elif, 'Hey! We just moved the team over here 👋'),
  msg('m1', 'c-genel', me, 'Welcome to RippleChat! 🎉', { reactions: [{ emoji: '🔥', count: 1, users: ['elif'] }] }),
]
export const dmMessages = [
  msg('d4', 'dm-1', elif, 'Encrypted messages are only decrypted on our own devices 🔐'),
  msg('d3', 'dm-1', me, 'Yes — end-to-end encryption is on! 🔒'),
  msg('d2', 'dm-1', elif, 'Sure, I will take a look shortly 👀'),
  msg('d1', 'dm-1', me, 'Hi Elif, could you look over the design file?'),
]

const page0 = (content: unknown[]) => ({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1, last: true })

// Hide the connection-status banner (no WebSocket server in screenshot mode,
// so it would show "disconnected" in every shot).
export const HIDE_BANNER = 'div[role="alert"]{display:none!important}'

export async function stub(page: Page, authed = true) {
  await page.route('**/ws/**', (route) => route.abort())
  if (authed) {
    await page.addInitScript(() => localStorage.setItem('ripplechat_token', 'screenshot-token'))
  }
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (pathname.endsWith('/api/users/me')) return json({ ...me, email: 'demo@ripplechat.app', createdAt: '2026-01-01T09:00:00Z', admin: true, isTwoFactorEnabled: true })
    if (pathname.endsWith('/api/channels')) return json(channels)
    if (pathname.endsWith('/api/dm')) return json(dms)
    if (pathname.includes('/c-genel/messages')) return json(page0(genelMessages))
    if (pathname.includes('/dm-1/messages')) return json(page0(dmMessages))
    if (pathname.includes('/messages')) return json(page0([]))
    if (pathname.includes('/members')) return json([{ user: me, role: 'OWNER', joinedAt: '2026-01-01T09:00:00Z' }, { user: elif, role: 'MEMBER', joinedAt: '2026-01-01T09:00:00Z' }])
    // Admin endpoints
    if (pathname.endsWith('/api/admin/overview')) return json({ totalUsers: 1284, admins: 3, disabledUsers: 7, bots: 2, totalChannels: 42, totalMessages: 58391 })
    if (pathname.includes('/api/admin/users')) return json({
      content: [
        { id: 'u-me', username: 'demo', email: 'demo@ripplechat.app', displayName: 'Demo User', admin: true, disabled: false, deleted: false, bot: false, createdAt: '2026-01-01T09:00:00Z', lastSeenAt: '2026-07-06T12:00:00Z' },
        { id: 'u-elif', username: 'elif', email: 'elif@ripplechat.app', displayName: 'Elif', admin: false, disabled: false, deleted: false, bot: false, createdAt: '2026-01-02T10:00:00Z', lastSeenAt: '2026-07-06T11:30:00Z' },
        { id: 'u-kerem', username: 'kerem', email: 'kerem@ripplechat.app', displayName: 'Kerem', admin: true, disabled: false, deleted: false, bot: false, createdAt: '2026-01-03T08:00:00Z', lastSeenAt: '2026-07-06T10:00:00Z' },
        { id: 'u-bot', username: 'ci-bot', email: 'bot@ripplechat.app', displayName: 'CI Bot', admin: false, disabled: false, deleted: false, bot: true, createdAt: '2026-02-01T12:00:00Z', lastSeenAt: null },
        { id: 'u-blocked', username: 'spam-user', email: 'spam@ripplechat.app', displayName: 'Spam User', admin: false, disabled: true, deleted: false, bot: false, createdAt: '2026-03-15T14:00:00Z', lastSeenAt: '2026-04-01T09:00:00Z' },
      ],
    })
    if (pathname.includes('/api/admin/audit')) return json({
      content: [
        { id: 'a-1', actor: 'demo', action: 'DISABLE_USER', target: 'spam-user', details: null, createdAt: '2026-07-06T11:00:00Z' },
        { id: 'a-2', actor: 'demo', action: 'GRANT_ADMIN', target: 'kerem', details: null, createdAt: '2026-07-05T15:30:00Z' },
        { id: 'a-3', actor: 'kerem', action: 'REVOKE_ADMIN', target: 'former-admin', details: null, createdAt: '2026-07-04T09:15:00Z' },
      ],
    })
    return json([])
  })
}
