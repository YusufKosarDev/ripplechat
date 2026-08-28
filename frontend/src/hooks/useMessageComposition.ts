import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AppDispatch } from '../app/store'
import { client } from '../api/client'
import { addPendingMessage } from '../db'
import { toBase64 } from '../crypto/doubleRatchet'
import { encryptText, encryptTextAsymmetric, encryptTextV2 } from '../crypto/e2ee'
import { parseCommand } from '../commands/registry'
import { scheduleMessage as scheduleApi } from '../api/scheduled'
import { showToast } from '../features/toast/toastSlice'
import { addOptimisticMessage, removeOptimisticMessage } from '../features/messages/messagesSlice'
import {
  isStompConnected,
  sendChatMessage,
  sendDeleteMessage,
  sendEditMessage,
  sendPoll,
  sendTyping,
} from '../realtime/chatSocket'
import type { Channel, MemberResponse, Message, UserSummary } from '../api/types'

const TYPING_STOP_DELAY = 2000
const MAX_MESSAGE_LENGTH = 4000

export interface ComposerAttachment {
  url: string
  name: string | null
  type: 'image' | 'file' | 'audio'
  e2ee?: { key: string; iv: string }
}

interface CurrentUser {
  id: string
  username: string
  displayName: string | null
  avatarColor: string | null
  avatarUrl: string | null
}

interface UseMessageCompositionProps {
  channel: Channel | null
  channelId: string | null
  currentUser: CurrentUser | null
  members: MemberResponse[]
  dmPartner: UserSummary | null
  asymmetricKey: CryptoKey | null
  passphrase: string | undefined
  isE2EE: boolean
  /** Seeds the local plaintext cache with what we just encrypted and sent. */
  cachePlaintext: (messageId: string, plaintext: string) => void
  dispatch: AppDispatch
  t: (key: string, vars?: Record<string, string | number>) => string
}

/**
 * Everything involved in writing and sending a message in the open channel:
 * the draft and typing indicator, attachments (encrypted client-side when the
 * conversation is E2EE), quote-replies, inline editing, and the send path with
 * its optimistic message and offline queue.
 */
