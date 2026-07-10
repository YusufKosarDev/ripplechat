import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { client } from '../api/client'
import type { ActiveSession } from '../api/types'
import { disablePush, enablePush, isPushSubscribed, pushSupported } from '../push'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { changePassword, fetchCurrentUser, logout, updateMe } from '../features/auth/authSlice'
import { AVATAR_COLORS } from './Avatar'
import Avatar from './Avatar'
import StatusSettings from './StatusSettings'
import ThemeToggle from './ThemeToggle'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'
import { dateLocale, useT } from '../i18n'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, lang } = useT()
  const locale = dateLocale(lang)
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
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

  useEffect(() => {
    isPushSubscribed().then(setPushOn)
  }, [])

  const [sessions, setSessions] = useState<ActiveSession[]>([])

  useEffect(() => {
    client.get<ActiveSession[]>('/api/auth/sessions')
      .then((r) => setSessions(r.data))
      .catch(console.error)
  }, [])

  const onRevokeSession = async (id: string) => {
    try {
      await client.delete(`/api/auth/sessions/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Session revoke failed:', err)
    }
  }

  const parseUA = (uaString: string | null): string => {
    if (!uaString) return t('settings.unknownDevice')
    
    let os = t('settings.unknownOs')
    if (uaString.includes('Windows')) os = 'Windows'
    else if (uaString.includes('Macintosh') || uaString.includes('Mac OS')) os = 'macOS'
    else if (uaString.includes('Linux')) os = 'Linux'
    else if (uaString.includes('Android')) os = 'Android'
    else if (uaString.includes('iPhone') || uaString.includes('iPad')) os = 'iOS'

    let browser = t('settings.unknownBrowser')
    if (uaString.includes('Firefox')) browser = 'Firefox'
    else if (uaString.includes('Chrome') && !uaString.includes('Edg')) browser = 'Chrome'
    else if (uaString.includes('Edg')) browser = 'Edge'
    else if (uaString.includes('Safari') && !uaString.includes('Chrome')) browser = 'Safari'

    return `${browser} (${os})`
  }

  const panelRef = useDialog<HTMLDivElement>(onClose)

  if (!user) return null

  const onSaveProfile = async () => {
    setProfileMsg(null)
    const result = await dispatch(
      updateMe({ displayName: displayName.trim() || undefined, avatarColor: color ?? '', avatarUrl: avatarUrl ?? '' }),
    )
    setProfileMsg(updateMe.fulfilled.match(result) ? t('settings.profileUpdated') : t('settings.updateFailed'))
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
      setProfileMsg(t('settings.photoUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const onChangePassword = async () => {
    setPwMsg(null)
    setPwError(false)
    if (newPassword.length < 8) {
      setPwError(true)
      setPwMsg(t('settings.pwTooShort'))
      return
    }
    const result = await dispatch(changePassword({ currentPassword, newPassword }))
    if (changePassword.fulfilled.match(result)) {
      setPwMsg(t('settings.pwChanged'))
      setCurrentPassword('')
      setNewPassword('')
    } else {
      setPwError(true)
      setPwMsg((result.payload as string) ?? t('settings.pwChangeFailed'))
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
      if (!ok) setPushMsg(t('settings.pushEnableFailed'))
    }
  }

  const onSetup2Fa = async () => {
    try {
      const { data } = await client.post<{ qrCodeUri: string }>('/api/2fa/setup')
      setQrCodeUri(data.qrCodeUri)
      setTwoFaMsg(t('settings.twoFaScanQr'))
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || t('settings.twoFaSetupFailed'))
      setTwoFaError(true)
    }
  }

  const onEnable2Fa = async () => {
    try {
      const { data } = await client.post<{ recoveryCodes: string[] }>('/api/2fa/enable', { code: twoFaCode })
      dispatch(fetchCurrentUser())
      setQrCodeUri(null)
      setTwoFaCode('')
      setRecoveryCodes(data.recoveryCodes)
      setTwoFaMsg(t('settings.twoFaEnabled'))
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || t('settings.invalidCode'))
      setTwoFaError(true)
    }
  }

  const onRegenerateRecoveryCodes = async () => {
    try {
      const { data } = await client.post<{ recoveryCodes: string[] }>('/api/2fa/recovery-codes/regenerate', { code: twoFaCode })
      setTwoFaCode('')
      setRecoveryCodes(data.recoveryCodes)
      setTwoFaMsg(t('settings.recoveryRegenerated'))
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || t('settings.invalidCode'))
      setTwoFaError(true)
    }
  }

  const onExportData = async () => {
    try {
      const { data } = await client.get('/api/users/me/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ripplechat-data.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setDeleteMsg(t('settings.exportFailed'))
    }
  }

  const onDeleteAccount = async () => {
    try {
      await client.delete('/api/users/me', { data: { password: deletePassword } })
      dispatch(logout())
      navigate('/login')
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.detail : undefined
      setDeleteMsg(msg || t('settings.deleteFailed'))
    }
  }

  const onDisable2Fa = async () => {
    try {
      await client.post('/api/2fa/disable', { code: twoFaCode })
      dispatch(fetchCurrentUser())
      setTwoFaCode('')
      setTwoFaMsg(t('settings.twoFaDisabled'))
      setTwoFaError(false)
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'response' in e) ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined
      setTwoFaMsg(msg || t('settings.invalidCode'))
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
        aria-label={t('sidebar.settings')}
        tabIndex={-1}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-overlay p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">{t('sidebar.settings')}</h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
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
                {uploading ? t('common.loading') : t('settings.uploadPhoto')}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className={`rounded-lg text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
                >
                  {t('common.remove')}
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="mt-4 mb-1 block text-sm text-fg-muted">{t('settings.displayName')}</label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

        <label className="mt-3 mb-1 block text-sm text-fg-muted">{t('settings.avatarColor')}</label>
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
              <div className="text-sm text-fg-secondary">{t('settings.browserNotifs')}</div>
              {pushMsg && <div className="mt-0.5 text-xs text-fg-muted">{pushMsg}</div>}
            </div>
            <Button variant="secondary" size="sm" onClick={togglePush}>
              {pushOn ? t('settings.off') : t('settings.on')}
            </Button>
          </div>
        )}

        {/* Custom status + Do-Not-Disturb */}
        <StatusSettings />

        {/* Password */}
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('settings.changePw')}</h4>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t('settings.currentPw')}
            autoComplete="current-password"
            className="mb-2"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('settings.newPw')}
            autoComplete="new-password"
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <Button onClick={onChangePassword} variant="secondary">
              {t('settings.changePwBtn')}
            </Button>
            {pwMsg && (
              <span className={`text-xs ${pwError ? 'text-danger' : 'text-fg-muted'}`}>{pwMsg}</span>
            )}
          </div>
        </div>

        {/* 2FA */}
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('settings.twoFaTitle')}</h4>
          {!user.isTwoFactorEnabled ? (
            <div>
              {!qrCodeUri ? (
                <Button onClick={onSetup2Fa} variant="secondary">{t('settings.twoFaStart')}</Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center rounded-xl bg-white p-4">
                    <img src={qrCodeUri} alt="2FA QR Code" className="h-40 w-40" />
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={t('settings.twoFaCodePlaceholder')}
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                  />
                  <Button onClick={onEnable2Fa} disabled={twoFaCode.length !== 6}>
                    {t('settings.twoFaConfirm')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-accent">{t('settings.twoFaActive')}</p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder={t('settings.twoFaActionCode')}
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
              />
              <div className="flex gap-2">
                <Button onClick={onDisable2Fa} variant="danger" disabled={twoFaCode.length !== 6}>
                  {t('settings.off')}
                </Button>
                <Button onClick={onRegenerateRecoveryCodes} variant="secondary" disabled={twoFaCode.length !== 6}>
                  {t('settings.regenRecovery')}
                </Button>
              </div>
            </div>
          )}
          {twoFaMsg && (
            <div className={`mt-2 text-xs ${twoFaError ? 'text-danger' : 'text-fg-muted'}`}>{twoFaMsg}</div>
          )}
          {recoveryCodes && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {t('settings.recoveryInfo')}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm text-fg-secondary">
                {recoveryCodes.map((c) => (
                  <span key={c} className="select-all">{c}</span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
                >
                  {t('settings.copyCodes')}
                </Button>
                <Button variant="secondary" onClick={() => setRecoveryCodes(null)}>
                  {t('settings.off')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('settings.sessionsTitle')}</h4>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/40 p-3 text-xs">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-semibold text-fg">{parseUA(s.userAgent)}</div>
                  <div className="text-fg-faint mt-0.5">IP: {s.ipAddress || 'Bilinmeyen'}</div>
                  <div className="text-fg-faint">
                    {t('settings.lastActivity', { when: new Date(s.createdAt).toLocaleString(locale) })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRevokeSession(s.id)}
                  className="shrink-0 text-red-500 hover:text-red-600 font-medium cursor-pointer"
                >
                  {t('settings.endSession')}
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-xs text-fg-faint italic">{t('settings.noSessions')}</div>
            )}
          </div>
        </div>

        {/* Data & account (GDPR) */}
        <div className="mt-6 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('settings.dataTitle')}</h4>
          <Button onClick={onExportData} variant="secondary">
            {t('settings.exportBtn')}
          </Button>
          <p className="mt-1 text-xs text-fg-faint">
            {t('settings.exportHint')}
          </p>

          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => { setConfirmingDelete(true); setDeleteMsg(null) }}
              className="mt-3 text-sm text-red-500 underline hover:text-red-600 cursor-pointer"
            >
              {t('settings.deleteAccount')}
            </button>
          ) : (
            <div className="mt-3 space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs text-danger">
                {t('settings.deleteWarn')}
              </p>
              <Input
                type="password"
                placeholder={t('auth.password')}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
              {deleteMsg && <p className="text-xs text-danger">{deleteMsg}</p>}
              <div className="flex gap-2">
                <Button onClick={onDeleteAccount} variant="danger">
                  {t('settings.deleteForever')}
                </Button>
                <Button
                  onClick={() => { setConfirmingDelete(false); setDeletePassword(''); setDeleteMsg(null) }}
                  variant="secondary"
                >
                  {t('settings.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="mt-6 border-t border-border pt-4">
          <Button onClick={onLogout} variant="danger">
            {t('settings.logout')}
          </Button>
        </div>
      </div>
    </div>
  )
}
