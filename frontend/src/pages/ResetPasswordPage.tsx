import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { client } from '../api/client'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'

export default function ResetPasswordPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError(t('auth.reset.missingToken'))
      return
    }
    if (password.length < 8) {
      setError(t('auth.reset.short'))
      return
    }
    setSubmitting(true)
    try {
      await client.post('/api/auth/reset-password', { token, newPassword: password })
      setDone(true)
    } catch {
      setError(t('auth.reset.invalid'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title={t('auth.reset.title')}>
      {done ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            {t('auth.reset.done')}
          </p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            {t('auth.reset.toLogin')}
          </Button>
        </div>
      ) : !token ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{t('auth.reset.missingToken')}</p>
          <Link to="/login" className="block text-center text-sm text-accent underline hover:text-accent-hover">
            {t('auth.reset.toLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-fg-muted">{t('auth.reset.newPassword')}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
            />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
