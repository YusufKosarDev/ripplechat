import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi, mockChatData } from './mocks'

// Automated accessibility checks (axe) that lock in the manual a11y work and
// catch regressions. Scoped to critical/serious WCAG 2 A/AA violations.
async function seriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

test.describe('Accessibility', () => {
  test('landing page has no critical/serious violations', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Ripple/i })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('login page has no critical/serious violations', async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Giriş yap/i })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  test('register page has no critical/serious violations', async ({ page }) => {
    await mockApi(page)
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /Hesap oluştur/i })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })

  // The three pages above are the ones a visitor sees before signing in. The
  // workspace is the actual product and had no automated a11y coverage at all,
  // which is where the interesting widgets live -- the message list, the
  // composer, the sidebar and the dialogs.
  test('the chat workspace has no critical/serious violations', async ({ page }) => {
    await mockApi(page)
    await mockChatData(page)
    // /chat is behind auth, so sign in through the stubbed backend first.
    await page.goto('/login')
    await page.getByPlaceholder('neo').fill('demo')
    await page.getByPlaceholder('••••••••').fill('demo1234')
    await page.getByRole('button', { name: /^Giriş yap/i }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await page.getByRole('button', { name: /genel/i }).first().click()
    await expect(page.getByText('merhaba dünya e2e').first()).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
  })
})
