import { describe, expect, it } from 'vitest'
import { translations } from './translations'

describe('i18n catalog', () => {
  it('has matching keys for Turkish and English', () => {
    const trKeys = Object.keys(translations.tr).sort()
    const enKeys = Object.keys(translations.en).sort()
    expect(enKeys).toEqual(trKeys)
  })

  it('has no empty strings', () => {
    for (const lang of ['tr', 'en'] as const) {
      for (const [key, value] of Object.entries(translations[lang])) {
        expect(value, `${lang}.${key}`).toBeTruthy()
      }
    }
  })

  it('keeps Turkish as the source of truth for the login title (e2e relies on it)', () => {
    expect(translations.tr['auth.login.title']).toBe('Giriş yap')
  })
})
