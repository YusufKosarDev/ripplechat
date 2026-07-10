import { lazy, Suspense } from 'react'
import type { Message, DirectChannel } from '../../api/types'
import Avatar from '../Avatar'
import MessageContent from '../MessageContent'
import LinkPreviewCard from '../LinkPreviewCard'
import MessageAttachment from '../MessageAttachment'
import MessageReactions from '../MessageReactions'
import MessageActions from '../MessageActions'
import Button from '../ui/Button'
import { focusRing } from '../ui/focusRing'
import { isEncrypted } from '../../crypto/e2ee'
import { dateLocale, useT } from '../../i18n'

// Loaded on demand: the TipTap editor is only needed when a message enters
// edit mode (the composer lazy-loads the same chunk).
const RichTextEditor = lazy(() =>
  import('../ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
)

const DECRYPT_FAILED = '__rc_decrypt_failed__'

interface MessageItemProps {
  msg: Message
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
  onQuote: () => void
  onForward: () => void
  onTogglePin: () => void
  onToggleBookmark: () => void
  onEmojiReact: (emoji: string) => void
  editingId: string | null
  editDraft: string
  onEditDraftChange: (val: string) => void
  onSaveEdit: (msg: Message) => void
  onCancelEdit: () => void
  grouped: boolean
  showDate: boolean
  dateLabelText?: string
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>]+/)
  return match ? match[0].replace(/[.,;:!?)\]]+$/, '') : null
}

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function MessageItem({
  msg,
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
  grouped,
  showDate,
  dateLabelText,
}: MessageItemProps) {
  const { t, lang } = useT()
  const locale = dateLocale(lang)
  const mine = msg.sender.id === currentUser?.id
  const canDelete = mine || canModerate
  const readByOther =
    !!otherLastRead && new Date(otherLastRead).getTime() >= new Date(msg.createdAt).getTime()
  const encryptedMsg = isEncrypted(msg.content)
  const dec = encryptedMsg ? decrypted[msg.id] : undefined
  const decryptFailed = dec === DECRYPT_FAILED
  const shownContent = encryptedMsg ? (dec && !decryptFailed ? dec : null) : msg.content

  let e2eeAttachment = null
  let parsedContent = shownContent
  if (shownContent && shownContent.startsWith('{"_e2ee":')) {
    try {
      const parsed = JSON.parse(shownContent)
      parsedContent = parsed.text
      e2eeAttachment = parsed.attachment
    } catch (e) {
      console.error('Failed to parse E2EE JSON:', e)
    }
  }

  const linkUrl = !msg.deleted && parsedContent ? extractFirstUrl(parsedContent) : null
  const senderName = msg.sender.displayName ?? msg.sender.username

  const renderBody = () => {
    if (msg.deleted) {
      return <p className="text-sm italic text-fg-faint">{t('msg.deleted')}</p>
    }
    if (editingId === msg.id) {
      return (
        <div className="mt-1">
          <Suspense fallback={<div className="min-h-[44px] rounded-xl border border-border bg-surface" aria-hidden />}>
            <RichTextEditor
              value={editDraft}
              onChange={onEditDraftChange}
              onEnter={() => onSaveEdit(msg)}
              autoFocus
            />
          </Suspense>
          <div className="mt-1 flex gap-2">
            <Button onClick={() => onSaveEdit(msg)} size="sm">
              {t('msg.save')}
            </Button>
            <Button onClick={onCancelEdit} variant="secondary" size="sm">
              {t('msg.cancel')}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div>
        {msg.forwarded && <div className="mb-0.5 text-xs italic text-fg-faint">↪ {t('msg.forwarded')}</div>}
        {msg.pinned && <div className="mb-0.5 text-xs text-amber-600 dark:text-amber-500">📌 {t('msg.pinnedBadge')}</div>}
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
              ? t('msg.encLocked')
              : decryptFailed
                ? t('msg.encFailed')
                : t('msg.encDecrypting')}
          </span>
        ) : (
          parsedContent && <MessageContent content={parsedContent} />
        )}
        <MessageAttachment
          msg={
            e2eeAttachment
              ? ({
                  ...msg,
                  attachmentUrl: e2eeAttachment.url,
                  attachmentName: e2eeAttachment.name,
                  attachmentType: e2eeAttachment.type,
                  e2eeAttachment,
                } as any)
              : msg
          }
        />
        {linkUrl && <LinkPreviewCard url={linkUrl} />}
        {msg.editedAt && (
          <button
            type="button"
            onClick={() => onShowHistory(msg)}
            className={`text-xs text-fg-faint underline decoration-dotted hover:text-fg ${focusRing}`}
            title={t('msg.editHistory')}
          >
            {t('msg.edited')}
          </button>
        )}
        {msg.expiresAt && !msg.deleted && (
          <span className="text-xs text-fg-faint" title={t('msg.disappearsAt', { when: new Date(msg.expiresAt).toLocaleString(locale) })}>
            ⏲️
          </span>
        )}
        {msg.sending && (
          <span className="ml-1.5 align-middle text-xs text-fg-faint animate-pulse" title={t('msg.sending')}>
            ⏳
          </span>
        )}
        {!msg.sending && dm && dm.otherUser && mine && !msg.deleted && (
          <span
            title={readByOther ? t('msg.read') : t('msg.delivered')}
            className={`ml-1.5 align-middle text-xs ${readByOther ? 'text-accent' : 'text-fg-faint'}`}
          >
            ✓✓
          </span>
        )}
        {!msg.deleted && !msg.sending && (
          <span className="ml-2 inline-flex gap-2 text-xs text-fg-muted sr-only group-hover:not-sr-only group-focus-within:not-sr-only">
            {mine && (
              <button onClick={() => onStartEdit(msg)} className={`rounded-lg hover:text-fg ${focusRing}`}>
                {t('msg.edit')}
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(msg)} className={`rounded-lg hover:text-danger ${focusRing}`}>
                {t('msg.deleteForEveryone')}
              </button>
            )}
            <button onClick={() => onHideForMe(msg)} className={`rounded-lg hover:text-danger ${focusRing}`}>
              {t('msg.deleteForMe')}
            </button>
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      id={`msg-${msg.id}`}
      className={`group -mx-2 rounded-lg px-2 transition-colors hover:bg-surface-muted/50 ${msg.sending ? 'opacity-70 select-none' : ''}`}
    >
      {showDate && dateLabelText && (
        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-fg-muted">
            {dateLabelText}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {grouped ? (
        <div className="pl-12">{renderBody()}</div>
      ) : (
        <div className="mt-3 flex gap-3">
          <Avatar
            name={senderName}
            color={msg.sender.avatarColor}
            imageUrl={msg.sender.avatarUrl}
            online={onlineUserIds.includes(msg.sender.id)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-fg">{senderName}</span>
              <span className="text-xs text-fg-faint">
                {formatTime(msg.createdAt, locale)}
                {msg.sending && <span className="ml-1 opacity-70" title={t('msg.sendingPending')}>🕒</span>}
              </span>
            </div>
            {renderBody()}
          </div>
        </div>
      )}

      <MessageActions
        msg={msg}
        bookmarked={bookmarkedIds.includes(msg.id)}
        onOpenThread={onQuote} // Thread handling is passed down
        onQuote={onQuote}
        onForward={onForward}
        onTogglePin={onTogglePin}
        onToggleBookmark={onToggleBookmark}
      />

      {!msg.deleted && (
        <div className="pl-12">
          <MessageReactions
            reactions={msg.reactions}
            currentUsername={currentUser?.username ?? ''}
            onToggle={onEmojiReact}
          />
        </div>
      )}
    </div>
  )
}
