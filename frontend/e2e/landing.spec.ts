import { test, expect } from '@playwright/test'
import { mockApi } from './mocks'

test.describe('Landing page', () => {
  test('shows the hero and primary actions', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Ripple/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Demo.yu Dene/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Giriş Yap$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Kayıt Ol$/i })).toBeVisible()
  })

  test('navigates to the login page', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: /^Giriş Yap$/i }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: /Giriş yap/i })).toBeVisible()
  })

  test('the demo button signs in and opens the workspace', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: /Demo.yu Dene/i }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByText('genel').first()).toBeVisible()
  })
})
