import { expect, test } from '@playwright/test'
import { api, createChannel, register, sendMessage, signIn } from './api'

/**
 * Decisions only the server can make. A stubbed backend answers however the
 * fixture says, so none of this is testable in the mocked suite — it would be
 * asserting the mock.
 */
test.describe('The server decides who gets in', () => {
  test('a private channel is invite-only, and adding a member opens it', async ({ page }) => {
    const owner = await register('own')
    const outsider = await register('out')
    const channelName = `gizli-${Date.now().toString(36)}`
    const channelId = await createChannel(owner, channelName, true)
    await sendMessage(owner, channelId, 'gizli mesaj')

    // Knowing the id used to be enough to join, and membership is what every
    // other read is gated on — so it handed over the whole channel.
    const join = await api.post(`/api/channels/${channelId}/join`, undefined, outsider.accessToken)
    expect(join.status).toBe(403)

    const roster = await api.get(`/api/channels/${channelId}/members`, outsider.accessToken)
    expect(roster.status).toBe(403)

    const feed = await api.get(`/api/channels/${channelId}/messages`, outsider.accessToken)
    expect(feed.status).toBe(403)

    const added = await api.post(
      `/api/channels/${channelId}/members`,
      { userId: outsider.userId },
      owner.accessToken,
    )
    expect(added.status).toBe(201)

    // And now the same requests succeed, through the UI as well as the API.
    const afterFeed = await api.get<{ content: unknown[] }>(
      `/api/channels/${channelId}/messages`,
      outsider.accessToken,
    )
    expect(afterFeed.status).toBe(200)

    await signIn(page, outsider)
    await expect(page.getByText(channelName).first()).toBeVisible()
  })

  test('a plain member cannot add people to a channel', async () => {
    const owner = await register('mowner')
    const member = await register('mmember')
    const stranger = await register('mstranger')
    const channelId = await createChannel(owner, `mod-${Date.now().toString(36)}`, true)

    await api.post(`/api/channels/${channelId}/members`, { userId: member.userId }, owner.accessToken)

    const attempt = await api.post(
      `/api/channels/${channelId}/members`,
      { userId: stranger.userId },
      member.accessToken,
    )
    expect(attempt.status).toBe(403)
  })

  test('joining a public channel by id still works', async () => {
    const owner = await register('powner')
    const joiner = await register('pjoiner')
    const channelId = await createChannel(owner, `acik-${Date.now().toString(36)}`, false)

    const join = await api.post(`/api/channels/${channelId}/join`, undefined, joiner.accessToken)
    expect(join.status).toBe(200)

    const feed = await api.get(`/api/channels/${channelId}/messages`, joiner.accessToken)
    expect(feed.status).toBe(200)
  })

  test('signing out kills the access token, not just the refresh token', async ({ page }) => {
    const user = await register('bye')
    await signIn(page, user)

    const before = await api.get('/api/users/me', user.accessToken)
    expect(before.status).toBe(200)

    await page.getByRole('button', { name: /çıkış/i }).first().click()
    await page.waitForURL('**/login')

    // The token the browser was holding a moment ago is now refused. Before the
    // revocation watermark it stayed valid for the rest of its hour.
    await expect
      .poll(async () => (await api.get('/api/users/me', user.accessToken)).status, { timeout: 10_000 })
      .toBe(401)
  })

  test('deleting a message takes its edit history with it', async () => {
    const owner = await register('del')
    const channelId = await createChannel(owner, `sil-${Date.now().toString(36)}`, false)
    const messageId = await sendMessage(owner, channelId, 'ilk hali')

    await api.put(
      `/api/channels/${channelId}/messages/${messageId}`,
      { content: 'ikinci hali' },
      owner.accessToken,
    )

    const history = await api.get<Array<{ content: string }>>(
      `/api/channels/${channelId}/messages/${messageId}/history`,
      owner.accessToken,
    )
    expect(history.body).toHaveLength(1)
    expect(history.body[0].content).toBe('ilk hali')

    const deleted = await api.delete(`/api/channels/${channelId}/messages/${messageId}`, owner.accessToken)
    expect(deleted.status).toBe(204)

    // The original text used to stay readable here after the message was gone.
    const after = await api.get<unknown[]>(
      `/api/channels/${channelId}/messages/${messageId}/history`,
      owner.accessToken,
    )
    expect(after.body).toEqual([])
  })
})
