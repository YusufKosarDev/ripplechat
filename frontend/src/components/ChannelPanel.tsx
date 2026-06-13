import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { client } from '../api/client'
import { joinChannel } from '../features/channels/channelsSlice'
import {
  fetchMessages,
  fetchOlderMessages,
  messageReactionsUpdated,
  messageReceived,
  messageUpdated,
  threadSummaryUpdated,
} from '../features/messages/messagesSlice'
import { channelRemoved, fetchMembers } from '../features/channels/channelsSlice'
import { fetchPolls, pollUpserted, setMyVote } from '../features/polls/pollsSlice'
import { closeThread, openThread, threadReplyUpdated } from '../features/threads/threadsSlice'
import { fetchReads, readReceived } from '../features/reads/readsSlice'
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
  sendRead,
  sendTyping,
  watchChannel,
} from '../realtime/chatSocket'
import { parseCommand } from '../commands/registry'
import type { Channel, DirectChannel, Message, Poll, ReactionEvent, TypingEvent } from '../api/types'
import Avatar from './Avatar'
import MessageContent from './MessageContent'
import MessageReactions from './MessageReactions'
import CommandHints from './CommandHints'
import PollCard from './PollCard'
import ReactionBar from './ReactionBar'
import ReactionOverlay from './ReactionOverlay'
import type { FlyingEmoji } from './ReactionOverlay'
import Button from './ui/Button'
import { Textarea } from './ui/Field'
import { focusRing } from './ui/focusRing'

const TYPING_TTL = 4000
const TYPING_STOP_DELAY = 2000
const GROUP_WINDOW_MS = 5 * 60 * 1000
const MAX_FLYING = 40

const borderC = 'border-border'

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

// Presents a selected direct message as a channel so the panel can render it
// with the existing message/typing/reaction machinery unchanged.
function dmAsChannel(dm: DirectChannel): Channel {
  return {
    id: dm.id,
    name: dm.otherUser.displayName ?? dm.otherUser.username,
    description: null,
    isPrivate: true,
    createdBy: dm.otherUser,
    createdAt: dm.createdAt,
  }
}

interface ChannelPanelProps {
  onOpenSidebar: () => void
}

