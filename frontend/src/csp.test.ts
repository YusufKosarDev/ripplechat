import { describe, expect, it } from 'vitest'
import vercelConfig from '../vercel.json'
import { CONTENT_SECURITY_POLICY } from './csp'

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
})
