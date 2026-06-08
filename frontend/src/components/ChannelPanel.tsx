import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { joinChannel } from '../features/channels/channelsSlice'
import {
  fetchMessages,
  messageReactionsUpdated,
  messageReceived,
  messageUpdated,
  threadSummaryUpdated,
} from '../features/messages/messagesSlice'
import { channelRemoved, fetchMembers } from '../features/channels/channelsSlice'
import { fetchPolls, pollUpserted, setMyVote } from '../features/polls/pollsSlice'
import { closeThread, openThread, threadReplyUpdated } from '../features/threads/threadsSlice'
import { clearUnread } from '../features/unread/unreadSlice'
import ChannelMembersModal from './ChannelMembersModal'
import {
  sendChatMessage,
  sendDeleteMessage,
  sendEditMessage,
  sendMessageReaction,
  sendPoll,
  sendPollVote,
  sendReaction,
  sendTyping,
  watchChannel,
} from '../realtime/chatSocket'
import { parseCommand } from '../commands/registry'
import type { Message, Poll, ReactionEvent, TypingEvent } from '../api/types'
import Avatar from './Avatar'
import MessageContent from './MessageContent'
import MessageReactions from './MessageReactions'
import CommandHints from './CommandHints'
import PollCard from './PollCard'
import ReactionBar from './ReactionBar'
import ReactionOverlay from './ReactionOverlay'
import type { FlyingEmoji } from './ReactionOverlay'

const TYPING_TTL = 4000
const TYPING_STOP_DELAY = 2000
const GROUP_WINDOW_MS = 5 * 60 * 1000
const MAX_FLYING = 40

const borderC = 'border-slate-200 dark:border-slate-800'
const composerInput =
  'flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-600'

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

interface ChannelPanelProps {
  onOpenSidebar: () => void
}

