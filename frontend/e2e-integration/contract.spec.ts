import { expect, test } from '@playwright/test'
import { api, createChannel, PASSWORD, register, sendMessage, signIn, uniqueUsername } from './api'

/**
 * The frontend↔backend contract: does the client render what the server
 * actually sends? The mocked suite cannot answer this — its fixtures are shaped
 * by hand, so a DTO could change without a single test noticing.
 */
test.describe('Frontend and backend agree', () => {
  test('register and sign in through the real API, landing on a working workspace', async ({ page }) => {
    const username = uniqueUsername('reg')

    await page.goto('/register')
    // exact: true — the placeholders are 'neo', 'neo@ripplechat.io' and 'Neo',
    // and a substring match would hit all three.
    await page.getByPlaceholder('neo', { exact: true }).fill(username)
    await page.getByPlaceholder('neo@ripplechat.io').fill(`${username}@e2e.test`)
    await page.getByPlaceholder('en az 8 karakter').fill(PASSWORD)
    await page.getByRole('button', { name: /^Kayıt ol$/i }).click()

    await page.waitForURL('**/chat')
    // Reaching the workspace means /api/users/me deserialised into the User the
    // client expects — the route guard renders nothing without it.
    await expect(page.getByText(username, { exact: false }).first()).toBeVisible()
  })

  test('a message sent over the socket renders from the server payload', async ({ page }) => {
    const owner = await register('snd')
    const channelName = `kanal-${Date.now().toString(36)}`
    const channelId = await createChannel(owner, channelName, false)
    await signIn(page, owner)

    await page.getByText(channelName).first().click()
    const composer = page.locator('.ProseMirror').last()
    await composer.waitFor({ state: 'visible' })
    await composer.click()

    const text = `merhaba ${Date.now().toString(36)}`
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')

    await expect(page.getByText(text)).toBeVisible()

    // Reload and re-open the channel: what comes back is the server's copy, not
    // the optimistic one the composer drew. That it is there at all also proves
    // the send had committed before it was broadcast. (The selected channel is
    // not persisted across a reload, hence the second click.)
    await page.reload()
    await page.getByText(channelName).first().click()
    await expect(page.getByText(text)).toBeVisible()

    const { body } = await api.get<{ content: Array<{ content: string }> }>(
      `/api/channels/${channelId}/messages?page=0&size=50`,
      owner.accessToken,
    )
    expect(body.content.some((m) => m.content === text)).toBe(true)
  })

  test('the demo account lands on its seeded workspace', async ({ page }) => {
    // app.demo.seed is on by default, so this doubles as a check that the seeder
    // still produces what the README promises.
    await page.goto('/login')
    await page.getByPlaceholder('neo').fill('demo')
    await page.getByPlaceholder('••••••••').fill('demo1234')
    await page.getByRole('button', { name: /^Giriş yap/i }).click()

    await page.waitForURL('**/chat')
    await expect(page.getByText('general').first()).toBeVisible()
  })

  test('the offline queue survives a blip and is delivered on reconnect', async ({ page, context }) => {
    // The regression this covers: the replay used to be triggered only by a
    // connection-status change, which a short outage does not produce — SockJS
    // only notices a dead socket at its heartbeat — so the message sat in
    // IndexedDB indefinitely. No unit test can reach it: the bug is in which
    // signal fires the replay.
    const owner = await register('off')
    const channelName = `cevrimdisi-${Date.now().toString(36)}`
    const channelId = await createChannel(owner, channelName, false)
    await sendMessage(owner, channelId, 'seed')
    await signIn(page, owner)

    await page.getByText(channelName).first().click()
    const composer = page.locator('.ProseMirror').last()
    await composer.waitFor({ state: 'visible' })

    // Focus while still online: going offline re-renders the composer, and
    // clicking into an element that is being replaced is how this test failed in
    // CI — "element is not stable", then detached mid-click. focus() only waits
    // for attachment, so it survives the re-render that follows.
    await composer.click()
    await context.setOffline(true)
    await composer.focus()
    const text = `kuyruk-${Date.now().toString(36)}`
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')

    await expect
      .poll(() => countPending(page), { timeout: 10_000, message: 'message should be queued while offline' })
      .toBeGreaterThan(0)

    await context.setOffline(false)

    await expect
      .poll(
        async () => {
          const { body } = await api.get<{ content: Array<{ content: string }> }>(
            `/api/channels/${channelId}/messages?page=0&size=50`,
            owner.accessToken,
          )
          return body.content.some((m) => m.content === text)
        },
        { timeout: 30_000, message: 'queued message should reach the server' },
      )
      .toBe(true)

    await expect.poll(() => countPending(page), { timeout: 15_000 }).toBe(0)
  })
})

function countPending(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('ripplechat-db', 4)
        req.onsuccess = () => {
          try {
            const all = req.result
              .transaction('pending_messages', 'readonly')
              .objectStore('pending_messages')
              .getAll()
            all.onsuccess = () => resolve(all.result.length)
            all.onerror = () => resolve(-1)
          } catch {
            resolve(-1)
          }
        }
        req.onerror = () => resolve(-1)
      }),
  )
}
