import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { register } from '../features/auth/authSlice'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import WakeNotice, { useWakeNotice } from '../components/ui/WakeNotice'

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
        </div>

        {(formError || error) && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{formError || error}</p>
        )}

        <Button type="submit" className="w-full" disabled={status === 'loading'}>
          {status === 'loading' ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
        <WakeNotice show={waking} />
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="text-accent hover:text-accent-hover">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </AuthShell>
  )
}
