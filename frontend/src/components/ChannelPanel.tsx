import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { joinChannel } from '../features/channels/channelsSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { fetchPolls, pollUpserted, setMyVote } from '../features/polls/pollsSlice'
import {
  sendChatMessage,
  sendPoll,
  sendPollVote,
  sendReaction,
  sendTyping,
  watchChannel,
} from '../realtime/chatSocket'
import { parseCommand } from '../commands/registry'
import type { Poll, ReactionEvent, TypingEvent } from '../api/types'
import Avatar from './Avatar'
import MessageContent from './MessageContent'
import CommandHints from './CommandHints'
import PollCard from './PollCard'
import ReactionBar from './ReactionBar'
import ReactionOverlay from './ReactionOverlay'
import type { FlyingEmoji } from './ReactionOverlay'

const TYPING_TTL = 4000
const TYPING_STOP_DELAY = 2000
const GROUP_WINDOW_MS = 5 * 60 * 1000
const MAX_FLYING = 40

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

function makeFlyingEmoji(emoji: string): FlyingEmoji {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())
  return {
    id,
    emoji,
    left: 15 + Math.random() * 70,
    drift: (20 + Math.random() * 60) * (Math.random() < 0.5 ? -1 : 1),
    duration: 2.6 + Math.random() * 1.2,
    size: 1.6 + Math.random() * 0.8,
  }
}

export default function ChannelPanel() {
  const dispatch = useAppDispatch()
  const { items, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, loadError, status: messagesStatus } = useAppSelector((state) => state.messages)
  const pollsByChannel = useAppSelector((state) => state.polls.byChannel)
  const myVotes = useAppSelector((state) => state.polls.myVotes)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const currentUser = useAppSelector((state) => state.auth.user)

  const [draft, setDraft] = useState('')
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [flying, setFlying] = useState<FlyingEmoji[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const reactionTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const currentUserIdRef = useRef<string | undefined>(undefined)
  currentUserIdRef.current = currentUser?.id

  const channel = items.find((c) => c.id === selectedId) ?? null
  const messages = selectedId ? (byChannel[selectedId] ?? []) : []
  const polls = selectedId ? (pollsByChannel[selectedId] ?? []) : []
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

  const handleReaction = (event: ReactionEvent) => {
    const item = makeFlyingEmoji(event.emoji)
    setFlying((prev) => (prev.length >= MAX_FLYING ? [...prev.slice(1), item] : [...prev, item]))
    const timer = setTimeout(() => {
      setFlying((prev) => prev.filter((f) => f.id !== item.id))
      reactionTimers.current.delete(timer)
    }, item.duration * 1000 + 300)
    reactionTimers.current.add(timer)
  }
  const handleReactionRef = useRef(handleReaction)
  handleReactionRef.current = handleReaction

  const subscribe = (channelId: string) => {
    watchChannel(channelId, {
      onMessage: (msg) => dispatch(messageReceived(msg)),
      onTyping: (event) => handleTypingRef.current(event),
      onReaction: (event) => handleReactionRef.current(event),
      onPoll: (poll: Poll) => dispatch(pollUpserted(poll)),
    })
  }

  useEffect(() => {
    if (!selectedId) return
    dispatch(fetchMessages(selectedId))
    dispatch(fetchPolls(selectedId))
    subscribe(selectedId)
    setTypingUsers({})
    setFlying([])
    setCmdError(null)
    const typing = typingTimers.current
    const reactions = reactionTimers.current
    return () => {
      if (isTypingRef.current) {
        sendTyping(selectedId, false)
        isTypingRef.current = false
      }
      if (stopTypingTimer.current) {
        clearTimeout(stopTypingTimer.current)
        stopTypingTimer.current = null
      }
      Object.values(typing).forEach(clearTimeout)
      typingTimers.current = {}
      reactions.forEach(clearTimeout)
      reactions.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const stopTyping = () => {
    if (isTypingRef.current) {
      sendTyping(channel.id, false)
      isTypingRef.current = false
    }
    if (stopTypingTimer.current) {
      clearTimeout(stopTypingTimer.current)
      stopTypingTimer.current = null
    }
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    setCmdError(null)
    if (value.startsWith('/')) return // don't broadcast typing while composing a command
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

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    setCmdError(null)

    if (text.startsWith('/')) {
      const parsed = parseCommand(text)!
      if (!parsed.command) {
        setCmdError(`Bilinmeyen komut: /${parsed.name}`)
        return
      }
      let hadError = false
      parsed.command.run({
        channelId: channel.id,
        args: parsed.args,
        sendMessage: (content) => sendChatMessage(channel.id, content),
        createPoll: (question, options) => sendPoll(channel.id, question, options),
        showError: (message) => {
          hadError = true
          setCmdError(message)
        },
      })
      if (!hadError) setDraft('')
    } else {
      sendChatMessage(channel.id, text)
      setDraft('')
    }
    stopTyping()
  }

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const onJoin = async () => {
    await dispatch(joinChannel(channel.id))
    dispatch(fetchMessages(channel.id))
    dispatch(fetchPolls(channel.id))
    subscribe(channel.id)
  }

  const onVote = (poll: Poll, optionId: string) => {
    dispatch(setMyVote({ pollId: poll.id, optionId }))
    sendPollVote(channel.id, poll.id, optionId)
  }

  const onPickCommand = (name: string) => {
    setDraft(`/${name} `)
    inputRef.current?.focus()
  }

  const typingNames = Object.values(typingUsers)
  let typingText = ''
  if (typingNames.length === 1) typingText = `${typingNames[0]} yazıyor...`
  else if (typingNames.length === 2) typingText = `${typingNames[0]} ve ${typingNames[1]} yazıyor...`
  else if (typingNames.length > 2) typingText = 'Birkaç kişi yazıyor...'

  const showHints = draft.startsWith('/') && !draft.includes(' ')

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
          <div className="relative flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto px-6 py-4">
              {polls.length > 0 && (
                <div className="mb-4 space-y-3">
                  {polls.map((poll) => (
                    <PollCard
                      key={poll.id}
                      poll={poll}
                      myVote={myVotes[poll.id]}
                      onVote={(optionId) => onVote(poll, optionId)}
                    />
                  ))}
                </div>
              )}

              {loadingMessages && <MessageSkeleton />}

              {!loadingMessages && messages.length === 0 && polls.length === 0 && (
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
                        <div className="pl-12">
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
                            <MessageContent content={msg.content} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              <div ref={bottomRef} />
            </div>

            <ReactionOverlay items={flying} />
          </div>

          <div className="border-t border-slate-800 px-6 pb-4 pt-3">
            {showHints && <CommandHints prefix={draft.slice(1)} onPick={onPickCommand} />}
            <div className="mb-2 flex items-center justify-between">
              <ReactionBar onReact={(emoji) => sendReaction(channel.id, emoji)} />
              <span className="text-xs text-slate-500">{typingText}</span>
            </div>
            {cmdError && <p className="mb-2 text-xs text-red-400">{cmdError}</p>}
            <form onSubmit={onSend} className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                rows={1}
                placeholder={`#${channel.name} kanalına yaz  ·  /poll, /giphy, /shrug`}
                className="max-h-40 flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Gönder
              </button>
            </form>
            <p className="mt-1.5 text-[11px] text-slate-600">
              Markdown destekli · <span className="text-slate-500">**kalın**</span>{' '}
              <span className="text-slate-500">*italik*</span>{' '}
              <span className="text-slate-500">`kod`</span> · ``` ile kod bloğu · Enter gönderir, Shift+Enter yeni satır
            </p>
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
