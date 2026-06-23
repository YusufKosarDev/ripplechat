/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/purity */
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { showToast } from '../features/toast/toastSlice'
import { useT } from '../i18n'
import { client } from '../api/client'
import { joinChannel } from '../features/channels/channelsSlice'
import {
  fetchMessages,
  loadOfflineMessages,
  fetchOlderMessages,
  messageHidden,
  messageReactionsUpdated,
  messageReceived,
  messageUpdated,
  threadSummaryUpdated,
  addOptimisticMessage,
  removeOptimisticMessage,
} from '../features/messages/messagesSlice'
import {
  channelRemoved,
  fetchMembers,
  selectChannel,
  setDisappearing,
  ttlLabel,
  TTL_OPTIONS,
} from '../features/channels/channelsSlice'
import { fetchPolls, pollUpserted, setMyVote } from '../features/polls/pollsSlice'
import { closeThread, openThread, threadReplyUpdated } from '../features/threads/threadsSlice'
import { fetchReads, readReceived } from '../features/reads/readsSlice'
import { toggleMute } from '../features/muted/mutedSlice'
import { setJumpTarget } from '../features/ui/uiSlice'
import { toggleArchive, setCategory } from '../features/channelOrg/channelOrgSlice'
import { setActiveCall, setIncomingCall, clearCall } from '../features/call/callSlice'
import { CallModal } from './CallModal'
import { blockUser, unblockUser } from '../features/blocks/blocksSlice'
import { clearUnread } from '../features/unread/unreadSlice'
import { setPassphrase } from '../features/e2ee/e2eeSlice'
import { decryptText, encryptText, isEncrypted, deriveSharedKey, encryptTextAsymmetric, decryptTextAsymmetric } from '../crypto/e2ee'
import { getAsymmetricKeyPair } from '../db'
import ChannelMembersModal from './ChannelMembersModal'
import ForwardModal from './ForwardModal'
import MediaGalleryModal from './MediaGalleryModal'
// Pickers are heavy (emoji dataset / GIF search UI) and only shown on demand,
// so load them lazily instead of bundling them into the chat page.
const EmojiPicker = lazy(() => import('./EmojiPicker'))
const GifPicker = lazy(() => import('./GifPicker'))
import {
  isStompConnected,
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
import { addPendingMessage } from '../db'
import { parseCommand } from '../commands/registry'
import type { Channel, DirectChannel, Message, Poll, ReactionEvent, TypingEvent } from '../api/types'
import Avatar from './Avatar'
import MessageContent from './MessageContent'
import LinkPreviewCard from './LinkPreviewCard'
import MessageReactions from './MessageReactions'
import CommandHints from './CommandHints'
import PollCard from './PollCard'
import ReactionBar from './ReactionBar'
import ReactionOverlay from './ReactionOverlay'
import type { FlyingEmoji } from './ReactionOverlay'
import Button from './ui/Button'
import { RichTextEditor } from './ui/RichTextEditor'
import { focusRing } from './ui/focusRing'
import SkeletonLoader from './ui/SkeletonLoader'

const TYPING_TTL = 4000
const TYPING_STOP_DELAY = 2000
const GROUP_WINDOW_MS = 5 * 60 * 1000
const MAX_FLYING = 40

const borderC = 'border-border'

const EMPTY_MESSAGES: Message[] = []

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

function formatLastSeen(iso: string): string {
  const d = new Date(iso)
  const today = startOfDay(new Date())
  const that = startOfDay(d)
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (that === today) return `bugün ${time}`
  if (that === today - 86_400_000) return `dün ${time}`
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} ${time}`
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
// First http(s) URL in the text (trailing punctuation trimmed), for link previews.
// Sentinel stored in the decrypted-text map when decryption fails, so we don't
// retry endlessly and can show a distinct "wrong passphrase" placeholder.
const DECRYPT_FAILED = '__rc_decrypt_failed__'

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>]+/)
  return match ? match[0].replace(/[.,;:!?)\]]+$/, '') : null
}

function dmAsChannel(dm: DirectChannel): Channel {
  const name = dm.group ? (dm.name ?? 'Grup') : (dm.otherUser?.displayName ?? dm.otherUser?.username ?? 'DM')
  return {
    id: dm.id,
    name,
    description: null,
    isPrivate: true,
    createdBy: dm.otherUser ?? dm.participants[0],
    createdAt: dm.createdAt,
    messageTtlSeconds: null,
  }
}

interface ChannelPanelProps {
  onOpenSidebar: () => void
}

export default function ChannelPanel({ onOpenSidebar }: ChannelPanelProps) {
  const dispatch = useAppDispatch()
  const { t } = useT()
  const { items, dms, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, paging, loadError, status: messagesStatus } = useAppSelector((state) => state.messages)
  const pollsByChannel = useAppSelector((state) => state.polls.byChannel)
  const myVotes = useAppSelector((state) => state.polls.myVotes)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const membersByChannel = useAppSelector((state) => state.channels.membersByChannel)
  const currentUser = useAppSelector((state) => state.auth.user)
  const reads = useAppSelector((state) => (selectedId ? state.reads.byChannel[selectedId] : undefined))
  const isMuted = useAppSelector((state) => (selectedId ? !!state.muted.muted[selectedId] : false))
  const passphrase = useAppSelector((state) => (selectedId ? state.e2ee.passphrases[selectedId] : undefined))
  const [asymmetricKey, setAsymmetricKey] = useState<CryptoKey | null>(null)

  const [draft, setDraft] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [flying, setFlying] = useState<FlyingEmoji[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [attachment, setAttachment] = useState<{
    url: string
    name: string | null
    type: 'image' | 'file' | 'audio'
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null)
  const [pinned, setPinned] = useState<Message[]>([])
  const [showPinned, setShowPinned] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [showTtl, setShowTtl] = useState(false)
  const [decrypted, setDecrypted] = useState<Record<string, string>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const prevHeightRef = useRef<number | null>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const reactionTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optIdCounter = useRef(0)
  const isTypingRef = useRef(false)
  const currentUserIdRef = useRef<string | undefined>(undefined)
  currentUserIdRef.current = currentUser?.id

  const dm = selectedId ? (dms.find((d) => d.id === selectedId) ?? null) : null
  const channel = items.find((c) => c.id === selectedId) ?? (dm ? dmAsChannel(dm) : null)
  const otherLastRead = dm?.otherUser ? reads?.[dm.otherUser.id] : undefined
  const partnerOnline = dm?.otherUser ? onlineUserIds.includes(dm.otherUser.id) : false
  const dmPartner = dm?.otherUser ?? null
  const blockedIds = useAppSelector((state) => state.blocks.ids)
  const jumpTargetId = useAppSelector((state) => state.ui.jumpTargetId)
  const isArchived = useAppSelector((state) => (selectedId ? !!state.channelOrg.archived[selectedId] : false))
  const currentCategory = useAppSelector((state) => (selectedId ? (state.channelOrg.category[selectedId] ?? '') : ''))
  const messages = selectedId ? (byChannel[selectedId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  const channelPaging = selectedId ? paging[selectedId] : undefined
  const polls = selectedId ? (pollsByChannel[selectedId] ?? []) : []
  const forbidden = loadError?.channelId === selectedId && loadError.forbidden
  const loadingMessages = messagesStatus === 'loading' && messages.length === 0
  const members = selectedId ? (membersByChannel[selectedId] ?? []) : []
  const myRole = members.find((m) => m.user.id === currentUser?.id)?.role ?? 'MEMBER'
  const canModerate = myRole === 'OWNER' || myRole === 'MODERATOR'

  const { incomingCall } = useAppSelector((state) => state.call)

  useEffect(() => {
    setAsymmetricKey(null)
    const partnerPublicKey = dmPartner?.publicKey
    if (!selectedId || !partnerPublicKey) return

    const deriveKey = async () => {
      try {
        const ourKeyPair = await getAsymmetricKeyPair()
        if (ourKeyPair) {
          const sharedKey = await deriveSharedKey(ourKeyPair.privateKey, partnerPublicKey)
          setAsymmetricKey(sharedKey)
        }
      } catch (err) {
        console.error('Failed to derive shared key for channel:', err)
      }
    }

    deriveKey()
  }, [selectedId, dmPartner])

  // Decrypt any E2EE messages in the open channel once a passphrase or asymmetric key is set.
  // Failures (wrong key / corrupt payload) are left locked.
  useEffect(() => {
    if (!selectedId || (!passphrase && !asymmetricKey)) return
    let cancelled = false
    const pending = messages.filter((m) => isEncrypted(m.content) && decrypted[m.id] === undefined)
    if (pending.length === 0) return
    Promise.all(
      pending.map(async (m) => {
        try {
          if (asymmetricKey) {
            return [m.id, await decryptTextAsymmetric(asymmetricKey, m.content)] as const
          } else {
            return [m.id, await decryptText(selectedId, passphrase!, m.content)] as const
          }
        } catch {
          return [m.id, DECRYPT_FAILED] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setDecrypted((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, passphrase, asymmetricKey, messages, decrypted])

  // Drop cached plaintext when both keys are cleared so messages re-lock.
  useEffect(() => {
    if (!passphrase && !asymmetricKey) setDecrypted({})
  }, [passphrase, asymmetricKey, selectedId])

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
      onCallSignal: (signal) => {
        if (signal.type === 'OFFER') {
          dispatch(setIncomingCall({ channelId, senderId: signal.senderId }))
        } else if (signal.type === 'HANG_UP' || signal.type === 'REJECT') {
          dispatch(clearCall())
        }
      },
    })
  }

  const refreshPinned = (channelId: string) => {
    client
      .get<Message[]>(`/api/channels/${channelId}/messages/pinned`)
      .then((r) => setPinned(r.data))
      .catch(() => setPinned([]))
  }

  useEffect(() => {
    if (!selectedId) return
    prevHeightRef.current = null
    dispatch(loadOfflineMessages(selectedId))
    dispatch(fetchMessages(selectedId))
    dispatch(fetchPolls(selectedId))
    dispatch(fetchMembers(selectedId))
    dispatch(fetchReads(selectedId))
    refreshPinned(selectedId)
    subscribe(selectedId)
    dispatch(clearUnread(selectedId))
    dispatch(closeThread())
    setShowMembers(false)
    setShowPinned(false)
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
     
  }, [selectedId, messages.length])

  // Mark the channel read while it's open (on load and as new messages arrive).
  useEffect(() => {
    if (selectedId && messages.length > 0) sendRead(selectedId)
  }, [selectedId, messages.length])

  // Scroll to and briefly highlight a message jumped to from search.
  useEffect(() => {
    if (!jumpTargetId) return
    const el = document.getElementById(`msg-${jumpTargetId}`)
    if (!el) {
      dispatch(setJumpTarget(null)) // not in the loaded page
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-indigo-400')
    const timer = setTimeout(() => {
      el.classList.remove('ring-2', 'ring-indigo-400')
      dispatch(setJumpTarget(null))
    }, 2000)
    return () => clearTimeout(timer)
  }, [jumpTargetId, messages.length, dispatch])

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

  const submit = async () => {
    const text = draft.trim()
    if (!text && !attachment) return
    setCmdError(null)

    // Slash commands apply to plain text only (not with an attachment, a quote,
    // or in an encrypted chat — there, "/..." is sent as encrypted text).
    if (!passphrase && !asymmetricKey && text.startsWith('/') && !attachment && !replyingTo) {
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
      if (!currentUser) return
      let content = text
      if (text) {
        if (asymmetricKey) {
          content = await encryptTextAsymmetric(asymmetricKey, text)
        } else if (passphrase) {
          content = await encryptText(channel.id, passphrase, text)
        }
      }
      optIdCounter.current += 1
      const optId = 'opt-' + optIdCounter.current + '-' + selectedId
      const optimisticMsg: Message = {
        id: optId,
        content: content,
        channelId: channel.id,
        sender: {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarColor: currentUser.avatarColor,
          avatarUrl: currentUser.avatarUrl,
          lastSeenAt: null,
        },
        createdAt: new Date().toISOString(),
        deleted: false,
        pinned: false,
        forwarded: false,
        reactions: [],
        thread: { replyCount: 0, lastRepliers: [] },
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.name ?? null,
        attachmentType: attachment?.type ?? null,
        quotedMessageId: replyingTo?.id ?? null,
        quotedSender: replyingTo ? (replyingTo.sender.displayName ?? replyingTo.sender.username) : null,
        quotedContent: replyingTo ? (replyingTo.content || (replyingTo.attachmentUrl ? '📷 Görsel' : '')) : null,
        expiresAt: null,
        sending: true,
        parentMessageId: null,
        editedAt: null,
      }

      dispatch(addOptimisticMessage(optimisticMsg))

      const isOffline = !navigator.onLine || !isStompConnected()
      if (isOffline) {
        // PWA Offline mode: Save to IndexedDB and keep in UI indefinitely
        addPendingMessage({
          ...optimisticMsg,
          tempId: optId,
          timestamp: performance.now()
        }).catch(console.error)
      } else {
        // Online: Send via STOMP and drop optimistic UI if no response in 10s
        sendChatMessage(
          channel.id,
          content,
          undefined,
          attachment?.url,
          replyingTo?.id,
          attachment?.name ?? undefined,
          attachment?.type,
        )
        setTimeout(() => {
          dispatch(removeOptimisticMessage({ channelId: channel.id, id: optId }))
        }, 10000)
      }

      setDraft('')
      setAttachment(null)
      setReplyingTo(null)
    }
    stopTyping()
  }

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const onJoin = async () => {
    await dispatch(joinChannel(channel.id))
    dispatch(loadOfflineMessages(channel.id))
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
    setFocusTrigger(f => f + 1)
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
      if (file.type.startsWith('image/')) {
        const { data } = await client.post<{ url: string }>('/api/uploads/image', form)
        setAttachment({ url: data.url, name: file.name, type: 'image' })
      } else {
        const { data } = await client.post<{ url: string; name: string }>('/api/uploads/file', form)
        setAttachment({ url: data.url, name: data.name ?? file.name, type: 'file' })
      }
    } catch {
      setCmdError('Dosya yüklenemedi — görsel ≤5MB, dosya ≤10MB olmalı.')
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
          <RichTextEditor
            value={editDraft}
            onChange={(val) => setEditDraft(val)}
            onEnter={() => saveEdit(msg)}
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
    const encryptedMsg = isEncrypted(msg.content)
    const dec = encryptedMsg ? decrypted[msg.id] : undefined
    const decryptFailed = dec === DECRYPT_FAILED
    const shownContent = encryptedMsg ? (dec && !decryptFailed ? dec : null) : msg.content
    const linkUrl = !msg.deleted && shownContent ? extractFirstUrl(shownContent) : null
    return (
      <div>
        {msg.forwarded && <div className="mb-0.5 text-xs italic text-fg-faint">↪ İletildi</div>}
        {msg.pinned && <div className="mb-0.5 text-xs text-amber-600 dark:text-amber-500">📌 Sabitlendi</div>}
        {msg.quotedMessageId && (
          <div className="mb-1 rounded-r border-l-2 border-accent/60 bg-surface-muted/60 py-0.5 pl-2 pr-2 text-xs">
            <span className="font-medium text-fg-secondary">{msg.quotedSender}</span>
            <span className="ml-1.5 text-fg-faint">{msg.quotedContent}</span>
          </div>
        )}
        {encryptedMsg && shownContent === null ? (
          <span className="inline-flex items-center gap-1 text-sm italic text-fg-faint">
            🔒{' '}
            {!passphrase && !asymmetricKey
              ? 'Şifreli mesaj — kilidi açmak için parola gir veya anahtar oluştur'
              : decryptFailed
                ? 'Çözülemedi (şifre çözme hatası)'
                : 'Çözülüyor…'}
          </span>
        ) : (
          shownContent && <MessageContent content={shownContent} />
        )}
        {msg.attachmentUrl && msg.attachmentType === 'file' ? (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm text-fg transition hover:bg-surface-muted"
          >
            <span className="text-lg">📄</span>
            <span className="truncate">{msg.attachmentName ?? 'Dosya'}</span>
            <span className="ml-auto text-xs text-fg-faint">↓</span>
          </a>
        ) : msg.attachmentUrl && msg.attachmentType === 'audio' ? (
          <audio controls src={msg.attachmentUrl} className="mt-1 w-64 max-w-full" />
        ) : msg.attachmentUrl ? (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block w-fit">
            <img
              src={msg.attachmentUrl}
              alt="ek görsel"
              loading="lazy"
              className="max-h-80 max-w-sm rounded-lg border border-border"
            />
          </a>
        ) : null}
        {linkUrl && <LinkPreviewCard url={linkUrl} />}
        {msg.editedAt && <span className="text-xs text-fg-faint">(düzenlendi)</span>}
        {msg.expiresAt && !msg.deleted && (
          <span className="text-xs text-fg-faint" title={`Kaybolacak: ${new Date(msg.expiresAt).toLocaleString()}`}>
            ⏲️
          </span>
        )}
        {msg.sending && (
          <span className="ml-1.5 align-middle text-xs text-fg-faint animate-pulse" title="Gönderiliyor…">
            ⏳
          </span>
        )}
        {!msg.sending && dm && dm.otherUser && mine && !msg.deleted && (
          <span
            title={readByOther ? 'Okundu' : 'İletildi'}
            className={`ml-1.5 align-middle text-xs ${readByOther ? 'text-accent' : 'text-fg-faint'}`}
          >
            ✓✓
          </span>
        )}
        {!msg.deleted && !msg.sending && (
          <span className="ml-2 inline-flex gap-2 text-xs text-fg-muted sr-only group-hover:not-sr-only group-focus-within:not-sr-only">
            {mine && (
              <button onClick={() => startEdit(msg)} className={`rounded-lg hover:text-fg ${focusRing}`}>
                Düzenle
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(msg)} className={`rounded-lg hover:text-danger ${focusRing}`}>
                Herkesten sil
              </button>
            )}
            <button onClick={() => hideForMe(msg)} className={`rounded-lg hover:text-danger ${focusRing}`}>
              Benden sil
            </button>
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

  // @mention autocomplete: when the text ends with "@partial", suggest members.
  const mentionMatch = /(^|\s)@(\w*)$/.exec(draft)
  const mentionQuery = mentionMatch ? mentionMatch[2].toLowerCase() : null
  const mentionCandidates =
    mentionQuery !== null
      ? members
          .filter((m) => m.user.id !== currentUser?.id)
          .filter(
            (m) =>
              m.user.username.toLowerCase().includes(mentionQuery) ||
              (m.user.displayName ?? '').toLowerCase().includes(mentionQuery),
          )
          .slice(0, 6)
      : []

  const pickMention = (username: string) => {
    setDraft((d) => d.replace(/@(\w*)$/, `@${username} `))
    setFocusTrigger(f => f + 1)
  }



  const togglePin = async (msg: Message) => {
    if (!selectedId) return
    try {
      if (msg.pinned) await client.delete(`/api/channels/${selectedId}/messages/${msg.id}/pin`)
      else await client.post(`/api/channels/${selectedId}/messages/${msg.id}/pin`)
      refreshPinned(selectedId)
    } catch {
      setCmdError('Sabitleme güncellenemedi.')
    }
  }

  const hideForMe = async (msg: Message) => {
    if (!selectedId) return
    try {
      await client.post(`/api/channels/${selectedId}/messages/${msg.id}/hide`)
      dispatch(messageHidden({ channelId: selectedId, messageId: msg.id }))
    } catch {
      setCmdError('Mesaj gizlenemedi.')
    }
  }

  const startRecording = async () => {
    setCmdError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        setUploading(true)
        try {
          const form = new FormData()
          form.append('file', new File([blob], 'sesli-mesaj.webm', { type: blob.type }))
          const { data } = await client.post<{ url: string; name: string }>('/api/uploads/file', form)
          setAttachment({ url: data.url, name: 'Sesli mesaj', type: 'audio' })
        } catch {
          setCmdError('Ses yüklenemedi.')
        } finally {
          setUploading(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setCmdError('Mikrofona erişilemedi.')
    }
  }

  const stopRecording = () => mediaRecorderRef.current?.stop()

  const onPickGif = (url: string) => {
    sendChatMessage(channel.id, '', undefined, url, undefined, undefined, 'image')
    setShowGif(false)
  }

  const onForward = async (targetChannelId: string) => {
    const source = forwardingMsg
    setForwardingMsg(null)
    if (!source) return
    try {
      await client.post(`/api/channels/${targetChannelId}/messages/forward`, { sourceMessageId: source.id })
      dispatch(selectChannel(targetChannelId))
      dispatch(showToast({ message: t('toast.forward.success'), variant: 'success' }))
    } catch {
      dispatch(showToast({ message: t('toast.forward.error'), variant: 'error' }))
    }
  }

  return (
    <section id="main-content" aria-label="Sohbet" tabIndex={-1} className="flex flex-1 flex-col outline-none">
      <header className={`flex items-center justify-between gap-3 border-b px-4 py-4 md:px-6 ${borderC}`}>
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onOpenSidebar} className="shrink-0 md:hidden" title="Kanallar">
            ☰
          </Button>
          {dm && dm.group ? (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-lg">
                👥
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight">{channel.name}</h2>
                <p className="truncate text-sm text-fg-muted">{dm.participants.length + 1} kişi</p>
              </div>
            </>
          ) : dm && dm.otherUser ? (
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
                <p className="truncate text-sm text-fg-muted">
                  {partnerOnline
                    ? 'çevrimiçi'
                    : dm.otherUser.lastSeenAt
                      ? `son görülme ${formatLastSeen(dm.otherUser.lastSeenAt)}`
                      : 'çevrimdışı'}
                </p>
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => selectedId && dispatch(toggleMute(selectedId))}
            title={isMuted ? 'Bildirimleri aç' : 'Sessize al'}
          >
            {isMuted ? '🔕' : '🔔'}
          </Button>
          <Button variant="secondary" size="sm" title="Medya" onClick={() => setShowGallery(true)}>
            🖼️
          </Button>
          {dm && (
            dmPartner?.publicKey ? (
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-1 rounded" title="Bu sohbet otomatik olarak uçtan uca asimetrik anahtarla (P-256 ECDH) şifrelenmektedir.">
                🔒 E2EE Aktif
              </div>
            ) : (
              <Button
                variant={passphrase ? 'primary' : 'secondary'}
                size="sm"
                aria-label="Uçtan uca şifreleme"
                title={passphrase ? 'Şifreli sohbet açık' : 'Uçtan uca şifreleme'}
                onClick={() => {
                  if (!selectedId) return
                  if (passphrase) {
                    if (window.confirm('Şifreli sohbeti kapat? Yeni mesajlar düz metin gönderilir.')) {
                      dispatch(setPassphrase({ channelId: selectedId, passphrase: '' }))
                    }
                  } else {
                    const pass = window.prompt(
                      'Bu sohbet için ortak parola (iki taraf da aynısını girmeli, sunucuya gönderilmez):',
                      '',
                    )
                    if (pass) dispatch(setPassphrase({ channelId: selectedId, passphrase: pass }))
                  }
                }}
              >
                {passphrase ? '🔒' : '🔓'}
              </Button>
            )
          )}
          {!dm && (
            <>
              <Button
                variant="secondary"
                size="sm"
                title="Kategori"
                onClick={() => {
                  if (!selectedId) return
                  const name = window.prompt('Kategori adı (boş = kategorisiz):', currentCategory)
                  if (name !== null) dispatch(setCategory({ channelId: selectedId, name: name.trim() }))
                }}
              >
                📁
              </Button>
              <Button
                variant="secondary"
                size="sm"
                title={isArchived ? 'Arşivden çıkar' : 'Arşivle'}
                onClick={() => selectedId && dispatch(toggleArchive(selectedId))}
              >
                {isArchived ? '📂' : '🗄️'}
              </Button>
              <div className="relative">
                <Button
                  variant={channel.messageTtlSeconds ? 'primary' : 'secondary'}
                  size="sm"
                  title="Kaybolan mesajlar"
                  onClick={() => setShowTtl((s) => !s)}
                >
                  {channel.messageTtlSeconds ? `⏲️ ${ttlLabel(channel.messageTtlSeconds)}` : '⏲️'}
                </Button>
                {showTtl && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface-overlay py-1 shadow-elevated">
                    <p className="px-3 py-1 text-xs text-fg-faint">Mesajlar şu süre sonra silinsin:</p>
                    {TTL_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          if (selectedId) dispatch(setDisappearing({ channelId: selectedId, ttlSeconds: opt.value }))
                          setShowTtl(false)
                        }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-fg transition hover:bg-surface-muted ${focusRing}`}
                      >
                        <span>{opt.label}</span>
                        {(channel.messageTtlSeconds ?? null) === opt.value && <span className="text-brand">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {dmPartner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                dispatch(blockedIds.includes(dmPartner.id) ? unblockUser(dmPartner.id) : blockUser(dmPartner.id))
              }
            >
              {blockedIds.includes(dmPartner.id) ? 'Engeli kaldır' : 'Engelle'}
            </Button>
          )}
          {dmPartner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (selectedId) {
                  dispatch(setActiveCall({ channelId: selectedId, peerId: dmPartner.id, isIncoming: false }))
                }
              }}
              title="Görüntülü/Sesli Ara"
            >
              📞
            </Button>
          )}
          {pinned.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setShowPinned(true)} title="Sabitlenenler">
              📌 {pinned.length}
            </Button>
          )}
          {(!dm || dm.group) && (
            <Button variant="secondary" size="sm" onClick={() => setShowMembers(true)}>
              Üyeler ({members.length})
            </Button>
          )}
        </div>
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

      {forwardingMsg && <ForwardModal onPick={onForward} onClose={() => setForwardingMsg(null)} />}

      {showGallery && selectedId && (
        <MediaGalleryModal channelId={selectedId} onClose={() => setShowGallery(false)} />
      )}

      {showPinned && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-16"
          onClick={() => setShowPinned(false)}
        >
          <div
            className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold tracking-tight">📌 Sabitlenenler</span>
              <button onClick={() => setShowPinned(false)} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {pinned.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-fg-muted">Sabitlenmiş mesaj yok.</p>
              )}
              {pinned.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-2 border-b border-border px-2 py-2 last:border-0">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-fg-secondary">{m.sender.displayName ?? m.sender.username}</div>
                    <div className="truncate text-sm text-fg">{m.content || (m.attachmentUrl ? '📷 Görsel' : '')}</div>
                  </div>
                  <button onClick={() => togglePin(m)} className={`shrink-0 text-xs text-fg-muted transition hover:text-danger ${focusRing}`}>
                    Kaldır
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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

              {loadingMessages && <SkeletonLoader type="message-list" count={6} />}

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
                      id={`msg-${msg.id}`}
                      className={`group -mx-2 rounded-lg px-2 transition-colors hover:bg-surface-muted/50 ${msg.sending ? 'opacity-70 select-none' : ''}`}
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
                              <span className="text-xs text-fg-faint">
                                {formatTime(msg.createdAt)}
                                {msg.sending && <span className="ml-1 opacity-70" title="Gönderiliyor / Bekliyor">🕒</span>}
                              </span>
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
                        {!msg.deleted && (
                          <button
                            onClick={() => {
                              setReplyingTo(msg)
                              setFocusTrigger(f => f + 1)
                            }}
                            className={`mt-1 rounded-lg text-xs text-fg-muted transition hover:text-fg sr-only group-hover:not-sr-only group-focus-within:not-sr-only ${focusRing}`}
                          >
                            Alıntıla
                          </button>
                        )}
                        {!msg.deleted && (
                          <button
                            onClick={() => setForwardingMsg(msg)}
                            className={`mt-1 rounded-lg text-xs text-fg-muted transition hover:text-fg sr-only group-hover:not-sr-only group-focus-within:not-sr-only ${focusRing}`}
                          >
                            İlet
                          </button>
                        )}
                        {!msg.deleted && (
                          <button
                            onClick={() => togglePin(msg)}
                            className={`mt-1 rounded-lg text-xs text-fg-muted transition hover:text-fg sr-only group-hover:not-sr-only group-focus-within:not-sr-only ${focusRing}`}
                          >
                            {msg.pinned ? 'Sabiti kaldır' : 'Sabitle'}
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
            {mentionQuery !== null && mentionCandidates.length > 0 && (
              <div className="mb-2 overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-card">
                {mentionCandidates.map((m) => (
                  <button
                    key={m.user.id}
                    type="button"
                    onClick={() => pickMention(m.user.username)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-surface-muted ${focusRing}`}
                  >
                    <Avatar name={m.user.displayName ?? m.user.username} color={m.user.avatarColor} imageUrl={m.user.avatarUrl} size="sm" />
                    <span className="text-fg">{m.user.displayName ?? m.user.username}</span>
                    <span className="text-fg-faint">@{m.user.username}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
              <ReactionBar onReact={(emoji) => sendReaction(channel.id, emoji)} />
              <span className="min-w-0 flex-1 truncate text-right text-xs text-fg-muted">{typingText}</span>
            </div>
            {cmdError && <p className="mb-2 text-xs text-danger">{cmdError}</p>}
            {replyingTo && (
              <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-l-2 border-accent/60 bg-surface-muted px-2 py-1 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-fg-secondary">
                    {(replyingTo.sender.displayName ?? replyingTo.sender.username)} kişisine yanıt
                  </div>
                  <div className="truncate text-fg-faint">
                    {replyingTo.content || (replyingTo.attachmentUrl ? '📷 Görsel' : '')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className={`shrink-0 text-fg-muted transition hover:text-danger ${focusRing}`}
                >
                  ✕
                </button>
              </div>
            )}
            {attachment && (
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-1 pr-2">
                {attachment.type === 'image' ? (
                  <img src={attachment.url} alt="" className="h-12 w-12 rounded object-cover" />
                ) : attachment.type === 'audio' ? (
                  <span className="flex items-center gap-1 px-1 text-sm text-fg">
                    <span>🎤</span>
                    <span>Sesli mesaj</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-1 text-sm text-fg">
                    <span>📄</span>
                    <span className="max-w-[10rem] truncate">{attachment.name ?? 'Dosya'}</span>
                  </span>
                )}
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
              <input ref={fileInputRef} type="file" onChange={onPickFile} className="hidden" />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Dosya ekle"
                title="Dosya ekle"
              >
                {uploading ? '…' : '📎'}
              </Button>
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowEmoji((s) => !s)
                    setShowGif(false)
                  }}
                  title="Emoji"
                >
                  😀
                </Button>
                {showEmoji && (
                  <Suspense fallback={null}>
                    <EmojiPicker onPick={(e) => setDraft((d) => d + e)} onClose={() => setShowEmoji(false)} />
                  </Suspense>
                )}
              </div>
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowGif((s) => !s)
                    setShowEmoji(false)
                  }}
                  title="GIF"
                >
                  GIF
                </Button>
                {showGif && (
                  <Suspense fallback={null}>
                    <GifPicker onPick={onPickGif} onClose={() => setShowGif(false)} />
                  </Suspense>
                )}
              </div>
              <Button
                type="button"
                variant={recording ? 'danger' : 'secondary'}
                onClick={recording ? stopRecording : startRecording}
                disabled={uploading && !recording}
                aria-label={recording ? 'Kaydı durdur' : 'Sesli mesaj kaydet'}
                title={recording ? 'Kaydı durdur ve gönder' : 'Sesli mesaj'}
              >
                {recording ? '⏹' : '🎤'}
              </Button>
              <RichTextEditor
                value={draft}
                onChange={(val) => onDraftChange(val)}
                onEnter={() => submit()}
                placeholder={`#${channel.name} kanalına yaz  ·  /poll, /giphy, /shrug`}
                className="flex-1 w-full"
                autoFocus
                focusTrigger={focusTrigger}
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

      {selectedId && <CallModal channelId={selectedId} peerId={dmPartner?.id ?? null} isIncoming={!!incomingCall && incomingCall.channelId === selectedId} />}
    </section>
  )
}

