// This suite reads build output off disk, so it needs Node's types. The app
// tsconfig deliberately does not include them — app code must not reach for
// node APIs — so pull them in just for this file.
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifestRaw from '../public/manifest.webmanifest?raw'
import swRaw from './sw.ts?raw'

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

  it('ships the raster icons Chrome requires to offer an install', () => {
    // An SVG-only icon list is not installable, and a missing file is invisible
    // in production because Vercel's SPA rewrite serves index.html for it.
    const manifest = JSON.parse(manifestRaw)
    for (const size of ['192x192', '512x512']) {
      const icon = manifest.icons.find(
        (i: { sizes: string; type: string }) => i.sizes === size && i.type === 'image/png',
      )
      expect(icon, `manifest declares a ${size} PNG icon`).toBeTruthy()
      const path = resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''))
      expect(existsSync(path), `${icon.src} exists on disk`).toBe(true)
    }
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

  it('does not wipe the workbox precache on activate', () => {
    // An unfiltered "delete every cache that is not mine" sweep would drop
    // workbox-precache-v2-* on every activation and quietly undo precaching.
    expect(swRaw).toContain('OWN_CACHE_PREFIX')
  })
})

// The bug this guards against: the plugin used to run in generateSW mode and
// emitted its own worker over the hand-written one, so production shipped a
// service worker with no push handler at all -- while the source-level
// assertions above stayed green. Only the built artifact can prove otherwise.
describe('built service worker', () => {
  const distSw = resolve(process.cwd(), 'dist/sw.js')
  const built = existsSync(distSw) ? readFileSync(distSw, 'utf8') : null

  it.skipIf(built === null)('keeps the push handlers after bundling', () => {
    // Quote style is whatever the bundler chose, so match on the call shape.
    expect(built).toMatch(/addEventListener\(\s*['"`]push['"`]/)
    expect(built).toMatch(/addEventListener\(\s*['"`]notificationclick['"`]/)
    expect(built).toContain('showNotification')
  })

  it.skipIf(built === null)('still precaches the build output', () => {
    expect(built).toMatch(/precache/i)
  })
})
