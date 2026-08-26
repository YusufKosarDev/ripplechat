/* eslint-disable react-hooks/set-state-in-effect */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { showToast } from '../features/toast/toastSlice'
import { useT } from '../i18n'
import { client } from '../api/client'
import { joinChannel } from '../features/channels/channelsSlice'
import { Menu, Pin } from 'lucide-react'
import {
  fetchMessages,
  loadOfflineMessages,
  fetchOlderMessages,
  messageHidden,
  addOptimisticMessage,
  removeOptimisticMessage,
} from '../features/messages/messagesSlice'
import {
  fetchMembers,
  selectChannel,
  setDisappearing,
} from '../features/channels/channelsSlice'
import { fetchPolls, setMyVote } from '../features/polls/pollsSlice'
import { closeThread, openThread } from '../features/threads/threadsSlice'
import { fetchReads } from '../features/reads/readsSlice'
import { toggleMute } from '../features/muted/mutedSlice'
import { setJumpTarget } from '../features/ui/uiSlice'
import { toggleArchive, setCategory } from '../features/channelOrg/channelOrgSlice'
import { setActiveCall } from '../features/call/callSlice'
import { CallModal } from './CallModal'
import { blockUser, unblockUser } from '../features/blocks/blocksSlice'
import { clearUnread } from '../features/unread/unreadSlice'
import { toggleBookmark } from '../features/bookmarks/bookmarksSlice'
import { setPassphrase } from '../features/e2ee/e2eeSlice'
import {
  decryptText,
  encryptText,
  isEncrypted,
  isEncryptedV2,
  encryptTextV2,
  decryptTextV2,
  deriveSharedKey,
  encryptTextAsymmetric,
  decryptTextAsymmetric,
} from '../crypto/e2ee'
import { getAsymmetricKeyPair, getDecryptedCache } from '../db'
import { toBase64 } from '../crypto/doubleRatchet'
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
} from '../realtime/chatSocket'
import { addPendingMessage } from '../db'
import { parseCommand } from '../commands/registry'
import { scheduleMessage as scheduleApi } from '../api/scheduled'
import type { Channel, DirectChannel, Message, Poll } from '../api/types'

// UI Primitives
import Button from './ui/Button'
import { focusRing } from './ui/focusRing'
import { SummaryModal, EditHistoryModal } from './MessageInfoModals'

// Custom Subcomponents & Hooks
import ChannelHeader from './channel/ChannelHeader'
import MessageList from './channel/MessageList'
import MessageComposer from './channel/MessageComposer'
import { useChannelSocket } from '../hooks/useChannelSocket'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

// Lazy-loaded dialogs
const ChannelMembersModal = lazy(() => import('./ChannelMembersModal'))
const ForwardModal = lazy(() => import('./ForwardModal'))
const MediaGalleryModal = lazy(() => import('./MediaGalleryModal'))
const ScheduledMessagesModal = lazy(() => import('./ScheduledMessagesModal'))
const WebhooksModal = lazy(() => import('./WebhooksModal'))

