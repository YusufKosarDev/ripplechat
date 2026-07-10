import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockApi, mockChatData } from './mocks'

// UI-level flows that need no realtime backend: theme and language toggles
// (the i18n switch must actually re-render the chat surface) and the pin
// round-trip over REST. Message edit/delete travel over STOMP, which the e2e
// harness deliberately aborts, so those stay covered by unit tests.

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('neo').fill('demo')
  await page.getByPlaceholder('••••••••').fill('demo1234')
  await page.getByRole('button', { name: /^Giriş yap/i }).click()
  await expect(page).toHaveURL(/\/chat$/)
}

test.describe('UI flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await mockChatData(page)
  })

  test('the language toggle switches the whole chat surface to English', async ({ page }) => {
    // Pick English on the landing page before signing in; the choice must
    // persist into the chat via localStorage.
    await page.goto('/')
    // The toggle's accessible name is its aria-label, not the visible "EN".
    await page.getByRole('button', { name: 'Dili değiştir' }).click()
    await expect(page.getByText('Real-time chat platform')).toBeVisible()

    await page.getByRole('button', { name: 'Log in' }).click()
    await page.getByPlaceholder('neo').fill('demo')
    await page.getByPlaceholder('••••••••').fill('demo1234')
    await page.getByRole('button', { name: /^Log in/i }).click()
    await expect(page).toHaveURL(/\/chat$/)

    await page.getByRole('button', { name: /genel/i }).first().click()
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gönder' })).toHaveCount(0)
  })

  test('the theme toggle flips dark mode on the html element', async ({ page }) => {
    await login(page)
    const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))
    const before = await isDark()
    await page.getByRole('button', { name: /temaya geç/ }).click()
    expect(await isDark()).toBe(!before)
    await page.getByRole('button', { name: /temaya geç/ }).click()
    expect(await isDark()).toBe(before)
  })

  test('pinning a message via the hover actions surfaces the pinned drawer', async ({ page }) => {
    let pinned = false
    await page.route('**/api/channels/*/messages/*/pin', (route) => {
      pinned = route.request().method() === 'POST'
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.route('**/api/channels/*/messages/pinned', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          pinned
            ? [{
                id: 'm-1',
                content: 'merhaba dünya e2e',
                channelId: 'c-1',
                sender: { id: 'u-1', username: 'demo', displayName: 'Demo Kullanıcı', avatarColor: 'indigo' },
                createdAt: '2026-01-01T10:00:00Z',
                reactions: [], parentMessageId: null, thread: { replyCount: 0, lastRepliers: [] },
                editedAt: null, deleted: false, pinned: true, forwarded: false,
                attachmentUrl: null, attachmentName: null, attachmentType: null,
                quotedMessageId: null, quotedSender: null, quotedContent: null, expiresAt: null,
              }]
            : [],
        ),
      }),
    )

    await login(page)
    await page.getByRole('button', { name: /genel/i }).first().click()
    const message = page.getByText('merhaba dünya e2e').first()
    await expect(message).toBeVisible()

    await message.hover()
    await page.getByRole('button', { name: 'Sabitle' }).click()

    // The header now shows the pinned counter; opening it lists the message.
    const pinnedButton = page.getByRole('button', { name: '📌 1' })
    await expect(pinnedButton).toBeVisible()
    await pinnedButton.click()
    await expect(page.getByText('Sabitlenenler')).toBeVisible()
  })
})
