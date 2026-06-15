import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { login } from '../features/auth/authSlice'
import { useT } from '../i18n'
import Button from '../components/ui/Button'
import LanguageToggle from '../components/LanguageToggle'
import WakeNotice, { useWakeNotice } from '../components/ui/WakeNotice'

// Public demo account (seeded server-side). Credentials are intentionally
// public — one click signs in through the normal auth flow and gets a real token.
const DEMO = { login: 'demo', password: 'demo1234' }

const FEATURES = [
  { icon: '⚡', key: 'realtime' },
  { icon: '🎉', key: 'reactions' },
  { icon: '📊', key: 'polls' },
  { icon: '🧵', key: 'threads' },
  { icon: '💻', key: 'code' },
  { icon: '🌗', key: 'theme' },
]

const ctaClass = 'px-5 py-2.5 text-base'

export default function LandingPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useT()
  const token = useAppSelector((state) => state.auth.token)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const waking = useWakeNotice(demoLoading)

  // Returning (authenticated) visitors skip the landing.
  if (token) return <Navigate to="/chat" replace />

  const onDemo = async () => {
    setDemoError(null)
    setDemoLoading(true)
    const result = await dispatch(login(DEMO))
    setDemoLoading(false)
    if (login.fulfilled.match(result)) navigate('/chat')
    else setDemoError(t('landing.demoError'))
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.20),transparent)]" />

      <div className="absolute right-4 top-4 z-20">
        <LanguageToggle />
      </div>

      <div className="relative z-10 w-full max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-medium text-fg-muted shadow-card">
          {t('landing.badge')}
        </span>

        <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl">
          Ripple
          <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            Chat
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-fg-secondary">
          {t('landing.tagline')}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={onDemo} disabled={demoLoading} className={ctaClass}>
            {demoLoading ? t('landing.demoLoading') : t('landing.demo')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/login')} className={ctaClass}>
            {t('landing.login')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/register')} className={ctaClass}>
            {t('landing.register')}
          </Button>
        </div>

        <WakeNotice show={waking} />
        {demoError && <p className="mt-3 text-sm text-danger">{demoError}</p>}
        {!waking && <p className="mt-3 text-xs text-fg-faint">{t('landing.demoHint')}</p>}

        <div className="mt-14 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="rounded-2xl border border-border bg-surface-raised p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-xl">
                {f.icon}
              </div>
              <div className="mt-3 font-semibold tracking-tight text-fg">{t(`feat.${f.key}.title`)}</div>
              <div className="mt-1 text-sm leading-relaxed text-fg-muted">{t(`feat.${f.key}.desc`)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
