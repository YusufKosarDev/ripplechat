import { test, expect } from '@playwright/test'
import { mockApi } from './mocks'

test.describe('Login', () => {
  test('shows a validation error when fields are empty', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')

    await page.getByRole('button', { name: /^Giriş yap/i }).click()
    await expect(page.getByText(/zorunludur/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('shows an error message when the credentials are rejected', async ({ page }) => {
    await mockApi(page, { loginStatus: 401 })
    await page.goto('/login')

    await page.getByPlaceholder('neo').fill('demo')
    await page.getByPlaceholder('••••••••').fill('wrong-password')
    await page.getByRole('button', { name: /^Giriş yap/i }).click()

    await expect(page.getByText(/invalid username\/email or password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('logs in and lands on the chat workspace', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')

    await page.getByPlaceholder('neo').fill('demo')
    await page.getByPlaceholder('••••••••').fill('demo1234')
    await page.getByRole('button', { name: /^Giriş yap/i }).click()

    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByText('genel').first()).toBeVisible()
  })
})
