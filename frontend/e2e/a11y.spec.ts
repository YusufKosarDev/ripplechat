import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './mocks'

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
})
