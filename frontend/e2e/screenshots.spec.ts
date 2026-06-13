import { test, expect, type Page } from '@playwright/test'

/**
 * Generates the README screenshots from the real, built UI with representative
 * stubbed data. Skipped in CI (and normal runs); generate on demand with:
 *
 *   SHOTS=1 npx playwright test screenshots
 *
 * Output: ../docs/screenshots/*.png
 */
test.skip(!process.env.SHOTS, 'screenshot generation — run with SHOTS=1')

test.use({ viewport: { width: 1440, height: 900 } })

const me = { id: 'u-me', username: 'demo', displayName: 'Demo Kullanıcı', avatarColor: 'indigo' }
const elif = { id: 'u-elif', username: 'elif', displayName: 'Elif', avatarColor: 'rose' }
const kerem = { id: 'u-kerem', username: 'kerem', displayName: 'Kerem', avatarColor: 'emerald' }

const channels = [
  { id: 'c-genel', name: 'genel', description: 'Herkese açık genel sohbet', isPrivate: false, createdBy: me, createdAt: '2026-01-01T09:00:00Z' },
  { id: 'c-yazilim', name: 'yazılım', description: 'Kod, araçlar ve geliştirme', isPrivate: false, createdBy: me, createdAt: '2026-01-01T09:00:00Z' },
]
const dms = [{ id: 'dm-1', otherUser: elif, createdAt: '2026-01-02T10:00:00Z' }]

function msg(id: string, channelId: string, sender: typeof me, content: string, extras: Record<string, unknown> = {}) {
  return {
    id, content, channelId, sender,
    createdAt: '2026-01-02T12:00:00Z',
    reactions: [], parentMessageId: null, thread: { replyCount: 0, lastRepliers: [] },
    editedAt: null, deleted: false, ...extras,
  }
}

const genelMessages = [
  msg('m6', 'c-genel', kerem, '```js\nfunction selamla(ad) {\n  return `Merhaba, ${ad}!`\n}\nconsole.log(selamla("RippleChat"))\n```'),
  msg('m5', 'c-genel', elif, 'Markdown da var: **kalın**, *italik* ve `satır içi kod` 🙂'),
  msg('m4', 'c-genel', me, 'Bir mesaja emoji ile tepki verebilir, thread açabilirsiniz 🧵', {
    reactions: [{ emoji: '🎉', count: 2, users: ['elif', 'kerem'] }],
    thread: { replyCount: 2, lastRepliers: [elif, kerem] },
  }),
  msg('m3', 'c-genel', kerem, 'Gerçek zamanlı çalışıyor — yazınca anında düşüyor ⚡'),
  msg('m2', 'c-genel', elif, 'Selam! Buraya yeni taşındık 👋'),
  msg('m1', 'c-genel', me, 'RippleChat’e hoş geldiniz! 🎉', { reactions: [{ emoji: '🔥', count: 1, users: ['elif'] }] }),
]
const dmMessages = [
  msg('d2', 'dm-1', elif, 'Tabii, birazdan bakarım 👀'),
  msg('d1', 'dm-1', me, 'Selam Elif, tasarım dosyasına göz atabilir misin?'),
]

const page0 = (content: unknown[]) => ({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1, last: true })

async function stub(page: Page, authed = true) {
  await page.route('**/ws/**', (route) => route.abort())
  if (authed) {
    await page.addInitScript(() => localStorage.setItem('ripplechat_token', 'screenshot-token'))
  }
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (pathname.endsWith('/api/users/me')) return json({ ...me, email: 'demo@ripplechat.app', createdAt: '2026-01-01T09:00:00Z' })
    if (pathname.endsWith('/api/channels')) return json(channels)
    if (pathname.endsWith('/api/dm')) return json(dms)
    if (pathname.includes('/c-genel/messages')) return json(page0(genelMessages))
    if (pathname.includes('/dm-1/messages')) return json(page0(dmMessages))
    if (pathname.includes('/messages')) return json(page0([]))
    if (pathname.includes('/members')) return json([{ user: me, role: 'OWNER', joinedAt: '2026-01-01T09:00:00Z' }, { user: elif, role: 'MEMBER', joinedAt: '2026-01-01T09:00:00Z' }])
    return json([])
  })
}

test('landing', async ({ page }) => {
  await stub(page, false)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Ripple/i })).toBeVisible()
  await page.screenshot({ path: '../docs/screenshots/landing.png' })
})

test('channel', async ({ page }) => {
  await stub(page)
  await page.goto('/chat')
  await page.getByRole('button', { name: /genel/i }).first().click()
  await expect(page.getByText('hoş geldiniz', { exact: false })).toBeVisible()
  // Hide the "reconnecting" banner (no WebSocket server in screenshot mode).
  await page.addStyleTag({ content: 'div[class*="bg-amber-500"]{display:none!important}' })
  await page.screenshot({ path: '../docs/screenshots/channel.png' })
})

test('direct-message', async ({ page }) => {
  await stub(page)
  await page.goto('/chat')
  await page.getByRole('button', { name: /Elif/ }).first().click()
  await expect(page.getByText('tasarım dosyasına', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: 'div[class*="bg-amber-500"]{display:none!important}' })
  await page.screenshot({ path: '../docs/screenshots/direct-message.png' })
})
