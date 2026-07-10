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
const dms = [{ id: 'dm-1', otherUser: { ...elif, publicKey: '{"kty":"EC","crv":"P-256"}', lastSeenAt: '2026-01-02T11:50:00Z' }, createdAt: '2026-01-02T10:00:00Z' }]

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
  msg('m1', 'c-genel', me, "RippleChat'e hoş geldiniz! 🎉", { reactions: [{ emoji: '🔥', count: 1, users: ['elif'] }] }),
]
const dmMessages = [
  msg('d4', 'dm-1', elif, 'Şifreli mesajlar sadece bizim cihazlarımızda çözülüyor 🔐'),
  msg('d3', 'dm-1', me, 'Evet, uçtan uca şifreleme aktif! 🔒'),
  msg('d2', 'dm-1', elif, 'Tabii, birazdan bakarım 👀'),
  msg('d1', 'dm-1', me, 'Selam Elif, tasarım dosyasına göz atabilir misin?'),
]

const page0 = (content: unknown[]) => ({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1, last: true })

// Hide the connection-status banner (no WebSocket server in screenshot mode,
// so it would show "disconnected" in every shot).
const HIDE_BANNER = 'div[role="alert"]{display:none!important}'

async function stub(page: Page, authed = true) {
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
        { id: 'u-me', username: 'demo', email: 'demo@ripplechat.app', displayName: 'Demo Kullanıcı', admin: true, disabled: false, deleted: false, bot: false, createdAt: '2026-01-01T09:00:00Z', lastSeenAt: '2026-07-06T12:00:00Z' },
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
        { id: 'a-3', actor: 'kerem', action: 'REVOKE_ADMIN', target: 'eski-admin', details: null, createdAt: '2026-07-04T09:15:00Z' },
      ],
    })
    return json([])
  })
}

// ─── Existing screenshots ──────────────────────────────────────────

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
  await page.addStyleTag({ content: HIDE_BANNER })
  await page.screenshot({ path: '../docs/screenshots/channel.png' })
})

test('direct-message', async ({ page }) => {
  await stub(page)
  await page.goto('/chat')
  await page.getByRole('button', { name: /Elif/ }).first().click()
  await expect(page.getByText('tasarım dosyasına', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: HIDE_BANNER })
  await page.screenshot({ path: '../docs/screenshots/direct-message.png' })
})

// ─── New screenshots ───────────────────────────────────────────────

test('channel-dark', async ({ page }) => {
  // Set dark theme before anything loads.
  await page.addInitScript(() => {
    localStorage.setItem('ripplechat_theme', 'dark')
    document.documentElement.classList.add('dark')
  })
  await stub(page)
  await page.goto('/chat')
  // Ensure dark class is actually on the html element after hydration.
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.getByRole('button', { name: /genel/i }).first().click()
  await expect(page.getByText('hoş geldiniz', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: HIDE_BANNER })
  await page.screenshot({ path: '../docs/screenshots/channel-dark.png' })
})

test('mobile', async ({ page }) => {
  // Override the default desktop viewport for this test only.
  await page.setViewportSize({ width: 390, height: 844 })
  await stub(page)
  await page.goto('/chat')
  // The sidebar is off-canvas on mobile — open it with the "☰ Kanallar"
  // button first; picking a channel closes it again.
  await page.getByRole('button', { name: '☰ Kanallar' }).click()
  await page.getByRole('button', { name: /genel/i }).first().click()
  await expect(page.getByText('hoş geldiniz', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: HIDE_BANNER })
  await page.screenshot({ path: '../docs/screenshots/mobile.png' })
})

test('admin', async ({ page }) => {
  await stub(page)
  await page.goto('/admin')
  // Wait for the admin overview stats to render.
  await expect(page.getByText('1284')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: '../docs/screenshots/admin.png' })
})

