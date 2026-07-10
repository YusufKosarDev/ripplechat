/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { translations } from './translations'
import type { Lang } from './translations'

export type { Lang }

const LANG_KEY = 'ripplechat_lang'

export function getInitialLang(): Lang {
  const stored = localStorage.getItem(LANG_KEY)
  if (stored === 'en' || stored === 'tr') return stored
  // First visit: follow the browser language; Turkish visitors keep the
  // original default, everyone else starts in English (the toggle persists
  // whatever they pick afterwards).
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

/** BCP 47 locale for date/time formatting in the given UI language. */
export function dateLocale(lang: Lang): string {
  return lang === 'tr' ? 'tr-TR' : 'en-US'
}

type Vars = Record<string, string | number>

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Vars) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  const value = useMemo<LanguageContextValue>(() => {
    const setLang = (next: Lang) => {
      localStorage.setItem(LANG_KEY, next)
      document.documentElement.lang = next
      setLangState(next)
    }
    const t = (key: string, vars?: Vars) => {
      let str = translations[lang][key] ?? translations.tr[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v))
        }
      }
      return str
    }
    return { lang, setLang, t }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useT(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useT must be used within a LanguageProvider')
  }
  return ctx
}
