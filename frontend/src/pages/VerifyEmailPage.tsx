import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { client } from '../api/client'
import { useT } from '../i18n'
import AuthShell from '../components/AuthShell'

type State = 'verifying' | 'success' | 'failed' | 'missing'

export default function VerifyEmailPage() {
  const { t } = useT()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing')

  useEffect(() => {
    if (!token) return
    let active = true
    client
      .post('/api/auth/verify-email', { token })
      .then(() => active && setState('success'))
      .catch(() => active && setState('failed'))
    return () => {
      active = false
    }
  }, [token])

  return (
    <AuthShell title={t('auth.verify.title')}>
      <div className="space-y-4 text-center">
        {state === 'verifying' && <p className="text-sm text-fg-muted">{t('auth.verify.verifying')}</p>}
        {state === 'success' && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            {t('auth.verify.success')}
          </p>
        )}
        {state === 'failed' && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{t('auth.verify.failed')}</p>
        )}
        {state === 'missing' && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{t('auth.verify.missingToken')}</p>
        )}
        <Link to="/chat" className="block text-sm text-accent underline hover:text-accent-hover">
          {t('auth.verify.continue')}
        </Link>
      </div>
    </AuthShell>
  )
}