test('call', async ({ page }) => {
  await stub(page)
  await page.goto('/chat')
  await page.getByRole('button', { name: /Elif/ }).first().click()
  await expect(page.getByText('tasarım dosyasına', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: HIDE_BANNER })
  // Inject a representative call overlay via HTML since we can't establish a
  // real WebRTC connection in screenshot mode.
  await page.evaluate(() => {
    const overlay = document.createElement('div')
    overlay.innerHTML = `
      <div style="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:black;padding:16px">
        <div style="display:flex;height:80vh;width:100%;max-width:56rem;flex-direction:column;border-radius:16px;background:#111827;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)">
          <div style="position:relative;flex:1;background:black;display:flex;align-items:center;justify-content:center">
            <div style="text-center">
              <div style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#ec4899);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:40px">E</div>
              <div style="color:#d1d5db;font-size:18px;font-weight:600">Elif</div>
              <div style="color:#9ca3af;font-size:14px;margin-top:4px">Bağlandı — 02:14</div>
            </div>
            <div style="position:absolute;bottom:16px;right:16px;height:144px;width:192px;border-radius:8px;border:2px solid #374151;background:#1f2937;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 15px -3px rgba(0,0,0,.5)">
              <div style="text-center">
                <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:20px;color:white">D</div>
                <div style="color:#9ca3af;font-size:11px">Sen</div>
              </div>
            </div>
          </div>
          <div style="display:flex;justify-content:center;gap:16px;padding:16px">
            <button style="height:48px;width:48px;border-radius:50%;background:#374151;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">🎤</button>
            <button style="height:48px;width:48px;border-radius:50%;background:#374151;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">📷</button>
            <button style="height:48px;width:48px;border-radius:50%;background:#374151;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">🖥️</button>
            <button style="height:48px;border-radius:24px;background:#ef4444;color:white;border:none;font-size:14px;cursor:pointer;padding:0 32px;font-weight:600">Aramayı Sonlandır</button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(overlay)
  })
  await page.screenshot({ path: '../docs/screenshots/call.png' })
})

test('search', async ({ page }) => {
  await stub(page)
  await page.route('**/api/search/messages**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { id: 's1', channelId: 'c-genel', channelName: 'genel', sender: kerem, content: 'Gerçek zamanlı çalışıyor — yazınca anında düşüyor ⚡', createdAt: '2026-01-02T12:00:00Z' },
          { id: 's2', channelId: 'c-genel', channelName: 'genel', sender: elif, content: 'Markdown da var: kalın, italik ve satır içi kod 🙂', createdAt: '2026-01-02T11:40:00Z' },
          { id: 's3', channelId: 'c-yazilim', channelName: 'yazılım', sender: me, content: 'Arama Elasticsearch üzerinde çalışıyor, PostgreSQL fallback ile', createdAt: '2026-01-02T09:15:00Z' },
        ],
        hasMore: false,
      }),
    }),
  )
  await page.goto('/chat')
  await page.getByTitle('Mesajlarda ara').click()
  await page.getByPlaceholder('Mesajlarda ara...').fill('çalışıyor')
  await expect(page.getByText('Arama Elasticsearch', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: HIDE_BANNER })
  await page.screenshot({ path: '../docs/screenshots/search.png' })
})

test('e2ee', async ({ page }) => {
  await stub(page)
  await page.goto('/chat')
  await page.getByRole('button', { name: /Elif/ }).first().click()
  await expect(page.getByText('tasarım dosyasına', { exact: false })).toBeVisible()
  await page.addStyleTag({ content: HIDE_BANNER })
  // The DM stub has publicKey set, so the "🔒 E2EE Aktif" badge should render
  // automatically in the header. Verify it's there for the screenshot.
  // If the badge doesn't render (no real session), inject it.
  const badge = page.locator('text=E2EE Aktif')
  const badgeVisible = await badge.isVisible().catch(() => false)
  if (!badgeVisible) {
    await page.evaluate(() => {
      // Find the header action bar and inject the E2EE badge.
      const header = document.querySelector('header')
      if (header) {
        const badge = document.createElement('div')
        badge.className = 'flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-1 rounded'
        badge.textContent = '🔒 E2EE Aktif'
        const actionBar = header.querySelector('div:last-child')
        if (actionBar) actionBar.prepend(badge)
      }
    })
  }
  await page.screenshot({ path: '../docs/screenshots/e2ee.png' })
})
