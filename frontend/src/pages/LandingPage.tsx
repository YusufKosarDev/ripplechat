import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BarChart3, Code2, MessagesSquare, MoonStar, SmilePlus, Zap } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { login } from '../features/auth/authSlice'
import { useT } from '../i18n'
import Button from '../components/ui/Button'
import LanguageToggle from '../components/LanguageToggle'
import WakeNotice from '../components/ui/WakeNotice'
import { useWakeNotice } from '../hooks/useWakeNotice'
import productShot from '../assets/product-dark.png'

// Public demo account (seeded server-side). Credentials are intentionally
// public — one click signs in through the normal auth flow and gets a real token.
const DEMO = { login: 'demo', password: 'demo1234' }

const FEATURES = [
  { icon: Zap, key: 'realtime' },
  { icon: SmilePlus, key: 'reactions' },
  { icon: BarChart3, key: 'polls' },
  { icon: MessagesSquare, key: 'threads' },
  { icon: Code2, key: 'code' },
  { icon: MoonStar, key: 'theme' },
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
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-16">
      {/* Aurora backdrop: two blurred brand blobs + a soft top wash. Purely
          decorative, sits behind everything, adapts through the tokens. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_0%,var(--glow),transparent)]" />
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute -right-40 top-1/2 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <LanguageToggle />
      </div>

      <div className="relative z-10 w-full max-w-5xl text-center">
        <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-fg-muted">
          {t('landing.badge')}
        </span>

        <h1 className="mt-6 text-6xl font-bold tracking-tight sm:text-7xl">
          Ripple
          <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            Chat
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-fg-secondary">
          {t('landing.tagline')}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={onDemo}
            disabled={demoLoading}
            className={`${ctaClass} border-0 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-glow hover:from-indigo-500 hover:to-violet-500`}
          >
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

        {/* Product shot inside a browser frame — the dark theme is the hero. */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(50%_60%_at_50%_40%,var(--glow),transparent)]" aria-hidden />
          <figure className="glass relative overflow-hidden rounded-2xl shadow-elevated">
            <figcaption className="flex items-center gap-2 border-b border-glass-border px-4 py-2.5" style={{ borderColor: 'var(--glass-border)' }}>
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </span>
              <span className="mx-auto rounded-md bg-surface-muted/60 px-3 py-0.5 text-2xs text-fg-faint" data-tabular>
                ripplechat-app.vercel.app
              </span>
            </figcaption>
            <img src={productShot} alt={t('landing.productAlt')} className="block w-full" loading="lazy" />
          </figure>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.key}
              className="glass rounded-2xl p-5 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-elevated"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-accent">
                <f.icon className="h-5 w-5" aria-hidden />
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
