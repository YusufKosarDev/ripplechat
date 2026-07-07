import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockApi } from './mocks'

const ELIF = { id: 'u-elif', username: 'elif', displayName: 'Elif', avatarColor: 'rose' }
const DMS = [{ id: 'dm-1', group: false, name: null, otherUser: { ...ELIF, publicKey: null, lastSeenAt: null }, participants: [ELIF], createdAt: '2026-01-02T10:00:00Z' }]

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('neo').fill('demo')
  await page.getByPlaceholder('••••••••').fill('demo1234')
  await page.getByRole('button', { name: /^Giriş yap/i }).click()
  await expect(page).toHaveURL(/\/chat$/)
}

test.describe('Blocking system', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)

    // Stub DM and Block endpoints
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url())
      const method = route.request().method()
      const json = (status: number, body: unknown) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

      if (pathname.endsWith('/api/dm') && method === 'GET') {
        return json(200, DMS)
      }
      if (pathname.endsWith('/api/users/blocks') && method === 'GET') {
        return json(200, [])
      }
      if (pathname.endsWith('/block') && (method === 'POST' || method === 'DELETE')) {
        return json(200, { success: true })
      }
      return route.fallback()
    })
  })

  test('can block and unblock a user from direct message header', async ({ page }) => {
    await login(page)

    // Click on the Elif DM channel
    await page.getByRole('button', { name: /Elif/ }).first().click()

    // Verify 'Engelle' button is visible
    const blockButton = page.getByRole('button', { name: 'Engelle' })
    await expect(blockButton).toBeVisible()

    // Block user
    await blockButton.click()

    // Verify button changes to 'Engeli kaldır'
    const unblockButton = page.getByRole('button', { name: 'Engeli kaldır' })
    await expect(unblockButton).toBeVisible()

    // Unblock user
    await unblockButton.click()

    // Verify button changes back to 'Engelle'
    await expect(blockButton).toBeVisible()
  })
})
