import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'

export default function HomePage() {
  const { user } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const onLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  if (!user) {
    return <div className="p-10 text-slate-400">Yükleniyor...</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Hoş geldin, <span className="text-indigo-400">{user.displayName ?? user.username}</span>
      </h1>
      <p className="mt-2 text-slate-400">RippleChat'e giriş yaptın.</p>

      <dl className="mt-8 space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Kullanıcı adı</dt>
          <dd className="text-slate-200">{user.username}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">E-posta</dt>
          <dd className="text-slate-200">{user.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Görünen ad</dt>
          <dd className="text-slate-200">{user.displayName ?? '—'}</dd>
        </div>
      </dl>

      <button
        onClick={onLogout}
        className="mt-8 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
      >
        Çıkış yap
      </button>
    </div>
  )
}
