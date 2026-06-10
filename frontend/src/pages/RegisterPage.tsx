import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { register } from '../features/auth/authSlice'
import AuthShell from '../components/AuthShell'

const inputClass =
  'w-full rounded-lg border border-control bg-surface px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-faint focus:border-accent'

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { status, error } = useAppSelector((state) => state.auth)

  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setFormError('Kullanıcı adı, e-posta ve şifre zorunludur.')
      return
    }
    if (form.password.length < 8) {
      setFormError('Şifre en az 8 karakter olmalı.')
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
      navigate('/')
    }
  }

  return (
    <AuthShell title="Hesap oluştur">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-fg-muted">Kullanıcı adı</label>
          <input className={inputClass} value={form.username} onChange={update('username')} placeholder="neo" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">E-posta</label>
          <input className={inputClass} value={form.email} onChange={update('email')} placeholder="neo@ripplechat.io" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">Görünen ad (opsiyonel)</label>
          <input className={inputClass} value={form.displayName} onChange={update('displayName')} placeholder="Neo" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-muted">Şifre</label>
          <input
            type="password"
            className={inputClass}
            value={form.password}
            onChange={update('password')}
            placeholder="en az 8 karakter"
            autoComplete="new-password"
          />
        </div>

        {(formError || error) && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-danger">{formError || error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-60"
        >
          {status === 'loading' ? 'Oluşturuluyor...' : 'Kayıt ol'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Zaten hesabın var mı?{' '}
        <Link to="/login" className="text-accent hover:text-accent-hover">
          Giriş yap
        </Link>
      </p>
    </AuthShell>
  )
}
