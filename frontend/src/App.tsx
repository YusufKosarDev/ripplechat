import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { fetchCurrentUser } from './features/auth/authSlice'
import { applyTheme } from './theme'
import PrivateRoute from './components/PrivateRoute'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

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
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<PrivateRoute />}>
        <Route path="/chat" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}