const TYPING_STOP_DELAY = 2000
const DECRYPT_FAILED = '__rc_decrypt_failed__'
const MAX_MESSAGE_LENGTH = 4000

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
  const bookmarkedIds = useAppSelector((state) => state.bookmarks.ids)
  const reads = useAppSelector((state) => (selectedId ? state.reads.byChannel[selectedId] : undefined))
  const isMuted = useAppSelector((state) => (selectedId ? !!state.muted.muted[selectedId] : false))
  const passphrase = useAppSelector((state) => (selectedId ? state.e2ee.passphrases[selectedId] : undefined))
  const [asymmetricKey, setAsymmetricKey] = useState<CryptoKey | null>(null)

  const [draft, setDraft] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [attachment, setAttachment] = useState<{
    url: string
    name: string | null
    type: 'image' | 'file' | 'audio'
    e2ee?: { key: string; iv: string }
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null)
  const [pinned, setPinned] = useState<Message[]>([])
  const [showPinned, setShowPinned] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [history, setHistory] = useState<{ content: string; editedAt: string }[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [showScheduled, setShowScheduled] = useState(false)
  const [showWebhooks, setShowWebhooks] = useState(false)
  const [decrypted, setDecrypted] = useState<Record<string, string>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optIdCounter = useRef(0)
  const isTypingRef = useRef(false)

  const dm = selectedId ? (dms.find((d) => d.id === selectedId) ?? null) : null
  const channel = items.find((c) => c.id === selectedId) ?? (dm ? dmAsChannel(dm) : null)
  const otherLastRead = dm?.otherUser ? reads?.[dm.otherUser.id] : undefined
  const partnerOnline = dm?.otherUser ? onlineUserIds.includes(dm.otherUser.id) : false
  const dmPartner = dm?.otherUser ?? null
  const isE2EE = !!(dmPartner || asymmetricKey || passphrase)
  const blockedIds = useAppSelector((state) => state.blocks.ids)
  const jumpTargetId = useAppSelector((state) => state.ui.jumpTargetId)
  const isArchived = useAppSelector((state) => (selectedId ? !!state.channelOrg.archived[selectedId] : false))
  const currentCategory = useAppSelector((state) => (selectedId ? (state.channelOrg.category[selectedId] ?? '') : ''))
  const messages = useMemo(() => selectedId ? (byChannel[selectedId] ?? []) : [], [selectedId, byChannel])
  const channelPaging = selectedId ? paging[selectedId] : undefined
  const polls = selectedId ? (pollsByChannel[selectedId] ?? []) : []
  const forbidden = loadError?.channelId === selectedId && loadError.forbidden
  const loadingMessages = messagesStatus === 'loading' && messages.length === 0
  const members = selectedId ? (membersByChannel[selectedId] ?? []) : []
  const myRole = members.find((m) => m.user.id === currentUser?.id)?.role ?? 'MEMBER'
  const canModerate = myRole === 'OWNER' || myRole === 'MODERATOR'

  const { incomingCall } = useAppSelector((state) => state.call)

  const refreshPinned = useCallback((chanId: string) => {
    client
      .get<Message[]>(`/api/channels/${chanId}/messages/pinned`)
      .then((r) => setPinned(r.data))
      .catch(() => setPinned([]))
  }, [])

  const { typingUsers, flying } = useChannelSocket({
    channelId: selectedId ?? '',
    currentUserId: currentUser?.id,
    blockedIds,
    onRefreshPinned: refreshPinned,
  })

  const { recording, startRecording, stopRecording } = useAudioRecorder({
    dmPartner,
    asymmetricKey,
    passphrase,
    onUploadSuccess: (res) => setAttachment(res),
    onError: (err) => setCmdError(err),
  })

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

  // Decrypt E2EE messages in open channel
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false

    const decryptPending = async () => {
      const pending = messages.filter((m) => isEncrypted(m.content) && decrypted[m.id] === undefined)
      if (pending.length === 0) return

      const newDecrypted: Record<string, string> = {}
      for (const m of pending) {
        if (cancelled) break
        try {
          if (isEncryptedV2(m.content)) {
            if (dmPartner) {
              const cached = await getDecryptedCache(m.content)
              if (cached) {
                newDecrypted[m.id] = cached
              } else {
                const plaintext = await decryptTextV2(dmPartner.id, m.content)
                newDecrypted[m.id] = plaintext
              }
            } else {
              newDecrypted[m.id] = DECRYPT_FAILED
            }
          } else {
            if (asymmetricKey) {
              newDecrypted[m.id] = await decryptTextAsymmetric(asymmetricKey, m.content)
            } else if (passphrase && currentUser) {
              newDecrypted[m.id] = await decryptText(selectedId, passphrase, m.content, currentUser.id)
            }
          }
        } catch (err) {
          console.error('Decryption failed for message:', m.id, err)
          newDecrypted[m.id] = DECRYPT_FAILED
        }
      }

      if (!cancelled && Object.keys(newDecrypted).length > 0) {
        setDecrypted((prev) => ({ ...prev, ...newDecrypted }))
      }
    }

    decryptPending()

    return () => {
      cancelled = true
    }
  }, [selectedId, passphrase, asymmetricKey, messages, decrypted, dmPartner, currentUser])

  useEffect(() => {
    if (!passphrase && !asymmetricKey && !dmPartner) setDecrypted({})
  }, [passphrase, asymmetricKey, dmPartner, selectedId])

  useEffect(() => {
    if (!selectedId) return
    dispatch(loadOfflineMessages(selectedId))
    dispatch(fetchMessages(selectedId))
    dispatch(fetchPolls(selectedId))
    dispatch(fetchMembers(selectedId))
    dispatch(fetchReads(selectedId))
    dispatch(clearUnread(selectedId))
    dispatch(closeThread())
    setShowMembers(false)
    setShowPinned(false)
    setCmdError(null)
    return () => {
      if (isTypingRef.current) {
        sendTyping(selectedId, false)
        isTypingRef.current = false
      }
      if (stopTypingTimer.current) {
        clearTimeout(stopTypingTimer.current)
        stopTypingTimer.current = null
      }
    }
  }, [selectedId, dispatch])


  useEffect(() => {
    if (selectedId && messages.length > 0) sendRead(selectedId)
  }, [selectedId, messages.length])

  useEffect(() => {
    if (!jumpTargetId) return
    const el = document.getElementById(`msg-${jumpTargetId}`)
    if (!el) {
      dispatch(setJumpTarget(null))
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

  useEffect(() => {
    client
      .get<{ enabled: boolean }>('/api/ai/status')
      .then(({ data }) => setAiEnabled(data.enabled))
      .catch(() => setAiEnabled(false))
  }, [])

  const onMessagesScroll = () => {
    if (!selectedId || !channelPaging) return
    if (channelPaging.hasMore && !channelPaging.loadingOlder) {
      dispatch(fetchOlderMessages({ channelId: selectedId, page: channelPaging.nextPage }))
    }
  }

  const stopTyping = () => {
    if (isTypingRef.current) {
      sendTyping(channel!.id, false)
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
      sendTyping(channel!.id, true)
      isTypingRef.current = true
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    stopTypingTimer.current = setTimeout(() => {
      sendTyping(channel!.id, false)
      isTypingRef.current = false
    }, TYPING_STOP_DELAY)
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text && !attachment) return
    if (text.length > MAX_MESSAGE_LENGTH) {
      setCmdError(t('composer.tooLong', { max: MAX_MESSAGE_LENGTH }))
      return
    }
    setCmdError(null)

    if (!passphrase && !asymmetricKey && text.startsWith('/') && !attachment && !replyingTo) {
      const parsed = parseCommand(text)!
      if (!parsed.command) {
        setCmdError(t('panel.unknownCommand', { name: parsed.name }))
        return
      }
      let hadError = false
      parsed.command.run({
        channelId: channel!.id,
        args: parsed.args,
        sendMessage: (content) => sendChatMessage(channel!.id, content),
        createPoll: (question, options) => sendPoll(channel!.id, question, options),
        scheduleMessage: (content, scheduledAt) => {
          scheduleApi(channel!.id, content, scheduledAt.toISOString())
            .then(() => dispatch(showToast({ message: t('panel.reminderScheduled'), variant: 'success' })))
            .catch(() => dispatch(showToast({ message: t('panel.reminderFailed'), variant: 'error' })))
        },
        showError: (message) => {
          hadError = true
          setCmdError(message)
        },
      })
      if (!hadError) setDraft('')
    } else {
      if (!currentUser) return
      let content = text
      let e2eeAttachmentInfo = null
      const isE2EE = !!(dmPartner || asymmetricKey || passphrase)

      if (isE2EE) {
        if (attachment && attachment.e2ee) {
          e2eeAttachmentInfo = {
            url: attachment.url,
            name: attachment.name,
            type: attachment.type,
            key: attachment.e2ee.key,
            iv: attachment.e2ee.iv,
          }
        }

        const e2eePayload = JSON.stringify({
          _e2ee: true,
          text: text,
          attachment: e2eeAttachmentInfo,
        })

        if (dmPartner) {
          try {
            content = await encryptTextV2(dmPartner.id, e2eePayload)
          } catch (err) {
            console.warn('Double Ratchet E2EE initialization failed, falling back to static ECDH:', err)
            if (asymmetricKey) {
              content = await encryptTextAsymmetric(asymmetricKey, e2eePayload)
            } else if (passphrase) {
              content = await encryptText(channel!.id, passphrase, e2eePayload, currentUser.id, members)
            }
          }
        } else if (asymmetricKey) {
          content = await encryptTextAsymmetric(asymmetricKey, e2eePayload)
        } else if (passphrase) {
          content = await encryptText(channel!.id, passphrase, e2eePayload, currentUser.id, members)
        }
      }

      optIdCounter.current += 1
      const optId = 'opt-' + optIdCounter.current + '-' + selectedId
      const optimisticMsg: Message = {
        id: optId,
        content: content,
        channelId: channel!.id,
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
        attachmentUrl: isE2EE ? null : attachment?.url ?? null,
        attachmentName: isE2EE ? null : attachment?.name ?? null,
        attachmentType: isE2EE ? null : attachment?.type ?? null,
        quotedMessageId: replyingTo?.id ?? null,
        quotedSender: replyingTo ? (replyingTo.sender.displayName ?? replyingTo.sender.username) : null,
        quotedContent: replyingTo ? (replyingTo.content || (replyingTo.attachmentUrl ? `📷 ${t('msg.imagePlaceholder')}` : '')) : null,
        expiresAt: null,
        sending: true,
        parentMessageId: null,
        editedAt: null,
      }

      if (isE2EE) {
        const e2eePayload = JSON.stringify({
          _e2ee: true,
          text: text,
          attachment: e2eeAttachmentInfo,
        })
        setDecrypted((prev) => ({ ...prev, [optId]: e2eePayload }))
      }

      dispatch(addOptimisticMessage(optimisticMsg))

      const isOffline = !navigator.onLine || !isStompConnected()
      if (isOffline) {
        addPendingMessage({
          ...optimisticMsg,
          tempId: optId,
          timestamp: performance.now(),
        }).catch(console.error)
      } else {
        sendChatMessage(
          channel!.id,
          content,
          undefined,
          isE2EE ? undefined : attachment?.url,
          replyingTo?.id,
          isE2EE ? undefined : attachment?.name ?? undefined,
          isE2EE ? undefined : attachment?.type,
        )
        setTimeout(() => {
          dispatch(removeOptimisticMessage({ channelId: channel!.id, id: optId }))
        }, 10000)
      }

      setDraft('')
      setAttachment(null)
      setReplyingTo(null)
    }
    stopTyping()
  }

  const onJoin = async () => {
    await dispatch(joinChannel(channel!.id))
    dispatch(loadOfflineMessages(channel!.id))
    dispatch(fetchMessages(channel!.id))
    dispatch(fetchPolls(channel!.id))
  }

  const onVote = (poll: Poll, optionId: string) => {
    dispatch(setMyVote({ pollId: poll.id, optionId }))
    sendPollVote(channel!.id, poll.id, optionId)
  }

  const onPickCommand = (name: string) => {
    setDraft(`/${name} `)
    setFocusTrigger((f) => f + 1)
  }

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCmdError(null)
    setUploading(true)
    try {
      const form = new FormData()
      let fileToUpload = file
      let e2eeKeyB64 = ''
      let e2eeIvB64 = ''

      const isE2EE = !!(dmPartner || asymmetricKey || passphrase)

      if (isE2EE) {
        const rawKey = crypto.getRandomValues(new Uint8Array(32))
        const iv = crypto.getRandomValues(new Uint8Array(12))

        const key = await crypto.subtle.importKey(
          'raw',
          rawKey,
          'AES-GCM',
          false,
          ['encrypt']
        )

        const fileBytes = await file.arrayBuffer()
        const encryptedBytes = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          fileBytes
        )

        e2eeKeyB64 = toBase64(rawKey)
        e2eeIvB64 = toBase64(iv)

        const encryptedBlob = new Blob([encryptedBytes], { type: 'application/octet-stream' })
        fileToUpload = new File([encryptedBlob], file.name, { type: 'application/octet-stream' })
      }

      form.append('file', fileToUpload)

      if (!isE2EE && file.type.startsWith('image/')) {
        const { data } = await client.post<{ url: string }>('/api/uploads/image', form)
        setAttachment({ url: data.url, name: file.name, type: 'image' })
      } else {
        const { data } = await client.post<{ url: string; name: string }>('/api/uploads/file', form)
        setAttachment({
          url: data.url,
          name: data.name ?? file.name,
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
          e2ee: isE2EE ? { key: e2eeKeyB64, iv: e2eeIvB64 } : undefined,
        })
      }
    } catch {
      setCmdError(t('panel.uploadFailed'))
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
    if (content) sendEditMessage(channel!.id, msg.id, content)
    setEditingId(null)
    setEditDraft('')
  }

  const onDelete = (msg: Message) => {
    if (window.confirm(t('panel.deleteConfirm'))) {
      sendDeleteMessage(channel!.id, msg.id)
    }
  }

  const togglePin = async (msg: Message) => {
    if (!selectedId) return
    try {
      if (msg.pinned) await client.delete(`/api/channels/${selectedId}/messages/${msg.id}/pin`)
      else await client.post(`/api/channels/${selectedId}/messages/${msg.id}/pin`)
      refreshPinned(selectedId)
    } catch {
      setCmdError(t('panel.pinFailed'))
    }
  }

  const onSummarize = async () => {
    if (!selectedId) return
    setSummarizing(true)
    setSummary(null)
    try {
      const { data } = await client.post<{ summary: string }>(`/api/ai/channels/${selectedId}/summary`)
      setSummary(data.summary)
    } catch {
      setSummary(t('panel.summaryFailed'))
    } finally {
      setSummarizing(false)
    }
  }

  const onShowHistory = async (msg: Message) => {
    if (!selectedId) return
    setHistory(null)
    setHistoryLoading(true)
    try {
      const { data } = await client.get<{ content: string; editedAt: string }[]>(
        `/api/channels/${selectedId}/messages/${msg.id}/history`,
      )
      setHistory(data)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
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

  const onPickGif = (url: string) => {
    sendChatMessage(channel!.id, '', undefined, url, undefined, undefined, 'image')
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

  if (!selectedId || !channel) {
    return (
      <section className="flex flex-1 flex-col">
        <div className="flex items-center border-b px-4 py-3 md:hidden border-border">
          <Button variant="secondary" onClick={onOpenSidebar}>
            <Menu className="mr-1.5 inline h-4 w-4 align-text-bottom" aria-hidden /> {t('chat.channels')}
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">
            💬
          </div>
          <p className="mt-4 font-medium text-fg">{t('panel.pickChannel')}</p>
          <p className="mt-1 text-sm text-fg-muted">{t('panel.startsHere')}</p>
        </div>
      </section>
    )
  }

  const typingNames = Object.values(typingUsers)
  let typingText = ''
  if (typingNames.length === 1) typingText = t('panel.typingOne', { name: typingNames[0] })
  else if (typingNames.length === 2) typingText = t('panel.typingTwo', { a: typingNames[0], b: typingNames[1] })
  else if (typingNames.length > 2) typingText = t('panel.typingMany')

  return (
    <section id="main-content" aria-label={t('panel.chatAria')} tabIndex={-1} className="flex flex-1 flex-col outline-none">
      <ChannelHeader
        channel={channel}
        dm={dm}
        isMuted={isMuted}
        onMuteToggle={() => selectedId && dispatch(toggleMute(selectedId))}
        onShowGallery={() => setShowGallery(true)}
        onShowWebhooks={() => setShowWebhooks(true)}
        onShowMembers={() => setShowMembers(true)}
        onShowPinned={() => setShowPinned(true)}
        onSummarize={onSummarize}
        summarizing={summarizing}
        aiEnabled={aiEnabled}
        isE2EE={isE2EE}
        passphrase={passphrase}
        dmPartner={dmPartner}
        blockedIds={blockedIds}
        onlineUserIds={onlineUserIds}
        partnerOnline={partnerOnline}
        membersLength={members.length}
        pinnedLength={pinned.length}
        canModerate={canModerate}
        isArchived={isArchived}
        onOpenSidebar={onOpenSidebar}
        onCallStart={() => selectedId && dispatch(setActiveCall({ channelId: selectedId, peerId: dmPartner!.id, isIncoming: false }))}
        onSetCategory={() => {
          if (!selectedId) return
          const name = window.prompt(t('panel.categoryPrompt'), currentCategory)
          if (name !== null) {
            const trimmed = name.trim()
            if (trimmed.length > 80) {
              alert(t('panel.categoryTooLong'))
              return
            }
            dispatch(setCategory({ channelId: selectedId, name: trimmed }))
          }
        }}
        onToggleArchive={() => selectedId && dispatch(toggleArchive(selectedId))}
        onSetDisappearing={(ttl) => selectedId && dispatch(setDisappearing({ channelId: selectedId, ttlSeconds: ttl }))}
        onBlockToggle={() => dispatch(blockedIds.includes(dmPartner!.id) ? unblockUser(dmPartner!.id) : blockUser(dmPartner!.id))}
        onPassphraseToggle={() => {
          if (!selectedId) return
          if (passphrase) {
            if (window.confirm(t('panel.e2eeOffConfirm'))) {
              dispatch(setPassphrase({ channelId: selectedId, passphrase: '' }))
            }
          } else {
            const pass = window.prompt(t('panel.e2eePrompt'), '')
            if (pass) dispatch(setPassphrase({ channelId: selectedId, passphrase: pass }))
          }
        }}
      />

      {summary !== null && <SummaryModal summary={summary} onClose={() => setSummary(null)} />}

      {(history !== null || historyLoading) && (
        <EditHistoryModal entries={history} loading={historyLoading} onClose={() => setHistory(null)} />
      )}

      <Suspense fallback={null}>
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

        {showScheduled && (
          <ScheduledMessagesModal channelId={channel.id} initialDraft={draft} onClose={() => setShowScheduled(false)} />
        )}

        {showWebhooks && <WebhooksModal channelId={channel.id} onClose={() => setShowWebhooks(false)} />}
      </Suspense>

      {showPinned && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16"
          onClick={() => setShowPinned(false)}
        >
          <div
            className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold tracking-tight"><Pin className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden /> {t('chat.pinnedTitle')}</span>
              <button onClick={() => setShowPinned(false)} className={`rounded-lg text-fg-faint transition hover:text-fg ${focusRing}`}>
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {pinned.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-fg-muted">{t('panel.noPinned')}</p>
              )}
              {pinned.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-2 border-b border-border px-2 py-2 last:border-0">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-fg-secondary">{m.sender.displayName ?? m.sender.username}</div>
                    <div className="truncate text-sm text-fg">{m.content || (m.attachmentUrl ? `📷 ${t('msg.imagePlaceholder')}` : '')}</div>
                  </div>
                  <button onClick={() => togglePin(m)} className={`shrink-0 text-xs text-fg-muted transition hover:text-danger ${focusRing}`}>
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {forbidden ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-fg-muted">{t('panel.notMember')}</p>
          <Button onClick={onJoin}>{t('panel.join')}</Button>
        </div>
      ) : (
        <>
          <MessageList
            messages={messages}
            polls={polls}
            myVotes={myVotes}
            onVote={onVote}
            loadingMessages={loadingMessages}
            channelPaging={channelPaging}
            onMessagesScroll={onMessagesScroll}
            currentUser={currentUser}
            canModerate={canModerate}
            otherLastRead={otherLastRead}
            dm={dm}
            decrypted={decrypted}
            passphrase={passphrase}
            asymmetricKey={asymmetricKey}
            onlineUserIds={onlineUserIds}
            bookmarkedIds={bookmarkedIds}
            onShowHistory={onShowHistory}
            onStartEdit={startEdit}
            onDelete={onDelete}
            onHideForMe={hideForMe}
            onQuote={(msg) => dispatch(openThread(msg.id))}
            onForward={(msg) => setForwardingMsg(msg)}
            onTogglePin={togglePin}
            onToggleBookmark={(msg) => dispatch(toggleBookmark({ messageId: msg.id, saved: bookmarkedIds.includes(msg.id) }))}
            onEmojiReact={(msgId, emoji) => sendMessageReaction(channel.id, msgId, emoji)}
            editingId={editingId}
            editDraft={editDraft}
            onEditDraftChange={(val) => setEditDraft(val)}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            flying={flying}
            scrollRef={scrollRef}
          />

          <input ref={fileInputRef} type="file" onChange={onPickFile} className="hidden" />

          <MessageComposer
            channel={channel}
            draft={draft}
            onDraftChange={onDraftChange}
            onSubmit={submit}
            replyingTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
            attachment={attachment}
            onClearAttachment={() => setAttachment(null)}
            uploading={uploading}
            recording={recording}
            onRecordStart={startRecording}
            onRecordStop={stopRecording}
            onPickFileClick={() => fileInputRef.current?.click()}
            onPickGif={onPickGif}
            cmdError={cmdError}
            typingText={typingText}
            members={members}
            currentUser={currentUser}
            focusTrigger={focusTrigger}
            onPickCommand={onPickCommand}
            onShowScheduled={() => setShowScheduled(true)}
            onEmojiReact={(emoji) => sendReaction(channel.id, emoji)}
          />
        </>
      )}

      {selectedId && <CallModal channelId={selectedId} peerId={dmPartner?.id ?? null} isIncoming={!!incomingCall && incomingCall.channelId === selectedId} />}
    </section>
  )
}
