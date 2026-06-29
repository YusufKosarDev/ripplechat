import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { register } from '../features/auth/authSlice'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import WakeNotice from '../components/ui/WakeNotice'
import { useWakeNotice } from '../hooks/useWakeNotice'

// Lightweight, dependency-free password strength estimate from length and
// character variety. Deliberately avoids a library (e.g. zxcvbn ~400 kB) so it
// adds no weight to the bundle.
function passwordStrength(pw: string): { level: 'weak' | 'medium' | 'strong'; score: number } {
  let variety = 0
  if (/[a-z]/.test(pw)) variety++
  if (/[A-Z]/.test(pw)) variety++
  if (/\d/.test(pw)) variety++
  if (/[^A-Za-z0-9]/.test(pw)) variety++
  if (pw.length < 8 || variety <= 1) return { level: 'weak', score: 1 }
  if (pw.length >= 12 && variety >= 3) return { level: 'strong', score: 3 }
  return { level: 'medium', score: 2 }
}

const STRENGTH_COLORS: Record<'weak' | 'medium' | 'strong', string> = {
  weak: 'bg-danger',
  medium: 'bg-amber-500',
  strong: 'bg-emerald-500',
}

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useT()
  const { status, error } = useAppSelector((state) => state.auth)
  const waking = useWakeNotice(status === 'loading')

  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const strength = form.password ? passwordStrength(form.password) : null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setFormError(t('auth.register.required'))
      return
    }
    if (form.password.length < 8) {
      setFormError(t('auth.register.shortPassword'))
      return
    }
    const result = await dispatch(
      register({
        username: form.username.trim(),
        email: form.email.trim(),
        displayName: form.displayName.trim() || undefined,
        password: form.password,
      }),
    )
    if (register.fulfilled.match(result)) {
      navigate('/chat')
    }
  }

  return (
    <AuthShell title={t('auth.register.title')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-fg-muted">{t('auth.username')}</label>
          <Input value={form.username} onChange={update('username')} placeholder="neo" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">{t('auth.email')}</label>
          <Input value={form.email} onChange={update('email')} placeholder="neo@ripplechat.io" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">{t('auth.displayName')}</label>
          <Input value={form.displayName} onChange={update('displayName')} placeholder="Neo" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">{t('auth.password')}</label>
          <Input
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder={t('auth.register.passwordPlaceholder')}
            autoComplete="new-password"
          />
          {strength && (
            <div className="mt-2" aria-live="polite">
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i <= strength.score ? STRENGTH_COLORS[strength.level] : 'bg-border'}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                {t('auth.register.strength.label')}: {t(`auth.register.strength.${strength.level}`)}
              </p>
            </div>
          )}
        </div>

        {(formError || error) && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{formError || error}</p>
        )}

        <Button type="submit" className="w-full" disabled={status === 'loading'}>
          {status === 'loading' ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
        <WakeNotice show={waking} />
      </form>

      {/* OAuth2 Divider & Button */}
      <div className="mt-6 flex items-center justify-between">
        <span className="w-1/5 border-b border-border"></span>
        <span className="text-xs text-fg-muted uppercase">VEYA</span>
        <span className="w-1/5 border-b border-border"></span>
      </div>
      
      <Button 
        type="button" 
        variant="secondary" 
        className="w-full mt-4 flex items-center justify-center gap-2"
        onClick={() => {
          // Backend OAuth2 authorization endpoint'ine yönlendiriyoruz
          window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/oauth2/authorization/google?redirect_uri=${encodeURIComponent(window.location.origin + '/oauth2/redirect')}`
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
        </svg>
        Google ile Kayıt Ol
      </Button>

      <p className="mt-6 text-center text-sm text-fg-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="text-accent underline hover:text-accent-hover">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </AuthShell>
  )
}
