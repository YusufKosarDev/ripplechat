import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { client } from '../api/client'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'

export default function ForgotPasswordPage() {
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('auth.forgot.invalidEmail'))
      return
    }
    setSubmitting(true)
    try {
      await client.post('/api/auth/forgot-password', { email: email.trim() })
    } catch {
      // The endpoint is intentionally non-revealing (always 204); show the same
      // confirmation regardless of whether the email exists or the call failed.
    } finally {
      setSubmitting(false)
      setDone(true)
    }
  }

  return (
    <AuthShell title={t('auth.forgot.title')}>
      {done ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            {t('auth.forgot.done')}
          </p>
          <Link to="/login" className="block text-center text-sm text-accent underline hover:text-accent-hover">
            {t('auth.forgot.back')}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-fg-muted">{t('auth.forgot.intro')}</p>
          <div>
            <label className="mb-1 block text-sm text-fg-muted">{t('auth.email')}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
          </Button>
          <Link to="/login" className="block text-center text-sm text-fg-muted underline hover:text-fg-secondary">
            {t('auth.forgot.back')}
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
