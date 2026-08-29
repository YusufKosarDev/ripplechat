import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'

/**
 * Thin API client for the integration specs.
 *
 * <p>Fixtures are created through the real API rather than seeded into the
 * database, so a spec exercises the same endpoints a user would and needs no
 * schema knowledge. Usernames carry a per-run suffix, which is what lets the
 * suite run repeatedly against a long-lived database without colliding or
 * needing a teardown.
 */

/** Reached through the preview server's proxy, so everything stays same-origin. */
const API = 'http://localhost:4173'

export const PASSWORD = 'password123'

/**
 * Unique per process, so parallel workers and repeat runs never collide.
 *
 * randomUUID rather than Math.random: the suffix ends up in a username that is
 * registered with a password, which is enough for a scanner to call this a
 * security context — and arguing with it costs more than just using the right
 * generator.
 */
const RUN = `${Date.now().toString(36)}${randomUUID().replace(/-/g, '').slice(0, 6)}`
let seq = 0

/** A username that satisfies the server's charset rule and is unique to this run. */
export function uniqueUsername(prefix: string): string {
  seq += 1
  return `${prefix}${RUN}${seq}`.slice(0, 30)
}

export interface Account {
  username: string
  userId: string
  accessToken: string
  refreshToken: string
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const { token, ...rest } = init
  const res = await fetch(API + path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  })
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, body: body as T }
}

export const api = {
  get: <T>(path: string, token?: string) => call<T>(path, { token }),
  post: <T>(path: string, payload?: unknown, token?: string) =>
    call<T>(path, { method: 'POST', token, body: payload === undefined ? undefined : JSON.stringify(payload) }),
  put: <T>(path: string, payload?: unknown, token?: string) =>
    call<T>(path, { method: 'PUT', token, body: payload === undefined ? undefined : JSON.stringify(payload) }),
  delete: <T>(path: string, token?: string) => call<T>(path, { method: 'DELETE', token }),
}

/** Registers a fresh account and returns its identity plus tokens. */
export async function register(prefix: string): Promise<Account> {
  const username = uniqueUsername(prefix)
  const { status, body } = await api.post<{
    accessToken: string
    refreshToken: string
    user: { id: string }
  }>('/api/auth/register', { username, email: `${username}@e2e.test`, password: PASSWORD })
  if (status !== 201) {
    throw new Error(`register(${username}) failed with ${status}`)
  }
  return {
    username,
    userId: body.user.id,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  }
}

export async function createChannel(owner: Account, name: string, isPrivate: boolean): Promise<string> {
  const { status, body } = await api.post<{ id: string }>(
    '/api/channels',
    { name, isPrivate },
    owner.accessToken,
  )
  if (status !== 201) {
    throw new Error(`createChannel(${name}) failed with ${status}`)
  }
  return body.id
}

export async function sendMessage(sender: Account, channelId: string, content: string): Promise<string> {
  const { status, body } = await api.post<{ id: string }>(
    `/api/channels/${channelId}/messages`,
    { content },
    sender.accessToken,
  )
  if (status !== 201) {
    throw new Error(`sendMessage failed with ${status}`)
  }
  return body.id
}

/**
 * Signs in through the real login form, so each spec starts from the state a
 * user would actually be in — tokens in storage, the chat route loaded.
 */
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('neo').fill(account.username)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: /^Giriş yap/i }).click()
  await page.waitForURL('**/chat')
}
