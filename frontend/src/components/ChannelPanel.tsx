import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { joinChannel } from '../features/channels/channelsSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { sendChatMessage, sendTyping, watchChannel } from '../realtime/chatSocket'
import type { TypingEvent } from '../api/types'
import PresenceDot from './PresenceDot'

const TYPING_TTL = 4000
const TYPING_STOP_DELAY = 2000

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChannelPanel() {
  const dispatch = useAppDispatch()
  const { items, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, loadError } = useAppSelector((state) => state.messages)
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

  // Incoming typing events for the active channel (kept in a ref so the
  // subscription handler never goes stale).
  const handleTyping = (event: TypingEvent) => {
    if (event.userId === currentUserIdRef.current) return // never show our own
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

  // On channel change: load history, (re)subscribe to messages + typing.
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
      <section className="flex flex-1 items-center justify-center text-slate-600">
        Soldan bir kanal seç ya da yeni bir kanal oluştur.
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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Kanala katıl
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-600">Henüz mesaj yok. İlk mesajı sen yaz.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <PresenceDot online={onlineUserIds.includes(msg.sender.id)} />
                  <span className="text-sm font-medium text-slate-200">
                    {msg.sender.displayName ?? msg.sender.username}
                  </span>
                  <span className="text-xs text-slate-600">{formatTime(msg.createdAt)}</span>
                </div>
                <p className="ml-4 text-sm text-slate-300">{msg.content}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-800 px-6 pb-4 pt-3">
            <div className="h-5 text-xs text-slate-500">{typingText}</div>
            <form onSubmit={onSend} className="flex gap-3">
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={`#${channel.name} kanalına yaz`}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-indigo-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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
