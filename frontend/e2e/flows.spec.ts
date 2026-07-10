import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockApi, mockChatData } from './mocks'

// Deeper feature flows on top of the stubbed backend: 2FA login, message
// search and scheduled messages. Routes registered after mockApi/mockChatData
// take precedence (Playwright matches the most recently registered first).

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('neo').fill('demo')
  await page.getByPlaceholder('••••••••').fill('demo1234')
  await page.getByRole('button', { name: /^Giriş yap/i }).click()
  await expect(page).toHaveURL(/\/chat$/)
}

test.describe('2FA login', () => {
  test('a 2FA-protected account asks for the code, then signs in', async ({ page }) => {
    await mockApi(page)
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: null,
          refreshToken: null,
          tokenType: 'Bearer',
          user: null,
          requires2Fa: true,
          preAuthToken: 'pre-auth-1',
        }),
      }),
    )
    await page.route('**/api/auth/2fa/verify', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'access-2fa',
          refreshToken: 'refresh-2fa',
          tokenType: 'Bearer',
          user: {
            id: 'u-1',
            username: 'demo',
            email: 'demo@ripplechat.app',
            displayName: 'Demo Kullanıcı',
            avatarColor: 'indigo',
            createdAt: '2026-01-01T00:00:00Z',
          },
          requires2Fa: false,
          preAuthToken: null,
        }),
      }),
    )

    await page.goto('/login')
    await page.getByPlaceholder('neo').fill('demo')
    await page.getByPlaceholder('••••••••').fill('demo1234')
    await page.getByRole('button', { name: /^Giriş yap/i }).click()

    // The password step is accepted but the account needs a TOTP code.
    const codeInput = page.getByPlaceholder('123456')
    await expect(codeInput).toBeVisible()
    await codeInput.fill('654321')
    await page.getByRole('button', { name: /^Giriş yap/i }).click()

    await expect(page).toHaveURL(/\/chat$/)
  })
})

test.describe('Search and scheduled messages', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await mockChatData(page)
  })

  test('message search shows results from the search endpoint', async ({ page }) => {
    await page.route('**/api/search/messages**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 'm-search-1',
              channelId: 'c-1',
              channelName: 'genel',
              sender: { id: 'u-1', username: 'demo', displayName: 'Demo Kullanıcı', avatarColor: 'indigo' },
              content: 'bulunan e2e sonucu',
              createdAt: '2026-01-01T10:00:00Z',
            },
          ],
          hasMore: false,
        }),
      }),
    )

    await login(page)
    await page.getByTitle('Mesajlarda ara').click()
    await page.getByPlaceholder('Mesajlarda ara...').fill('aranan')
    await expect(page.getByText('bulunan e2e sonucu')).toBeVisible()
  })

  test('the scheduled-messages modal lists pending messages', async ({ page }) => {
    await page.route('**/api/scheduled-messages', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'sm-1',
            channelId: 'c-1',
            channelName: 'genel',
            content: 'zamanlanmis mesaj e2e',
            scheduledAt: '2027-01-01T09:00:00Z',
          },
        ]),
      }),
    )

    await login(page)
    await page.getByRole('button', { name: /genel/i }).first().click()
    await page.getByRole('button', { name: 'Zamanlanmış mesajlar' }).click()
    await expect(page.getByText('zamanlanmis mesaj e2e')).toBeVisible()
    await expect(page.getByRole('button', { name: 'İptal' })).toBeVisible()
  })
})
