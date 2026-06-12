import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { login } from '../features/auth/authSlice'
import Button from '../components/ui/Button'
import WakeNotice, { useWakeNotice } from '../components/ui/WakeNotice'

// Public demo account (seeded server-side). Credentials are intentionally
// public — one click signs in through the normal auth flow and gets a real token.
const DEMO = { login: 'demo', password: 'demo1234' }

const FEATURES = [
  { icon: '⚡', title: 'Gerçek zamanlı', desc: 'Mesajlar, “yazıyor” göstergesi ve çevrimiçi durum anında akar.' },
  { icon: '🎉', title: 'Reaksiyonlar', desc: 'Kalıcı emoji tepkileri ve ekranda uçan canlı reaksiyonlar.' },
  { icon: '📊', title: 'Anketler', desc: 'Kanal içinde /poll ile saniyeler içinde oylama başlatın.' },
  { icon: '🧵', title: 'Thread’ler', desc: 'Yanıt zincirleriyle tartışmalar ana akışı dağıtmaz.' },
  { icon: '💻', title: 'Kod paylaşımı', desc: 'Markdown ve sözdizimi vurgulu kod blokları desteklenir.' },
  { icon: '🌗', title: 'Açık / koyu tema', desc: 'Responsive arayüz, iki temada da şık ve okunaklı.' },
]

const ctaClass = 'px-5 py-2.5 text-base'

export default function LandingPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
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
    else setDemoError('Demo girişi şu an yapılamadı, lütfen tekrar dene.')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />

      <div className="relative z-10 w-full max-w-3xl text-center">
        <span className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Ripple<span className="text-indigo-500 dark:text-indigo-400">Chat</span>
        </span>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-fg-secondary">
          Gerçek zamanlı, topluluk odaklı sohbet platformu. Kanallar, thread’ler, reaksiyonlar ve
          anketler — hepsi canlı, hepsi tek yerde.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={onDemo} disabled={demoLoading} className={ctaClass}>
            {demoLoading ? 'Giriş yapılıyor…' : '🚀 Demo’yu Dene'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/login')} className={ctaClass}>
            Giriş Yap
          </Button>
          <Button variant="secondary" onClick={() => navigate('/register')} className={ctaClass}>
            Kayıt Ol
          </Button>
        </div>

        <WakeNotice show={waking} />
        {demoError && <p className="mt-3 text-sm text-danger">{demoError}</p>}
        {!waking && <p className="mt-3 text-xs text-fg-faint">Demo’yu Dene: hazır bir hesapla tek tıkla, kayıt gerekmez.</p>}

        <div className="mt-12 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
              <div className="text-2xl">{f.icon}</div>
              <div className="mt-2 font-medium text-fg">{f.title}</div>
              <div className="mt-1 text-sm leading-relaxed text-fg-muted">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
