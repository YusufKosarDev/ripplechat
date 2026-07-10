import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom has no matchMedia; stub it so modules that read the system theme
// (e.g. the UI slice's initial state) can load under test.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

// The unit tests assert the Turkish source strings; jsdom reports en-US, so
// pin the persisted language to Turkish (mirrors the e2e config's tr-TR).
localStorage.setItem('ripplechat_lang', 'tr')

// Unmount React trees and reset jsdom between tests.
afterEach(() => cleanup())
