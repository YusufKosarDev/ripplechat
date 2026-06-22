import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '../app/hooks'
import { oauth2LoginSuccess } from '../features/auth/authSlice'
import { setTokens } from '../api/token'
import AuthShell from '../components/AuthShell'

export default function OAuth2RedirectHandler() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  useEffect(() => {
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')
    const error = searchParams.get('error')

    if (error) {
      // Başarısız ise login sayfasına hata ile gönder
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true })
      return
    }

    if (accessToken && refreshToken) {
      // Backend'den gelen tokenları API client'a ve Redux'a kaydet
      setTokens(accessToken, refreshToken)
      
      dispatch(oauth2LoginSuccess())
      navigate('/chat', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate, dispatch])

  return (
    <AuthShell title="Giriş yapılıyor...">
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
      </div>
      <p className="text-center text-sm text-fg-muted mt-4">
        Kimlik bilgileriniz doğrulanıyor, lütfen bekleyin...
      </p>
    </AuthShell>
  )
}
