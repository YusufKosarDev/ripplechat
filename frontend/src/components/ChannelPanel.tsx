import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { joinChannel } from '../features/channels/channelsSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { sendChatMessage, sendTyping, watchChannel } from '../realtime/chatSocket'
import type { TypingEvent } from '../api/types'
import Avatar from './Avatar'

const TYPING_TTL = 4000
const TYPING_STOP_DELAY = 2000
const GROUP_WINDOW_MS = 5 * 60 * 1000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function sameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

function dateLabel(iso: string): string {
  const today = startOfDay(new Date())
  const that = startOfDay(new Date(iso))
  if (that === today) return 'Bugün'
  if (that === today - 86_400_000) return 'Dün'
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChannelPanel() {
  const dispatch = useAppDispatch()
  const { items, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, loadError, status: messagesStatus } = useAppSelector((state) => state.messages)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const currentUser = useAppSelector((state) => state.auth.user)

  const [draft, setDraft] = useState('')
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const currentUserIdRef = useRef<string | undefined>(undefined)
  currentUserIdRef.current = currentUser?.id

  const channel = items.find((c) => c.id === selectedId) ?? null
  const messages = selectedId ? (byChannel[selectedId] ?? []) : []
  const forbidden = loadError?.channelId === selectedId && loadError.forbidden
  const loadingMessages = messagesStatus === 'loading' && messages.length === 0

  const handleTyping = (event: TypingEvent) => {
    if (event.userId === currentUserIdRef.current) return
    const name = event.displayName ?? event.username
    if (event.typing) {
      setTypingUsers((prev) => ({ ...prev, [event.userId]: name }))
      clearTimeout(typingTimers.current[event.userId])
      typingTimers.current[event.userId] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev }
          delete next[event.userId]
          return next
        })
        delete typingTimers.current[event.userId]
      }, TYPING_TTL)
    } else {
      setTypingUsers((prev) => {
        const next = { ...prev }
        delete next[event.userId]
        return next
      })
      clearTimeout(typingTimers.current[event.userId])
      delete typingTimers.current[event.userId]
    }
  }
  const handleTypingRef = useRef(handleTyping)
  handleTypingRef.current = handleTyping

  useEffect(() => {
    if (!selectedId) return
    dispatch(fetchMessages(selectedId))
    watchChannel(
      selectedId,
      (msg) => dispatch(messageReceived(msg)),
      (event) => handleTypingRef.current(event),
    )
    setTypingUsers({})
    const timers = typingTimers.current
    return () => {
      if (isTypingRef.current) {
        sendTyping(selectedId, false)
        isTypingRef.current = false
      }
      if (stopTypingTimer.current) {
        clearTimeout(stopTypingTimer.current)
        stopTypingTimer.current = null
      }
      Object.values(timers).forEach(clearTimeout)
      typingTimers.current = {}
    }
  }, [selectedId, dispatch])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!selectedId || !channel) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/60 text-2xl">
          💬
        </div>
        <p className="mt-4 text-slate-400">Bir kanal seç veya yeni bir kanal oluştur.</p>
        <p className="mt-1 text-sm text-slate-600">Sohbet burada başlayacak.</p>
      </section>
    )
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (!isTypingRef.current) {
      sendTyping(channel.id, true)
      isTypingRef.current = true
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    stopTypingTimer.current = setTimeout(() => {
      sendTyping(channel.id, false)
      isTypingRef.current = false
    }, TYPING_STOP_DELAY)
  }

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    sendChatMessage(channel.id, content)
    setDraft('')
    if (isTypingRef.current) {
      sendTyping(channel.id, false)
      isTypingRef.current = false
    }
    if (stopTypingTimer.current) {
      clearTimeout(stopTypingTimer.current)
      stopTypingTimer.current = null
    }
  }

  const onJoin = async () => {
    await dispatch(joinChannel(channel.id))
    dispatch(fetchMessages(channel.id))
    watchChannel(
      channel.id,
      (msg) => dispatch(messageReceived(msg)),
      (event) => handleTypingRef.current(event),
    )
  }

  const typingNames = Object.values(typingUsers)
  let typingText = ''
  if (typingNames.length === 1) typingText = `${typingNames[0]} yazıyor...`
  else if (typingNames.length === 2) typingText = `${typingNames[0]} ve ${typingNames[1]} yazıyor...`
  else if (typingNames.length > 2) typingText = 'Birkaç kişi yazıyor...'

  return (
    <section className="flex flex-1 flex-col">
      <header className="border-b border-slate-800 px-6 py-4">
        <h2 className="font-semibold">
          <span className="text-slate-500">#</span> {channel.name}
        </h2>
        {channel.description && <p className="text-sm text-slate-500">{channel.description}</p>}
      </header>

      {forbidden ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-slate-400">Bu kanalın üyesi değilsin.</p>
          <button
            onClick={onJoin}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Kanala katıl
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingMessages && <MessageSkeleton />}

            {!loadingMessages && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-slate-400">Burada henüz mesaj yok.</p>
                <p className="mt-1 text-sm text-slate-600">İlk mesajı sen gönder.</p>
              </div>
            )}

            {!loadingMessages &&
              messages.map((msg, index) => {
                const prev = index > 0 ? messages[index - 1] : null
                const showDate = !prev || !sameDay(prev.createdAt, msg.createdAt)
                const grouped =
                  !showDate &&
                  prev !== null &&
                  prev.sender.id === msg.sender.id &&
                  new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS
                const senderName = msg.sender.displayName ?? msg.sender.username

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="my-3 flex items-center gap-3 text-xs text-slate-500">
                        <div className="h-px flex-1 bg-slate-800" />
                        <span>{dateLabel(msg.createdAt)}</span>
                        <div className="h-px flex-1 bg-slate-800" />
                      </div>
                    )}

                    {grouped ? (
                      <div className="group flex gap-3 pl-12">
                        <p className="text-sm text-slate-300">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-3">
                        <Avatar name={senderName} online={onlineUserIds.includes(msg.sender.id)} />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-slate-200">{senderName}</span>
                            <span className="text-xs text-slate-600">{formatTime(msg.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-300">{msg.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-800 px-6 pb-4 pt-3">
            <div className="h-5 text-xs text-slate-500">{typingText}</div>
            <form onSubmit={onSend} className="flex gap-3">
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={`#${channel.name} kanalına yaz`}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Gönder
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  )
}

function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-800" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800/70" />
          </div>
        </div>
      ))}
    </div>
  )
}
