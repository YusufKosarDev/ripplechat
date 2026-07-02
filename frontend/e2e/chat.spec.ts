import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockApi, mockChatData } from './mocks'

// Logs in with the stubbed backend and lands on the chat workspace.
async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('neo').fill('demo')
  await page.getByPlaceholder('••••••••').fill('demo1234')
  await page.getByRole('button', { name: /^Giriş yap/i }).click()
  await expect(page).toHaveURL(/\/chat$/)
}

test.describe('Chat workspace', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await mockChatData(page)
  })

  test('renders a channel feed after selecting a channel', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: /genel/i }).first().click()
    await expect(page.getByText('merhaba dünya e2e').first()).toBeVisible()
  })

  test('the notification bell opens the activity feed', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: /Bildirimler/ }).click()
    await expect(page.getByText(/senden bahsetti/i)).toBeVisible()
  })

  test('the saved-messages modal lists bookmarks', async ({ page }) => {
    await login(page)
    // The bookmark button's accessible name is its emoji; locate it by title.
    await page.getByTitle('Kaydedilen mesajlar').click()
    await expect(page.getByText('kaydedilen mesaj icerigi')).toBeVisible()
  })

  test('the discover modal lists joinable public channels', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: /Kanalları keşfet/i }).click()
    await expect(page.getByText('kesfedilecek-kanal')).toBeVisible()
  })
})