export default function ChannelPanel({ onOpenSidebar }: ChannelPanelProps) {
  const dispatch = useAppDispatch()
  const { items, dms, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, paging, loadError, status: messagesStatus } = useAppSelector((state) => state.messages)
  const pollsByChannel = useAppSelector((state) => state.polls.byChannel)
  const myVotes = useAppSelector((state) => state.polls.myVotes)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const membersByChannel = useAppSelector((state) => state.channels.membersByChannel)
  const currentUser = useAppSelector((state) => state.auth.user)
  const reads = useAppSelector((state) => (selectedId ? state.reads.byChannel[selectedId] : undefined))

  const [draft, setDraft] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [flying, setFlying] = useState<FlyingEmoji[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [attachment, setAttachment] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevHeightRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const reactionTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const currentUserIdRef = useRef<string | undefined>(undefined)
  currentUserIdRef.current = currentUser?.id

  const dm = selectedId ? (dms.find((d) => d.id === selectedId) ?? null) : null
  const channel = items.find((c) => c.id === selectedId) ?? (dm ? dmAsChannel(dm) : null)
  const otherLastRead = dm ? reads?.[dm.otherUser.id] : undefined
  const messages = selectedId ? (byChannel[selectedId] ?? []) : []
  const channelPaging = selectedId ? paging[selectedId] : undefined
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
      onRead: (receipt) => dispatch(readReceived(receipt)),
    })
  }

  useEffect(() => {
    if (!selectedId) return
    prevHeightRef.current = null
    dispatch(fetchMessages(selectedId))
    dispatch(fetchPolls(selectedId))
    dispatch(fetchMembers(selectedId))
    dispatch(fetchReads(selectedId))
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

  // Keep the viewport pinned to the newest message — except when older history
  // was just prepended (scroll-up), where we restore the prior position.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prevHeightRef.current != null) {
      el.scrollTop += el.scrollHeight - prevHeightRef.current
      prevHeightRef.current = null
    } else {
      el.scrollTop = el.scrollHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages.length])

  // Mark the channel read while it's open (on load and as new messages arrive).
  useEffect(() => {
    if (selectedId && messages.length > 0) sendRead(selectedId)
  }, [selectedId, messages.length])

  const onMessagesScroll = () => {
    const el = scrollRef.current
    if (!el || !selectedId || !channelPaging) return
    if (el.scrollTop < 80 && channelPaging.hasMore && !channelPaging.loadingOlder) {
      prevHeightRef.current = el.scrollHeight // anchor so the view doesn't jump on prepend
      dispatch(fetchOlderMessages({ channelId: selectedId, page: channelPaging.nextPage }))
    }
  }

  if (!selectedId || !channel) {
    return (
      <section className="flex flex-1 flex-col">
        <div className={`flex items-center border-b px-4 py-3 md:hidden ${borderC}`}>
          <Button variant="secondary" onClick={onOpenSidebar}>
            ☰ Kanallar
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">
            💬
          </div>
          <p className="mt-4 font-medium text-fg">Bir kanal seç veya yeni bir kanal oluştur.</p>
          <p className="mt-1 text-sm text-fg-muted">Sohbet burada başlayacak.</p>
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
    if (!text && !attachment) return
    setCmdError(null)

    // Slash commands apply to plain text only (not when an image is attached).
    if (text.startsWith('/') && !attachment) {
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
      sendChatMessage(channel.id, text, undefined, attachment ?? undefined)
      setDraft('')
      setAttachment(null)
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

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again later
    if (!file) return
    setCmdError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await client.post<{ url: string }>('/api/uploads/image', form)
      setAttachment(data.url)
    } catch {
      setCmdError('Görsel yüklenemedi — tür bir resim mi ve 5 MB altında mı?')
    } finally {
      setUploading(false)
    }
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
      return <p className="text-sm italic text-fg-faint">Bu mesaj silindi</p>
    }
    if (editingId === msg.id) {
      return (
        <div className="mt-1">
          <Textarea
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
          />
          <div className="mt-1 flex gap-2">
            <Button onClick={() => saveEdit(msg)} size="sm">
              Kaydet
            </Button>
            <Button onClick={cancelEdit} variant="secondary" size="sm">
              İptal
            </Button>
          </div>
        </div>
      )
    }
    const mine = msg.sender.id === currentUser?.id
    const canDelete = mine || canModerate
    const readByOther =
      !!otherLastRead && new Date(otherLastRead).getTime() >= new Date(msg.createdAt).getTime()
    return (
      <div>
        {msg.content && <MessageContent content={msg.content} />}
        {msg.attachmentUrl && (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block w-fit">
            <img
              src={msg.attachmentUrl}
              alt="ek görsel"
              loading="lazy"
              className="max-h-80 max-w-sm rounded-lg border border-border"
            />
          </a>
        )}
        {msg.editedAt && <span className="text-xs text-fg-faint">(düzenlendi)</span>}
        {dm && mine && !msg.deleted && (
          <span
            title={readByOther ? 'Okundu' : 'İletildi'}
            className={`ml-1.5 align-middle text-xs ${readByOther ? 'text-accent' : 'text-fg-faint'}`}
          >
            ✓✓
          </span>
        )}
        {(mine || canDelete) && (
          <span className="ml-2 inline-flex gap-2 text-xs text-fg-muted sr-only group-hover:not-sr-only group-focus-within:not-sr-only">
            {mine && (
              <button onClick={() => startEdit(msg)} className={`rounded-lg hover:text-fg ${focusRing}`}>
                Düzenle
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(msg)} className={`rounded-lg hover:text-danger ${focusRing}`}>
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
          <Button variant="secondary" size="sm" onClick={onOpenSidebar} className="shrink-0 md:hidden" title="Kanallar">
            ☰
          </Button>
          {dm ? (
            <>
              <Avatar
                name={channel.name}
                color={dm.otherUser.avatarColor}
                imageUrl={dm.otherUser.avatarUrl}
                online={onlineUserIds.includes(dm.otherUser.id)}
                size="sm"
              />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight">{channel.name}</h2>
                <p className="truncate text-sm text-fg-muted">Direkt mesaj</p>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight">
                <span className="text-fg-faint">#</span> {channel.name}
              </h2>
              {channel.description && <p className="truncate text-sm text-fg-muted">{channel.description}</p>}
            </div>
          )}
        </div>
        {!dm && (
          <Button variant="secondary" size="sm" onClick={() => setShowMembers(true)} className="shrink-0">
            Üyeler ({members.length})
          </Button>
        )}
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
          <p className="text-fg-muted">Bu kanalın üyesi değilsin.</p>
          <Button onClick={onJoin}>Kanala katıl</Button>
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden">
            <div ref={scrollRef} onScroll={onMessagesScroll} className="h-full overflow-y-auto px-6 py-4">
              {channelPaging?.loadingOlder && (
                <div className="py-2 text-center text-xs text-fg-muted">Daha eski mesajlar yükleniyor…</div>
              )}
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">
                    👋
                  </div>
                  <p className="mt-4 font-medium text-fg">Burada henüz mesaj yok.</p>
                  <p className="mt-1 text-sm text-fg-muted">İlk mesajı sen gönder.</p>
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
                    <div
                      key={msg.id}
                      className="group -mx-2 rounded-lg px-2 transition-colors hover:bg-surface-muted/50"
                    >
                      {showDate && (
                        <div className="my-3 flex items-center gap-3">
                          <div className="h-px flex-1 bg-border" />
                          <span className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-fg-muted">
                            {dateLabel(msg.createdAt)}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}

                      {grouped ? (
                        <div className="pl-12">{renderBody(msg)}</div>
                      ) : (
                        <div className="mt-3 flex gap-3">
                          <Avatar name={senderName} color={msg.sender.avatarColor} imageUrl={msg.sender.avatarUrl} online={onlineUserIds.includes(msg.sender.id)} />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-fg">{senderName}</span>
                              <span className="text-xs text-fg-faint">{formatTime(msg.createdAt)}</span>
                            </div>
                            {renderBody(msg)}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pl-12">
                        {msg.thread.replyCount > 0 && (
                          <button
                            onClick={() => dispatch(openThread(msg.id))}
                            className={`mt-1 inline-flex items-center gap-1.5 rounded-lg border border-control bg-surface-muted px-2 py-1 text-xs text-accent transition hover:border-control-hover ${focusRing}`}
                          >
                            <span className="flex -space-x-1.5">
                              {msg.thread.lastRepliers.map((u) => (
                                <Avatar key={u.id} name={u.displayName ?? u.username} color={u.avatarColor} imageUrl={u.avatarUrl} size="sm" />
                              ))}
                            </span>
                            💬 {msg.thread.replyCount} yanıt
                          </button>
                        )}
                        {!msg.deleted && (
                          <button
                            onClick={() => dispatch(openThread(msg.id))}
                            className={`mt-1 rounded-lg text-xs text-fg-muted transition hover:text-fg sr-only group-hover:not-sr-only group-focus-within:not-sr-only ${focusRing}`}
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
            </div>

            <ReactionOverlay items={flying} />
          </div>

          <div className={`border-t px-6 pb-4 pt-3 ${borderC}`}>
            {showHints && <CommandHints prefix={draft.slice(1)} onPick={onPickCommand} />}
            <div className="mb-2 flex items-center justify-between gap-2">
              <ReactionBar onReact={(emoji) => sendReaction(channel.id, emoji)} />
              <span className="min-w-0 flex-1 truncate text-right text-xs text-fg-muted">{typingText}</span>
            </div>
            {cmdError && <p className="mb-2 text-xs text-danger">{cmdError}</p>}
            {attachment && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-1 pr-2">
                <img src={attachment} alt="" className="h-12 w-12 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className={`rounded-lg text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
                >
                  ✕ Kaldır
                </button>
              </div>
            )}
            <form onSubmit={onSend} className="flex items-end gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Görsel ekle"
                title="Görsel ekle"
              >
                {uploading ? '…' : '📎'}
              </Button>
              <Textarea
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
                className="max-h-40 flex-1"
              />
              <Button type="submit" disabled={uploading}>
                Gönder
              </Button>
            </form>
            <p className="mt-2 text-xs text-fg-faint">
              Markdown destekli · <span className="text-fg-muted">**kalın**</span>{' '}
              <span className="text-fg-muted">*italik*</span>{' '}
              <span className="text-fg-muted">`kod`</span> · ``` ile kod bloğu · Enter gönderir, Shift+Enter yeni satır
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
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
