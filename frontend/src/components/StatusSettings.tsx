import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { setDnd, setStatus } from '../features/auth/authSlice'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { dateLocale, useT } from '../i18n'

const STATUS_DURATIONS: { label: string; minutes: number | null }[] = [
  { label: 'dur.unlimited', minutes: null },
  { label: 'dur.30m', minutes: 30 },
  { label: 'dur.1h', minutes: 60 },
  { label: 'dur.4h', minutes: 240 },
]

const DND_DURATIONS: { label: string; minutes: number }[] = [
  { label: 'dur.30m', minutes: 30 },
  { label: 'dur.1h', minutes: 60 },
  { label: 'dur.8h', minutes: 480 },
]

/** Custom status (emoji + text, optional expiry) and Do-Not-Disturb controls. */
export default function StatusSettings() {
  const { t, lang } = useT()
  const locale = dateLocale(lang)
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)

  const [emoji, setEmoji] = useState(user?.statusEmoji ?? '')
  const [text, setText] = useState(user?.statusText ?? '')
  const [minutes, setMinutes] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // The server nulls dndUntil once it has elapsed, so presence is enough here.
  const dndActive = !!user?.dndUntil

  const saveStatus = async () => {
    const r = await dispatch(setStatus({ emoji: emoji.trim(), text: text.trim(), expiresInMinutes: minutes }))
    setMsg(setStatus.fulfilled.match(r) ? t('status.updated') : t('status.updateFailed'))
  }
  const clearStatus = async () => {
    setEmoji('')
    setText('')
    const r = await dispatch(setStatus({ emoji: '', text: '', expiresInMinutes: null }))
    setMsg(setStatus.fulfilled.match(r) ? t('status.cleared') : t('status.clearFailed'))
  }
  const changeDnd = async (m: number) => {
    const r = await dispatch(setDnd({ minutes: m }))
    setMsg(setDnd.fulfilled.match(r) ? (m > 0 ? t('status.dndOn') : t('status.dndOff')) : t('status.actionFailed'))
  }

  return (
    <>
      <div className="mt-6 border-t border-border pt-4">
        <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('status.title')}</h4>
        <div className="flex gap-2">
          <div className="w-14 shrink-0">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🌴"
              aria-label={t('status.emojiAria')}
              maxLength={8}
              className="text-center"
            />
          </div>
          <div className="flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('status.placeholder')}
              aria-label={t('status.textAria')}
              maxLength={100}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={minutes ?? ''}
            onChange={(e) => setMinutes(e.target.value === '' ? null : Number(e.target.value))}
            aria-label={t('status.durationAria')}
            className={`rounded-lg border border-control bg-surface px-2 py-1 text-sm text-fg ${focusRing}`}
          >
            {STATUS_DURATIONS.map((d) => (
              <option key={t(d.label)} value={d.minutes ?? ''}>
                {t(d.label)}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={saveStatus}>
            {t('msg.save')}
          </Button>
          <Button size="sm" variant="secondary" onClick={clearStatus}>
            {t('status.clear')}
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('status.dndTitle')}</h4>
        <p className="mb-2 text-xs text-fg-muted">
          {dndActive
            ? t('status.dndOnUntil', { time: new Date(user!.dndUntil!).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
            : t('status.dndHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {DND_DURATIONS.map((d) => (
            <Button key={d.minutes} size="sm" variant="secondary" onClick={() => changeDnd(d.minutes)}>
              {t(d.label)}
            </Button>
          ))}
          {dndActive && (
            <Button size="sm" variant="danger" onClick={() => changeDnd(0)}>
              {t('status.dndTurnOff')}
            </Button>
          )}
        </div>
      </div>

      {msg && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">{msg}</p>}
    </>
  )
}
