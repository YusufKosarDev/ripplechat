import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { login } from '../features/auth/authSlice'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import WakeNotice, { useWakeNotice } from '../components/ui/WakeNotice'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useT()
  const { status, error } = useAppSelector((state) => state.auth)
  const waking = useWakeNotice(status === 'loading')

  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!loginValue.trim() || !password) {
      setFormError(t('auth.login.required'))
      return
    }
    const result = await dispatch(login({ login: loginValue.trim(), password }))
    if (login.fulfilled.match(result)) {
      navigate('/chat')
    }
  }

  return (
    <AuthShell title={t('auth.login.title')}>
      <form onSubmit={onSubmit} className="space-y-4">
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

        {(formError || error) && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{formError || error}</p>
        )}

        <Button type="submit" className="w-full" disabled={status === 'loading'}>
          {status === 'loading' ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
        <WakeNotice show={waking} />
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="text-accent hover:text-accent-hover">
          {t('auth.login.registerLink')}
        </Link>
      </p>
    </AuthShell>
  )
}