export function useMessageComposition({
  channel,
  channelId,
  currentUser,
  members,
  dmPartner,
  asymmetricKey,
  passphrase,
  isE2EE,
  cachePlaintext,
  dispatch,
  t,
}: UseMessageCompositionProps) {
  const [draft, setDraft] = useState('')
  const [cmdError, setCmdError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [focusTrigger, setFocusTrigger] = useState(0)

  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optIdCounter = useRef(0)
  const isTypingRef = useRef(false)

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

  /**
   * Called on channel switch, so the channel you left does not keep showing
   * "typing…". Stable (touches refs only) so the caller's effect can depend on
   * it without re-running every render.
   */
  const resetOnChannelChange = useCallback((previousChannelId: string) => {
    if (isTypingRef.current) {
      sendTyping(previousChannelId, false)
      isTypingRef.current = false
    }
    if (stopTypingTimer.current) {
      clearTimeout(stopTypingTimer.current)
      stopTypingTimer.current = null
    }
  }, [])

  const onDraftChange = (value: string) => {
    setDraft(value)
    setCmdError(null)
    // Slash commands are not "typing" — no point telling the channel.
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

  const runSlashCommand = (text: string) => {
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
  }

  /** Wraps text and attachment metadata in the envelope the peer decrypts. */
  const e2eePayloadFor = (text: string) =>
    JSON.stringify({
      _e2ee: true,
      text,
      attachment:
        attachment && attachment.e2ee
          ? {
              url: attachment.url,
              name: attachment.name,
              type: attachment.type,
              key: attachment.e2ee.key,
              iv: attachment.e2ee.iv,
            }
          : null,
    })

  /**
   * `plainFallback` is what goes out when no key material is usable — the raw
   * text, never the envelope, which would otherwise reach the channel as
   * unencrypted JSON that no reader knows how to unwrap.
   */
  const encryptForSend = async (payload: string, plainFallback: string): Promise<string> => {
    if (dmPartner) {
      try {
        return await encryptTextV2(dmPartner.id, payload)
      } catch (err) {
        console.warn('Double Ratchet E2EE initialization failed, falling back to static ECDH:', err)
        if (asymmetricKey) return await encryptTextAsymmetric(asymmetricKey, payload)
        if (passphrase) return await encryptText(channel!.id, passphrase, payload, currentUser!.id, members)
        return plainFallback
      }
    }
    if (asymmetricKey) return await encryptTextAsymmetric(asymmetricKey, payload)
    if (passphrase) return await encryptText(channel!.id, passphrase, payload, currentUser!.id, members)
    return plainFallback
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text && !attachment) return
    if (text.length > MAX_MESSAGE_LENGTH) {
      setCmdError(t('composer.tooLong', { max: MAX_MESSAGE_LENGTH }))
      return
    }
    setCmdError(null)

    // A slash command in a plaintext channel never becomes a message.
    if (!passphrase && !asymmetricKey && text.startsWith('/') && !attachment && !replyingTo) {
      runSlashCommand(text)
      stopTyping()
      return
    }

    if (!currentUser) return

    let content = text
    const payload = isE2EE ? e2eePayloadFor(text) : null
    if (payload) content = await encryptForSend(payload, text)

    optIdCounter.current += 1
    const optId = 'opt-' + optIdCounter.current + '-' + channelId
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
      // The ciphertext carries the attachment; the plaintext columns stay empty.
      attachmentUrl: isE2EE ? null : (attachment?.url ?? null),
      attachmentName: isE2EE ? null : (attachment?.name ?? null),
      attachmentType: isE2EE ? null : (attachment?.type ?? null),
      quotedMessageId: replyingTo?.id ?? null,
      quotedSender: replyingTo ? (replyingTo.sender.displayName ?? replyingTo.sender.username) : null,
      quotedContent: replyingTo
        ? replyingTo.content || (replyingTo.attachmentUrl ? `📷 ${t('msg.imagePlaceholder')}` : '')
        : null,
      expiresAt: null,
      sending: true,
      parentMessageId: null,
      editedAt: null,
    }

    // Our own message would otherwise be unreadable until the ratchet catches up.
    if (payload) cachePlaintext(optId, payload)

    dispatch(addOptimisticMessage(optimisticMsg))

    const isOffline = !navigator.onLine || !isStompConnected()
    if (isOffline) {
      addPendingMessage({
        ...optimisticMsg,
        tempId: optId,
        // Wall clock, not performance.now(): the queue is replayed in timestamp
        // order and can outlive the page, and performance.now() restarts at 0 on
        // every load — so a message queued in a later session sorted first.
        timestamp: Date.now(),
      }).catch(console.error)
    } else {
      sendChatMessage(
        channel!.id,
        content,
        undefined,
        isE2EE ? undefined : attachment?.url,
        replyingTo?.id,
        isE2EE ? undefined : (attachment?.name ?? undefined),
        isE2EE ? undefined : attachment?.type,
      )
      // Give up on the optimistic copy if the broadcast never comes back.
      setTimeout(() => {
        dispatch(removeOptimisticMessage({ channelId: channel!.id, id: optId }))
      }, 10000)
    }

    setDraft('')
    setAttachment(null)
    setReplyingTo(null)
    stopTyping()
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

      if (isE2EE) {
        // Encrypt before upload: the server only ever stores opaque bytes.
        const rawKey = crypto.getRandomValues(new Uint8Array(32))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
        const fileBytes = await file.arrayBuffer()
        const encryptedBytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileBytes)

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
          type: file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'file',
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

  const pickCommand = (name: string) => {
    setDraft(`/${name} `)
    setFocusTrigger((f) => f + 1)
  }

  return {
    draft,
    onDraftChange,
    submit,
    cmdError,
    setCmdError,
    attachment,
    setAttachment,
    clearAttachment: () => setAttachment(null),
    uploading,
    replyingTo,
    setReplyingTo,
    clearReply: () => setReplyingTo(null),
    editingId,
    editDraft,
    setEditDraft,
    startEdit,
    cancelEdit,
    saveEdit,
    onDelete,
    onPickFile,
    focusTrigger,
    pickCommand,
    resetOnChannelChange,
  }
}
