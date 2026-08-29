import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import vercelConfig from '../vercel.json'
import { CONTENT_SECURITY_POLICY } from './csp'

/** The backend URLs the production build is actually configured to talk to. */
function productionEnv(): Record<string, string> {
  // Resolved from the vitest root (frontend/), not import.meta.url — under jsdom
  // that is an http: URL and readFileSync rejects it.
  const raw = readFileSync(resolve(process.cwd(), '.env.production'), 'utf8')
  return Object.fromEntries(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const eq = line.indexOf('=')
        return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()]
      }),
  )
}

/**
 * vercel.json is static JSON, so it cannot import the policy — this test is what
 * keeps the two copies honest. Without it, a change to one would surface only in
 * production, and only on the request that violates the policy.
 */
describe('Content-Security-Policy', () => {
  const headers = vercelConfig.headers.flatMap((entry) => entry.headers)

  it('matches the policy vercel.json serves in production', () => {
    const shipped = headers.find((h) => h.key === 'Content-Security-Policy')
    expect(shipped, 'vercel.json should set a Content-Security-Policy').toBeDefined()
    expect(shipped!.value).toBe(CONTENT_SECURITY_POLICY)
  })

  it('keeps the directives that carry the guarantee', () => {
    // Spot-check rather than restate: these are the ones whose loss would be
    // silent but meaningful.
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src 'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval')
  })

  // The policy names the backend origin literally, because vercel.json is static
  // JSON and cannot read an env var. Point the app at another backend without
  // updating the policy and every API call is blocked by the browser, with no
  // build-time signal at all — so make that a failing test instead.
  it('allows the backend the production build is configured to call', () => {
    const env = productionEnv()
    const connectSrc = CONTENT_SECURITY_POLICY.split('; ').find((d) => d.startsWith('connect-src '))
    expect(connectSrc, 'the policy should declare a connect-src').toBeDefined()

    for (const key of ['VITE_API_URL', 'VITE_WS_URL']) {
      const value = env[key]
      expect(value, `${key} should be set in .env.production`).toBeTruthy()
      const { protocol, host } = new URL(value)
      // A ws:// endpoint may be reached over either scheme; SockJS upgrades.
      const allowed =
        protocol === 'https:'
          ? [`https://${host}`, `wss://${host}`]
          : [`${protocol}//${host}`]
      expect(
        allowed.some((origin) => connectSrc!.includes(origin)),
        `connect-src must allow ${key} (${value}); update src/csp.ts AND vercel.json together`,
      ).toBe(true)
    }
  })
})
