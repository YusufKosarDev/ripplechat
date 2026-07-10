import { useRef, useEffect } from 'react'
import type { RefObject } from 'react'
import { Virtuoso } from 'react-virtuoso'
import type { Message, Poll, DirectChannel } from '../../api/types'
import SkeletonLoader from '../ui/SkeletonLoader'
import PollCard from '../PollCard'
import MessageItem from './MessageItem'
import ReactionOverlay from '../ReactionOverlay'
import type { FlyingEmoji } from '../ReactionOverlay'
import { dateLocale, useT } from '../../i18n'

interface MessageListProps {
  messages: Message[]
  polls: Poll[]
  myVotes: Record<string, string>
  onVote: (poll: Poll, optionId: string) => void
  loadingMessages: boolean
  channelPaging?: { loadingOlder: boolean; hasMore: boolean }
  onMessagesScroll: () => void
  currentUser: { id: string; username: string; displayName?: string | null; avatarColor?: string | null; avatarUrl?: string | null } | null
  canModerate: boolean
  otherLastRead: string | undefined
  dm: DirectChannel | null
  decrypted: Record<string, string>
  passphrase?: string
  asymmetricKey: CryptoKey | null
  onlineUserIds: string[]
  bookmarkedIds: string[]
  onShowHistory: (msg: Message) => void
  onStartEdit: (msg: Message) => void
  onDelete: (msg: Message) => void
  onHideForMe: (msg: Message) => void
  onQuote: (msg: Message) => void
  onForward: (msg: Message) => void
  onTogglePin: (msg: Message) => void
  onToggleBookmark: (msg: Message) => void
  onEmojiReact: (msgId: string, emoji: string) => void
  editingId: string | null
  editDraft: string
  onEditDraftChange: (val: string) => void
  onSaveEdit: (msg: Message) => void
  onCancelEdit: () => void
  flying: FlyingEmoji[]
  scrollRef: RefObject<HTMLDivElement | null>
}

const GROUP_WINDOW_MS = 5 * 60 * 1000
const START_INDEX = 10000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function sameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

function dateLabel(iso: string, t: (key: string) => string, locale: string): string {
  const today = startOfDay(new Date())
  const that = startOfDay(new Date(iso))
  if (that === today) return t('date.today')
  if (that === today - 86_400_000) return t('date.yesterday')
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MessageList({
  messages,
  polls,
  myVotes,
  onVote,
  loadingMessages,
  channelPaging,
  onMessagesScroll,
  currentUser,
  canModerate,
  otherLastRead,
  dm,
  decrypted,
  passphrase,
  asymmetricKey,
  onlineUserIds,
  bookmarkedIds,
  onShowHistory,
  onStartEdit,
  onDelete,
  onHideForMe,
  onQuote,
  onForward,
  onTogglePin,
  onToggleBookmark,
  onEmojiReact,
  editingId,
  editDraft,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  flying,
  scrollRef,
}: MessageListProps) {
  const { t, lang } = useT()
  const locale = dateLocale(lang)
  const firstItemIndex = Math.max(0, START_INDEX - messages.length)
  const virtuosoRef = useRef<any>(null)

  // Scroll to bottom when a new message is added
  useEffect(() => {
    if (messages.length > 0 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: START_INDEX - 1,
        behavior: 'auto',
      })
    }
  }, [messages.length])

  const ListHeader = () => (
    <div className="pt-4 px-6">
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
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">
            👋
          </div>
          <p className="mt-4 font-medium text-fg">Burada henüz mesaj yok.</p>
          <p className="mt-1 text-sm text-fg-muted">İlk mesajı sen gönder.</p>
        </div>
      )}
    </div>
  )

  const ListFooter = () => <div className="pb-4" />

  return (
    <div className="relative flex-1 overflow-hidden h-full">
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={messages.length > 0 ? START_INDEX - 1 : 0}
        scrollerRef={(el) => {
          if (scrollRef) {
            scrollRef.current = el as HTMLDivElement
          }
        }}
        style={{ height: '100%' }}
        className="h-full"
        computeItemKey={(_index, msg) => msg.id}
        startReached={() => {
          if (channelPaging?.hasMore && !channelPaging.loadingOlder) {
            onMessagesScroll()
          }
        }}
        followOutput={(isAtBottom) => isAtBottom}
        components={{
          Header: ListHeader,
          Footer: ListFooter,
        }}
        itemContent={(index, msg) => {
          const arrayIndex = index - firstItemIndex
          const prev = arrayIndex > 0 ? messages[arrayIndex - 1] : null
          const showDate = !prev || !sameDay(prev.createdAt, msg.createdAt)
          const grouped =
            !showDate &&
            prev !== null &&
            prev.sender.id === msg.sender.id &&
            new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS

          return (
            <div className="px-6">
              <MessageItem
                msg={msg}
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
                onStartEdit={onStartEdit}
                onDelete={onDelete}
                onHideForMe={onHideForMe}
                onQuote={() => onQuote(msg)}
                onForward={() => onForward(msg)}
                onTogglePin={() => onTogglePin(msg)}
                onToggleBookmark={() => onToggleBookmark(msg)}
                onEmojiReact={(emoji) => onEmojiReact(msg.id, emoji)}
                editingId={editingId}
                editDraft={editDraft}
                onEditDraftChange={onEditDraftChange}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                grouped={grouped}
                showDate={showDate}
                dateLabelText={showDate ? dateLabel(msg.createdAt, t, locale) : undefined}
              />
            </div>
          )
        }}
      />

      <ReactionOverlay items={flying} />
    </div>
  )
}
