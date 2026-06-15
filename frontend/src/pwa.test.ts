import { describe, expect, it } from 'vitest'
import manifestRaw from '../public/manifest.webmanifest?raw'
import swRaw from '../public/sw.js?raw'

describe('PWA manifest', () => {
  it('is valid JSON with the fields needed for installability', () => {
    const manifest = JSON.parse(manifestRaw)
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
    expect(manifest.icons[0].src).toBeTruthy()
  })
})

describe('service worker', () => {
  it('handles offline app-shell caching alongside push', () => {
    // Lifecycle + fetch handler for offline support.
    expect(swRaw).toContain("addEventListener('install'")
    expect(swRaw).toContain("addEventListener('activate'")
    expect(swRaw).toContain("addEventListener('fetch'")
    // Existing push behaviour must remain.
    expect(swRaw).toContain("addEventListener('push'")
  })
})
