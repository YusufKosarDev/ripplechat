/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { showToast } from '../features/toast/toastSlice'
import { useT } from '../i18n'
import { client } from '../api/client'
import { joinChannel } from '../features/channels/channelsSlice'
import { Menu } from 'lucide-react'
import {
  fetchMessages,
  loadOfflineMessages,
  fetchOlderMessages,
  messageHidden,
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
  sendChatMessage,
  sendMessageReaction,
  sendPollVote,
  sendReaction,
  sendRead,
} from '../realtime/chatSocket'
import type { Channel, DirectChannel, Message, Poll } from '../api/types'

// UI Primitives
import Button from './ui/Button'

// Custom Subcomponents & Hooks
import ChannelHeader from './channel/ChannelHeader'
import MessageList from './channel/MessageList'
import MessageComposer from './channel/MessageComposer'
import ChannelOverlays from './channel/ChannelOverlays'
import { useChannelSocket } from '../hooks/useChannelSocket'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useChannelE2ee } from '../hooks/useChannelE2ee'
import { usePinnedMessages } from '../hooks/usePinnedMessages'
import { useChannelSummary } from '../hooks/useChannelSummary'
import { useEditHistory } from '../hooks/useEditHistory'
import { useMessageComposition } from '../hooks/useMessageComposition'

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

  const [showMembers, setShowMembers] = useState(false)
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [showScheduled, setShowScheduled] = useState(false)
  const [showWebhooks, setShowWebhooks] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const dm = selectedId ? (dms.find((d) => d.id === selectedId) ?? null) : null
  const channel = items.find((c) => c.id === selectedId) ?? (dm ? dmAsChannel(dm) : null)
  const otherLastRead = dm?.otherUser ? reads?.[dm.otherUser.id] : undefined
  const partnerOnline = dm?.otherUser ? onlineUserIds.includes(dm.otherUser.id) : false
  const dmPartner = dm?.otherUser ?? null
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

  const { asymmetricKey, decrypted, setDecrypted, isE2EE } = useChannelE2ee({
    channelId: selectedId,
    dmPartner,
    passphrase,
    currentUserId: currentUser?.id,
    messages,
  })
  const composer = useMessageComposition({
    channel,
    channelId: selectedId,
    currentUser,
    members,
    dmPartner,
    asymmetricKey,
    passphrase,
    isE2EE,
    cachePlaintext: (id, plaintext) => setDecrypted((prev) => ({ ...prev, [id]: plaintext })),
    dispatch,
    t,
  })
  const { pinned, showPinned, setShowPinned, refreshPinned, togglePin } = usePinnedMessages({
    channelId: selectedId,
    onError: composer.setCmdError,
  })
  const { aiEnabled, summary, setSummary, summarizing, summarize } = useChannelSummary(selectedId)
  const { history, historyLoading, showHistory, closeHistory } = useEditHistory(selectedId)
  const { setCmdError, resetOnChannelChange } = composer

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
    onUploadSuccess: (res) => composer.setAttachment(res),
    onError: (err) => composer.setCmdError(err),
  })

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
    return () => resetOnChannelChange(selectedId)
    // setShowPinned/setCmdError are useState setters and resetOnChannelChange is
    // memoised; all three are stable, but the linter cannot see through the hooks.
  }, [selectedId, dispatch, setShowPinned, setCmdError, resetOnChannelChange])


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

  const onMessagesScroll = () => {
    if (!selectedId || !channelPaging) return
    if (channelPaging.hasMore && !channelPaging.loadingOlder) {
      dispatch(fetchOlderMessages({ channelId: selectedId, page: channelPaging.nextPage }))
    }
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
        onSummarize={() => summarize(t('panel.summaryFailed'))}
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

      <ChannelOverlays
        channelId={channel.id}
        members={members}
        myRole={myRole}
        currentUserId={currentUser?.id}
        draft={composer.draft}
        summary={summary}
        onCloseSummary={() => setSummary(null)}
        history={history}
        historyLoading={historyLoading}
        onCloseHistory={closeHistory}
        showMembers={showMembers}
        onCloseMembers={() => setShowMembers(false)}
        forwardingMsg={forwardingMsg}
        onForward={onForward}
        onCloseForward={() => setForwardingMsg(null)}
        showGallery={showGallery}
        onCloseGallery={() => setShowGallery(false)}
        showScheduled={showScheduled}
        onCloseScheduled={() => setShowScheduled(false)}
        showWebhooks={showWebhooks}
        onCloseWebhooks={() => setShowWebhooks(false)}
        showPinned={showPinned}
        pinned={pinned}
        onClosePinned={() => setShowPinned(false)}
        onUnpin={togglePin}
      />

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
            onShowHistory={showHistory}
            onStartEdit={composer.startEdit}
            onDelete={composer.onDelete}
            onHideForMe={hideForMe}
            onQuote={(msg) => dispatch(openThread(msg.id))}
            onForward={(msg) => setForwardingMsg(msg)}
            onTogglePin={togglePin}
            onToggleBookmark={(msg) => dispatch(toggleBookmark({ messageId: msg.id, saved: bookmarkedIds.includes(msg.id) }))}
            onEmojiReact={(msgId, emoji) => sendMessageReaction(channel.id, msgId, emoji)}
            editingId={composer.editingId}
            editDraft={composer.editDraft}
            onEditDraftChange={composer.setEditDraft}
            onSaveEdit={composer.saveEdit}
            onCancelEdit={composer.cancelEdit}
            flying={flying}
            scrollRef={scrollRef}
          />

          <input ref={fileInputRef} type="file" onChange={composer.onPickFile} className="hidden" />

          <MessageComposer
            channel={channel}
            draft={composer.draft}
            onDraftChange={composer.onDraftChange}
            onSubmit={composer.submit}
            replyingTo={composer.replyingTo}
            onClearReply={composer.clearReply}
            attachment={composer.attachment}
            onClearAttachment={composer.clearAttachment}
            uploading={composer.uploading}
            recording={recording}
            onRecordStart={startRecording}
            onRecordStop={stopRecording}
            onPickFileClick={() => fileInputRef.current?.click()}
            onPickGif={onPickGif}
            cmdError={composer.cmdError}
            typingText={typingText}
            members={members}
            currentUser={currentUser}
            focusTrigger={composer.focusTrigger}
            onPickCommand={composer.pickCommand}
            onShowScheduled={() => setShowScheduled(true)}
            onEmojiReact={(emoji) => sendReaction(channel.id, emoji)}
          />
        </>
      )}

      {selectedId && <CallModal channelId={selectedId} peerId={dmPartner?.id ?? null} isIncoming={!!incomingCall && incomingCall.channelId === selectedId} />}
    </section>
  )
}
