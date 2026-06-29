import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { setDnd, setStatus } from '../features/auth/authSlice'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'

const STATUS_DURATIONS: { label: string; minutes: number | null }[] = [
  { label: 'Süresiz', minutes: null },
  { label: '30 dk', minutes: 30 },
  { label: '1 saat', minutes: 60 },
  { label: '4 saat', minutes: 240 },
]

const DND_DURATIONS: { label: string; minutes: number }[] = [
  { label: '30 dk', minutes: 30 },
  { label: '1 saat', minutes: 60 },
  { label: '8 saat', minutes: 480 },
]

/** Custom status (emoji + text, optional expiry) and Do-Not-Disturb controls. */
export default function StatusSettings() {
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
    setMsg(setStatus.fulfilled.match(r) ? 'Durum güncellendi ✓' : 'Durum güncellenemedi.')
  }
  const clearStatus = async () => {
    setEmoji('')
    setText('')
    const r = await dispatch(setStatus({ emoji: '', text: '', expiresInMinutes: null }))
    setMsg(setStatus.fulfilled.match(r) ? 'Durum temizlendi ✓' : 'Durum temizlenemedi.')
  }
  const changeDnd = async (m: number) => {
    const r = await dispatch(setDnd({ minutes: m }))
    setMsg(setDnd.fulfilled.match(r) ? (m > 0 ? 'Rahatsız etmeyin açıldı ✓' : 'Rahatsız etmeyin kapatıldı ✓') : 'İşlem başarısız.')
  }

  return (
    <>
      <div className="mt-6 border-t border-border pt-4">
        <h4 className="mb-2 text-sm font-medium text-fg-secondary">Durum</h4>
        <div className="flex gap-2">
          <div className="w-14 shrink-0">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🌴"
              aria-label="Durum emojisi"
              maxLength={8}
              className="text-center"
            />
          </div>
          <div className="flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ne yapıyorsun?"
              aria-label="Durum metni"
              maxLength={100}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={minutes ?? ''}
            onChange={(e) => setMinutes(e.target.value === '' ? null : Number(e.target.value))}
            aria-label="Durum süresi"
            className={`rounded-lg border border-control bg-surface px-2 py-1 text-sm text-fg ${focusRing}`}
          >
            {STATUS_DURATIONS.map((d) => (
              <option key={d.label} value={d.minutes ?? ''}>
                {d.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={saveStatus}>
            Kaydet
          </Button>
          <Button size="sm" variant="secondary" onClick={clearStatus}>
            Temizle
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <h4 className="mb-2 text-sm font-medium text-fg-secondary">Rahatsız etmeyin</h4>
        <p className="mb-2 text-xs text-fg-muted">
          {dndActive
            ? `Açık — ${new Date(user!.dndUntil!).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'e kadar bildirim yok.`
            : 'Bir süreliğine bildirimleri sustur.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {DND_DURATIONS.map((d) => (
            <Button key={d.minutes} size="sm" variant="secondary" onClick={() => changeDnd(d.minutes)}>
              {d.label}
            </Button>
          ))}
          {dndActive && (
            <Button size="sm" variant="danger" onClick={() => changeDnd(0)}>
              Kapat
            </Button>
          )}
        </div>
      </div>

      {msg && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">{msg}</p>}
    </>
  )
}