export default function ChannelPanel({ onOpenSidebar }: ChannelPanelProps) {
  const dispatch = useAppDispatch()
  const { items, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, loadError, status: messagesStatus } = useAppSelector((state) => state.messages)
  const pollsByChannel = useAppSelector((state) => state.polls.byChannel)
  const myVotes = useAppSelector((state) => state.polls.myVotes)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const membersByChannel = useAppSelector((state) => state.channels.membersByChannel)
  const currentUser = useAppSelector((state) => state.auth.user)

  const [draft, setDraft] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [flying, setFlying] = useState<FlyingEmoji[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

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
  const members = selectedId ? (membersByChannel[selectedId] ?? []) : []
  const myRole = members.find((m) => m.user.id === currentUser?.id)?.role
  const canModerate = myRole === 'OWNER' || myRole === 'MODERATOR'

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
      onMessageReaction: (update) =>
        dispatch(
          messageReactionsUpdated({
            channelId,
            messageId: update.messageId,
            reactions: update.reactions,
          }),
        ),
      onMessageUpdate: (updated) => {
        if (updated.parentMessageId) {
          dispatch(threadReplyUpdated(updated))
        } else {
          dispatch(messageUpdated(updated))
        }
      },
      onThreadUpdate: (update) =>
        dispatch(
          threadSummaryUpdated({
            channelId,
            parentMessageId: update.parentMessageId,
            thread: update.thread,
          }),
        ),
      onChannelDeleted: () => {
        dispatch(closeThread())
        dispatch(channelRemoved(channelId))
      },
      onPoll: (poll: Poll) => dispatch(pollUpserted(poll)),
    })
  }

  useEffect(() => {
    if (!selectedId) return
    dispatch(fetchMessages(selectedId))
    dispatch(fetchPolls(selectedId))
    dispatch(fetchMembers(selectedId))
    subscribe(selectedId)
    dispatch(clearUnread(selectedId))
    dispatch(closeThread())
    setShowMembers(false)
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
      <section className="flex flex-1 flex-col">
        <div className={`flex items-center border-b px-4 py-3 md:hidden ${borderC}`}>
          <button
            onClick={onOpenSidebar}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            ☰ Kanallar
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-2xl dark:bg-slate-800/60">
            💬
          </div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Bir kanal seç veya yeni bir kanal oluştur.</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">Sohbet burada başlayacak.</p>
        </div>
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
    if (value.startsWith('/')) return
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

  const startEdit = (msg: Message) => {
    setEditingId(msg.id)
    setEditDraft(msg.content)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }
  const saveEdit = (msg: Message) => {
    const content = editDraft.trim()
    if (content) sendEditMessage(channel.id, msg.id, content)
    setEditingId(null)
    setEditDraft('')
  }
  const onDelete = (msg: Message) => {
    if (window.confirm('Bu mesajı silmek istediğine emin misin?')) {
      sendDeleteMessage(channel.id, msg.id)
    }
  }

  const renderBody = (msg: Message) => {
    if (msg.deleted) {
      return <p className="text-sm italic text-slate-400 dark:text-slate-500">Bu mesaj silindi</p>
    }
    if (editingId === msg.id) {
      return (
        <div className="mt-1">
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                saveEdit(msg)
              }
              if (e.key === 'Escape') cancelEdit()
            }}
            rows={2}
            autoFocus
            className={`w-full ${composerInput}`}
          />
          <div className="mt-1 flex gap-2 text-xs">
            <button onClick={() => saveEdit(msg)} className="rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-500">
              Kaydet
            </button>
            <button
              onClick={cancelEdit}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
            >
              İptal
            </button>
          </div>
        </div>
      )
    }
    const mine = msg.sender.id === currentUser?.id
    const canDelete = mine || canModerate
    return (
      <div>
        <MessageContent content={msg.content} />
        {msg.editedAt && <span className="text-[11px] text-slate-400 dark:text-slate-600">(düzenlendi)</span>}
        {(mine || canDelete) && (
          <span className="ml-2 hidden gap-2 text-xs text-slate-500 group-hover:inline-flex">
            {mine && (
              <button onClick={() => startEdit(msg)} className="hover:text-slate-800 dark:hover:text-slate-300">
                Düzenle
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(msg)} className="hover:text-red-500 dark:hover:text-red-400">
                Sil
              </button>
            )}
          </span>
        )}
      </div>
    )
  }

  const typingNames = Object.values(typingUsers)
  let typingText = ''
  if (typingNames.length === 1) typingText = `${typingNames[0]} yazıyor...`
  else if (typingNames.length === 2) typingText = `${typingNames[0]} ve ${typingNames[1]} yazıyor...`
  else if (typingNames.length > 2) typingText = 'Birkaç kişi yazıyor...'

  const showHints = draft.startsWith('/') && !draft.includes(' ')

  return (
    <section className="flex flex-1 flex-col">
      <header className={`flex items-center justify-between gap-3 border-b px-4 py-4 md:px-6 ${borderC}`}>
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 transition hover:border-slate-400 md:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
            title="Kanallar"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">
              <span className="text-slate-400 dark:text-slate-500">#</span> {channel.name}
            </h2>
            {channel.description && <p className="truncate text-sm text-slate-500">{channel.description}</p>}
          </div>
        </div>
        <button
          onClick={() => setShowMembers(true)}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
        >
          Üyeler ({members.length})
        </button>
      </header>

      {showMembers && (
        <ChannelMembersModal
          channelId={channel.id}
          members={members}
          myRole={myRole}
          currentUserId={currentUser?.id}
          onClose={() => setShowMembers(false)}
        />
      )}

      {forbidden ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-slate-500 dark:text-slate-400">Bu kanalın üyesi değilsin.</p>
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
                  <p className="text-slate-500 dark:text-slate-400">Burada henüz mesaj yok.</p>
                  <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">İlk mesajı sen gönder.</p>
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
                    <div key={msg.id} className="group">
                      {showDate && (
                        <div className="my-3 flex items-center gap-3 text-xs text-slate-500">
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                          <span>{dateLabel(msg.createdAt)}</span>
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>
                      )}

                      {grouped ? (
                        <div className="pl-12">{renderBody(msg)}</div>
                      ) : (
                        <div className="mt-3 flex gap-3">
                          <Avatar name={senderName} online={onlineUserIds.includes(msg.sender.id)} />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{senderName}</span>
                              <span className="text-xs text-slate-400 dark:text-slate-600">{formatTime(msg.createdAt)}</span>
                            </div>
                            {renderBody(msg)}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pl-12">
                        {msg.thread.replyCount > 0 && (
                          <button
                            onClick={() => dispatch(openThread(msg.id))}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-indigo-600 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:text-indigo-300 dark:hover:border-slate-500"
                          >
                            <span className="flex -space-x-1.5">
                              {msg.thread.lastRepliers.map((u) => (
                                <Avatar key={u.id} name={u.displayName ?? u.username} size="sm" />
                              ))}
                            </span>
                            💬 {msg.thread.replyCount} yanıt
                          </button>
                        )}
                        {!msg.deleted && (
                          <button
                            onClick={() => dispatch(openThread(msg.id))}
                            className="mt-1 hidden text-xs text-slate-500 transition hover:text-slate-800 group-hover:inline dark:hover:text-slate-300"
                          >
                            Yanıtla
                          </button>
                        )}
                      </div>
                      {!msg.deleted && (
                        <div className="pl-12">
                          <MessageReactions
                            reactions={msg.reactions}
                            currentUsername={currentUser?.username ?? ''}
                            onToggle={(emoji) => sendMessageReaction(channel.id, msg.id, emoji)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              <div ref={bottomRef} />
            </div>

            <ReactionOverlay items={flying} />
          </div>

          <div className={`border-t px-6 pb-4 pt-3 ${borderC}`}>
            {showHints && <CommandHints prefix={draft.slice(1)} onPick={onPickCommand} />}
            <div className="mb-2 flex items-center justify-between gap-2">
              <ReactionBar onReact={(emoji) => sendReaction(channel.id, emoji)} />
              <span className="min-w-0 flex-1 truncate text-right text-xs text-slate-500">{typingText}</span>
            </div>
            {cmdError && <p className="mb-2 text-xs text-red-500 dark:text-red-400">{cmdError}</p>}
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
                className={`max-h-40 ${composerInput}`}
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Gönder
              </button>
            </form>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-600">
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
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
        </div>
      ))}
    </div>
  )
}
