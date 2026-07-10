import { afterEach, describe, expect, it, vi } from 'vitest'
import { getInitialLang } from './index'

function setNavigatorLanguage(lang: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(lang)
}

describe('getInitialLang', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // The global test setup pins Turkish; put it back for other suites.
    localStorage.setItem('ripplechat_lang', 'tr')
  })

  it('a stored choice always wins over the browser language', () => {
    localStorage.setItem('ripplechat_lang', 'en')
    setNavigatorLanguage('tr-TR')
    expect(getInitialLang()).toBe('en')
  })

  it('first visit follows a Turkish browser', () => {
    localStorage.removeItem('ripplechat_lang')
    setNavigatorLanguage('tr-TR')
    expect(getInitialLang()).toBe('tr')
  })

  it('first visit defaults everyone else to English', () => {
    localStorage.removeItem('ripplechat_lang')
    setNavigatorLanguage('en-US')
    expect(getInitialLang()).toBe('en')
    setNavigatorLanguage('de-DE')
    expect(getInitialLang()).toBe('en')
  })
})
