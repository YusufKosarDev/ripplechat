import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { changePassword, logout, updateMe } from '../features/auth/authSlice'
import { AVATAR_COLORS } from './Avatar'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'

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
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-overlay p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Ayarlar</h3>
          <button onClick={onClose} className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}>
            ✕
          </button>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <Avatar name={previewName} color={color} />
          <div className="text-sm">
            <div className="font-medium text-fg">{previewName}</div>
            <div className="text-fg-muted">@{user.username}</div>
          </div>
        </div>

        <label className="mt-4 mb-1 block text-sm text-fg-muted">Görünen ad</label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

        <label className="mt-3 mb-1 block text-sm text-fg-muted">Avatar rengi</label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              className={`h-7 w-7 rounded-full bg-${key}-500 transition ${focusRing} ${
                color === key ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900' : ''
              }`}
              title={key}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button onClick={onSaveProfile}>Profili kaydet</Button>
          {profileMsg && <span className="text-xs text-fg-muted">{profileMsg}</span>}
        </div>

        {/* Theme */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-fg-secondary">Tema</span>
          <ThemeToggle />
        </div>

        {/* Password */}
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-fg-secondary">Şifre değiştir</h4>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mevcut şifre"
            autoComplete="current-password"
            className="mb-2"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Yeni şifre (en az 8)"
            autoComplete="new-password"
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <Button onClick={onChangePassword} variant="secondary">
              Şifreyi değiştir
            </Button>
            {pwMsg && (
              <span className={`text-xs ${pwError ? 'text-danger' : 'text-fg-muted'}`}>{pwMsg}</span>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6 border-t border-border pt-4">
          <Button onClick={onLogout} variant="danger">
            Çıkış yap
          </Button>
        </div>
      </div>
    </div>
  )
}
