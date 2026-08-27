import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { HIDE_BANNER, VIEWPORT, stub } from './demoFixture'

/**
 * Captures the frames for the README's demo GIF, against the real production
 * build with the same stubbed workspace as the screenshots.
 *
 *   SHOTS=1 npx playwright test demo-recording && npm run gif
 *
 * Frames land in .demo-frames/ and scripts/encode-gif.mjs turns them into
 * docs/demo.gif. Playwright can record video, but only as webm, and turning
 * that into a GIF needs ffmpeg — frames plus a pure-JS encoder keeps the whole
 * pipeline reproducible with nothing to install.
 */
test.skip(!process.env.SHOTS, 'demo recording — run with SHOTS=1')

test.use({ viewport: VIEWPORT, locale: 'en-US' })

const FRAME_DIR = '.demo-frames'

/** Holds a beat on screen. The encoder plays every frame for the same delay. */
async function hold(page: Page, frames: number, counter: { n: number }) {
  for (let i = 0; i < frames; i++) {
    await page.screenshot({ path: `${FRAME_DIR}/${String(counter.n++).padStart(4, '0')}.png` })
    await page.waitForTimeout(120)
  }
}

test('demo reel', async ({ page }) => {
  rmSync(FRAME_DIR, { recursive: true, force: true })
  mkdirSync(FRAME_DIR, { recursive: true })
  const counter = { n: 0 }

  // 1. Landing page — what a recruiter actually opens first.
  await stub(page, false)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Ripple/i })).toBeVisible()
  await hold(page, 8, counter)

  // 2. Into the workspace via the one-click demo account.
  await stub(page)
  await page.goto('/chat')
  await page.addStyleTag({ content: HIDE_BANNER })
  await page.getByRole('button', { name: /general/i }).first().click()
  await expect(page.getByText('Welcome to RippleChat', { exact: false })).toBeVisible()
  await hold(page, 10, counter)

  // 3. A thread — the summary line on the message that has replies.
  await page.getByText('2 replies').first().click()
  await page.waitForTimeout(500)
  await page.addStyleTag({ content: HIDE_BANNER })
  await hold(page, 8, counter)

  // Reload rather than dismissing the panel: the beats below need the sidebar,
  // and a fresh load is a far more reliable reset than driving the UI back.
  await page.goto('/chat')
  await page.addStyleTag({ content: HIDE_BANNER })

  // 4. Search across the workspace.
  await page.getByTitle('Search messages').click()
  await page.getByPlaceholder('Search messages...').fill('realtime')
  await page.waitForTimeout(600)
  await hold(page, 8, counter)

  // 5. Dark theme — the last beat, so the GIF ends on it.
  await page.goto('/chat')
  await page.getByRole('button', { name: /general/i }).first().click()
  await expect(page.getByText('Welcome to RippleChat', { exact: false })).toBeVisible()
  await page.getByTitle('Switch to dark theme').click()
  await page.waitForTimeout(500)
  await page.addStyleTag({ content: HIDE_BANNER })
  await hold(page, 12, counter)

  expect(counter.n).toBeGreaterThan(30)
  console.log(`captured ${counter.n} frames into ${FRAME_DIR}/`)
})
