import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { client } from '../api/client'
import { disablePush, enablePush, isPushSubscribed, pushSupported } from '../push'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { changePassword, fetchCurrentUser, logout, updateMe } from '../features/auth/authSlice'
import { AVATAR_COLORS } from './Avatar'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [color, setColor] = useState<string | null>(user?.avatarColor ?? null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState(false)

  const [pushOn, setPushOn] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null)
  const [twoFaError, setTwoFaError] = useState(false)

  useEffect(() => {
    isPushSubscribed().then(setPushOn)
  }, [])

  const panelRef = useDialog<HTMLDivElement>(onClose)

  if (!user) return null

  const onSaveProfile = async () => {
    setProfileMsg(null)
    const result = await dispatch(
      updateMe({ displayName: displayName.trim() || undefined, avatarColor: color ?? '', avatarUrl: avatarUrl ?? '' }),
    )
    setProfileMsg(updateMe.fulfilled.match(result) ? 'Profil güncellendi ✓' : 'Güncellenemedi.')
  }

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProfileMsg(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await client.post<{ url: string }>('/api/uploads/image', form)
      setAvatarUrl(data.url)
    } catch {
      setProfileMsg('Fotoğraf yüklenemedi — bir resim mi ve 5 MB altında mı?')
    } finally {
      setUploading(false)
    }
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

  const togglePush = async () => {
    setPushMsg(null)
    if (pushOn) {
      await disablePush()
      setPushOn(false)
    } else {
      const ok = await enablePush()
      setPushOn(ok)
      if (!ok) setPushMsg('Bildirim açılamadı — izin verilmedi veya sunucuda yapılandırılmamış.')
    }
  }

  const onSetup2Fa = async () => {
    try {
      const { data } = await client.post<{ qrCodeUri: string }>('/api/2fa/setup')
      setQrCodeUri(data.qrCodeUri)
      setTwoFaMsg('Google Authenticator ile QR kodu taratın ve kodu girin.')
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || 'Kurulum başlatılamadı.')
      setTwoFaError(true)
    }
  }

  const onEnable2Fa = async () => {
    try {
      await client.post('/api/2fa/enable', { code: twoFaCode })
      dispatch(fetchCurrentUser())
      setQrCodeUri(null)
      setTwoFaCode('')
      setTwoFaMsg('2FA başarıyla etkinleştirildi ✓')
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || 'Geçersiz kod.')
      setTwoFaError(true)
    }
  }

  const onDisable2Fa = async () => {
    try {
      await client.post('/api/2fa/disable', { code: twoFaCode })
      dispatch(fetchCurrentUser())
      setTwoFaCode('')
      setTwoFaMsg('2FA devre dışı bırakıldı.')
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || 'Geçersiz kod.')
      setTwoFaError(true)
    }
  }

  const previewName = displayName.trim() || user.username

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ayarlar"
        tabIndex={-1}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-overlay p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Ayarlar</h3>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}
          >
            ✕
          </button>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <Avatar name={previewName} color={color} imageUrl={avatarUrl} />
          <div className="min-w-0 text-sm">
            <div className="font-medium text-fg">{previewName}</div>
            <div className="text-fg-muted">@{user.username}</div>
            <div className="mt-1 flex gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={`rounded-lg text-xs text-accent transition hover:text-accent-hover ${focusRing}`}
              >
                {uploading ? 'Yükleniyor…' : 'Fotoğraf yükle'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className={`rounded-lg text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
                >
                  Kaldır
                </button>
              )}
            </div>
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

        {/* Push notifications */}
        {pushSupported() && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="min-w-0">
              <div className="text-sm text-fg-secondary">Tarayıcı bildirimleri</div>
              {pushMsg && <div className="mt-0.5 text-xs text-fg-muted">{pushMsg}</div>}
            </div>
            <Button variant="secondary" size="sm" onClick={togglePush}>
              {pushOn ? 'Kapat' : 'Aç'}
            </Button>
          </div>
        )}

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

        {/* 2FA */}
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-fg-secondary">İki Aşamalı Doğrulama (2FA)</h4>
          {!user.isTwoFactorEnabled ? (
            <div>
              {!qrCodeUri ? (
                <Button onClick={onSetup2Fa} variant="secondary">2FA Kurulumunu Başlat</Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center rounded-xl bg-white p-4">
                    <img src={qrCodeUri} alt="2FA QR Code" className="h-40 w-40" />
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="6 haneli kodu girin"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                  />
                  <Button onClick={onEnable2Fa} disabled={twoFaCode.length !== 6}>
                    Onayla ve Etkinleştir
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-accent">2FA şu anda aktif.</p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Devre dışı bırakmak için kod"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                />
                <Button onClick={onDisable2Fa} variant="danger" disabled={twoFaCode.length !== 6}>
                  Kapat
                </Button>
              </div>
            </div>
          )}
          {twoFaMsg && (
            <div className={`mt-2 text-xs ${twoFaError ? 'text-danger' : 'text-fg-muted'}`}>{twoFaMsg}</div>
          )}
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
