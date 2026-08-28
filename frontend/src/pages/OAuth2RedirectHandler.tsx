import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '../app/hooks'
import { oauth2LoginSuccess } from '../features/auth/authSlice'
import { setTokens } from '../api/token'
import AuthShell from '../components/AuthShell'
import { useT } from '../i18n'

export default function OAuth2RedirectHandler() {
  const { t } = useT()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  useEffect(() => {
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')
    const error = searchParams.get('error')

    if (error) {
      // On failure, bounce back to the login page carrying the error.
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true })
      return
    }

    if (accessToken && refreshToken) {
      // Persist the tokens the backend handed back into the API client and Redux.
      setTokens(accessToken, refreshToken)

      // Take them out of the address bar immediately. The backend has to hand
      // them over as query parameters (it is a browser redirect), but a URL
      // carrying credentials ends up in history, in the Referer of anything the
      // page loads next, and in every proxy log on the way. navigate(replace)
      // below drops the history entry, but not before this tick.
      window.history.replaceState(null, '', '/oauth2/redirect')

      dispatch(oauth2LoginSuccess())
      navigate('/chat', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate, dispatch])

  return (
    <AuthShell title={t('auth.oauthSigningIn')}>
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
      </div>
      <p className="text-center text-sm text-fg-muted mt-4">
        {t('auth.oauthVerifying')}
      </p>
    </AuthShell>
  )
}
