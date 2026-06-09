import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { changePassword, logout, updateMe } from '../features/auth/authSlice'
import { AVATAR_COLORS } from './Avatar'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-600'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [color, setColor] = useState<string | null>(user?.avatarColor ?? null)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState(false)

  if (!user) return null

  const onSaveProfile = async () => {
    setProfileMsg(null)
    const result = await dispatch(updateMe({ displayName: displayName.trim() || undefined, avatarColor: color ?? '' }))
    setProfileMsg(updateMe.fulfilled.match(result) ? 'Profil güncellendi ✓' : 'Güncellenemedi.')
  }

  const onChangePassword = async () => {
    setPwMsg(null)
    setPwError(false)
    if (newPassword.length < 8) {
      setPwError(true)
      setPwMsg('Yeni şifre en az 8 karakter olmalı.')
      return
    }
    const result = await dispatch(changePassword({ currentPassword, newPassword }))
    if (changePassword.fulfilled.match(result)) {
      setPwMsg('Şifre değiştirildi ✓')
      setCurrentPassword('')
      setNewPassword('')
    } else {
      setPwError(true)
      setPwMsg((result.payload as string) ?? 'Şifre değiştirilemedi.')
    }
  }

  const onLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const previewName = displayName.trim() || user.username

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ayarlar</h3>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-300">
            ✕
          </button>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <Avatar name={previewName} color={color} />
          <div className="text-sm">
            <div className="font-medium text-slate-800 dark:text-slate-200">{previewName}</div>
            <div className="text-slate-500">@{user.username}</div>
          </div>
        </div>

        <label className="mt-4 mb-1 block text-sm text-slate-600 dark:text-slate-400">Görünen ad</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />

        <label className="mt-3 mb-1 block text-sm text-slate-600 dark:text-slate-400">Avatar rengi</label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              className={`h-7 w-7 rounded-full bg-${key}-500 transition ${
                color === key ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900' : ''
              }`}
              title={key}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={onSaveProfile}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white transition hover:bg-indigo-500"
          >
            Profili kaydet
          </button>
          {profileMsg && <span className="text-xs text-slate-500">{profileMsg}</span>}
        </div>

        {/* Theme */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <span className="text-sm text-slate-600 dark:text-slate-300">Tema</span>
          <ThemeToggle />
        </div>

        {/* Password */}
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Şifre değiştir</h4>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mevcut şifre"
            autoComplete="current-password"
            className={`mb-2 ${inputClass}`}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Yeni şifre (en az 8)"
            autoComplete="new-password"
            className={`mb-2 ${inputClass}`}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={onChangePassword}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Şifreyi değiştir
            </button>
            {pwMsg && (
              <span className={`text-xs ${pwError ? 'text-red-500 dark:text-red-400' : 'text-slate-500'}`}>{pwMsg}</span>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            onClick={onLogout}
            className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
          >
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  )
}
