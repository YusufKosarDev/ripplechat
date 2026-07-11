import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { login, verify2Fa } from '../features/auth/authSlice'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import WakeNotice from '../components/ui/WakeNotice'
import { useWakeNotice } from '../hooks/useWakeNotice'
import { useAuthProviders } from '../hooks/useAuthProviders'
import { config } from '../config'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useT()
  const { status, error } = useAppSelector((state) => state.auth)
  const waking = useWakeNotice(status === 'loading')
  const providers = useAuthProviders()

  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { requires2Fa, preAuthToken } = useAppSelector((state) => state.auth)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (requires2Fa && preAuthToken) {
      if (useRecovery) {
        if (code.trim().length < 6) {
          setFormError(t('auth.recoveryCodeRequired'))
          return
        }
      } else if (!code || code.length !== 6) {
        setFormError(t('auth.totpCodeRequired'))
        return
      }
      const result = await dispatch(verify2Fa({ preAuthToken, code: code.trim() }))
      if (verify2Fa.fulfilled.match(result)) {
        navigate('/chat')
      }
      return
    }

    if (!loginValue.trim() || !password) {
      setFormError(t('auth.login.required'))
      return
    }
    const result = await dispatch(login({ login: loginValue.trim(), password }))
    if (login.fulfilled.match(result) && !result.payload.requires2Fa) {
      navigate('/chat')
    }
  }

  return (
    <AuthShell title={t('auth.login.title')}>
      <form onSubmit={onSubmit} className="space-y-4">
        {requires2Fa ? (
          <div>
            <label className="mb-1 block text-sm text-fg-muted">
              {useRecovery ? 'Kurtarma kodu' : 'Google Authenticator Kodu'}
            </label>
            {useRecovery ? (
              <Input
                type="text"
                maxLength={14}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="xxxxx-xxxxx"
                autoComplete="one-time-code"
                autoFocus
              />
            ) : (
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
              />
            )}
            <button
              type="button"
              className="mt-2 text-xs text-fg-muted underline hover:text-fg-secondary"
              onClick={() => {
                setUseRecovery((v) => !v)
                setCode('')
                setFormError(null)
              }}
            >
              {useRecovery ? '6 haneli kodu kullan' : 'Kurtarma kodu kullan'}
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm text-fg-muted">{t('auth.usernameOrEmail')}</label>
              <Input
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                placeholder="neo"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-fg-muted">{t('auth.password')}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </>
        )}

        {!requires2Fa && (
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-fg-muted underline hover:text-fg-secondary">
              {t('auth.login.forgot')}
            </Link>
          </div>
        )}

        {(formError || error) && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{t(formError || error || '')}</p>
        )}

        <Button type="submit" className="w-full" disabled={status === 'loading'}>
          {status === 'loading' ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>

        <Button 
          type="button" 
          variant="secondary" 
          className="w-full flex items-center justify-center gap-2 border-dashed border-indigo-500/30 hover:border-indigo-500"
          disabled={status === 'loading'}
          onClick={async () => {
            setFormError(null)
            const result = await dispatch(login({ login: 'demo', password: 'demo1234' }))
            if (login.fulfilled.match(result) && !result.payload.requires2Fa) {
              navigate('/chat')
            }
          }}
        >
          🚀 {t('auth.demoQuickLogin')}
        </Button>
        <WakeNotice show={waking} />
      </form>

      {/* OAuth2 divider + button — rendered only when the backend has real credentials */}
      {providers.google && (<>
      <div className="mt-6 flex items-center justify-between">
        <span className="w-1/5 border-b border-border"></span>
        <span className="text-xs text-fg-muted uppercase">{t('auth.or')}</span>
        <span className="w-1/5 border-b border-border"></span>
      </div>
      
      <Button 
        type="button" 
        variant="secondary" 
        className="w-full mt-4 flex items-center justify-center gap-2"
        onClick={() => {
          // Backend OAuth2 authorization endpoint'ine yönlendiriyoruz
          window.location.href = `${config.apiUrl}/oauth2/authorization/google?redirect_uri=${encodeURIComponent(window.location.origin + '/oauth2/redirect')}`
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
        </svg>
        {t('auth.googleLogin')}
      </Button>
      </>)}

      <p className="mt-6 text-center text-sm text-fg-muted">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="text-accent underline hover:text-accent-hover">
          {t('auth.login.registerLink')}
        </Link>
      </p>
    </AuthShell>
  )
}
