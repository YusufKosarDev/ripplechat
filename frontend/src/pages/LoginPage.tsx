import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { login } from '../features/auth/authSlice'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Field'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { status, error } = useAppSelector((state) => state.auth)

  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!loginValue.trim() || !password) {
      setFormError('Kullanıcı adı/e-posta ve şifre zorunludur.')
      return
    }
    const result = await dispatch(login({ login: loginValue.trim(), password }))
    if (login.fulfilled.match(result)) {
      navigate('/chat')
    }
  }

  return (
    <AuthShell title="Giriş yap">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-fg-muted">Kullanıcı adı veya e-posta</label>
          <Input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            placeholder="neo"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">Şifre</label>
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
          {status === 'loading' ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Hesabın yok mu?{' '}
        <Link to="/register" className="text-accent hover:text-accent-hover">
          Kayıt ol
        </Link>
      </p>
    </AuthShell>
  )
}
