import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { fetchCurrentUser } from './features/auth/authSlice'
import { applyTheme } from './theme'
import PrivateRoute from './components/PrivateRoute'
import ToastViewport from './components/ToastViewport'
import { useT } from './i18n'

// Route-level code splitting: each page (and the heavy chat bundle it pulls in —
// STOMP, emoji/GIF pickers, syntax highlighting) loads only when its route is
// visited, keeping the initial landing/login download small.
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const OAuth2RedirectHandler = lazy(() => import('./pages/OAuth2RedirectHandler'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

export default function App() {
  const dispatch = useAppDispatch()
  const { token, user } = useAppSelector((state) => state.auth)
  const theme = useAppSelector((state) => state.ui.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // On reload, a persisted token is present but the user object is not, so
  // rehydrate it from /api/users/me.
  useEffect(() => {
    if (token && !user) {
      dispatch(fetchCurrentUser())
    }
  }, [token, user, dispatch])

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/oauth2/redirect" element={<OAuth2RedirectHandler />} />
          <Route element={<PrivateRoute />}>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Suspense>
      <ToastViewport />
    </>
  )
}

function RouteFallback() {
  const { t } = useT()
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400"
        aria-label={t('common.loading')}
      />
    </div>
  )
}
