import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import type { Channel, Message } from '../../api/types'
import Button from '../ui/Button'
import Avatar from '../Avatar'
import ReactionBar from '../ReactionBar'
import CommandHints from '../CommandHints'
import { focusRing } from '../ui/focusRing'
import { useT } from '../../i18n'

const EmojiPicker = lazy(() => import('../EmojiPicker'))
const GifPicker = lazy(() => import('../GifPicker'))
// TipTap/ProseMirror is by far the heaviest dependency of the chat route, so
// the editor loads as its own chunk instead of blocking first paint.
const RichTextEditor = lazy(() =>
  import('../ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
)

interface MessageComposerProps {
  channel: Channel
  draft: string
  onDraftChange: (val: string) => void
  onSubmit: () => void
  replyingTo: Message | null
  onClearReply: () => void
  attachment: { url: string; name: string | null; type: 'image' | 'file' | 'audio' } | null
  onClearAttachment: () => void
  uploading: boolean
  recording: boolean
  onRecordStart: () => void
  onRecordStop: () => void
  onPickFileClick: () => void
  onPickGif: (url: string) => void
  cmdError: string | null
  typingText: string
  members: any[]
  currentUser: { id: string; username: string; displayName?: string | null; avatarColor?: string | null; avatarUrl?: string | null } | null
  focusTrigger: number
  onPickCommand: (name: string) => void
  onShowScheduled: () => void
  onEmojiReact: (emoji: string) => void
}

export default function MessageComposer({
  channel,
  draft,
  onDraftChange,
  onSubmit,
  replyingTo,
  onClearReply,
  attachment,
  onClearAttachment,
  uploading,
  recording,
  onRecordStart,
  onRecordStop,
  onPickFileClick,
  onPickGif,
  cmdError,
  typingText,
  members,
  currentUser,
  focusTrigger,
  onPickCommand,
  onShowScheduled,
  onEmojiReact,
}: MessageComposerProps) {
  const { t } = useT()
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)

  const showHints = draft.startsWith('/') && !draft.includes(' ')

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
    onDraftChange(draft.replace(/@(\w*)$/, `@${username} `))
  }

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const borderC = 'border-border'

  return (
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
        <ReactionBar onReact={onEmojiReact} />
        <span className="min-w-0 flex-1 truncate text-right text-xs text-fg-muted">{typingText}</span>
      </div>
      {/* cmdError may be an i18n key (slash-command errors); t() passes plain strings through. */}
      {cmdError && <p className="mb-2 text-xs text-danger">{t(cmdError)}</p>}
      {replyingTo && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-l-2 border-accent/60 bg-surface-muted px-2 py-1 text-xs">
          <div className="min-w-0">
            <div className="font-medium text-fg-secondary">
              {t('composer.replyingTo', { name: replyingTo.sender.displayName ?? replyingTo.sender.username })}
            </div>
            <div className="truncate text-fg-faint">
              {replyingTo.content || (replyingTo.attachmentUrl ? `📷 ${t('msg.imagePlaceholder')}` : '')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
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
              <span>{t('composer.voice')}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-1 text-sm text-fg">
              <span>📄</span>
              <span className="max-w-[10rem] truncate">{attachment.name ?? t('composer.file')}</span>
            </span>
          )}
          <button
            type="button"
            onClick={onClearAttachment}
            className={`rounded-lg text-xs text-fg-muted transition hover:text-danger ${focusRing}`}
          >
            ✕ {t('common.remove')}
          </button>
        </div>
      )}
      <form onSubmit={onSend} className="flex items-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onPickFileClick}
          disabled={uploading}
          aria-label={t('composer.attach')}
          title={t('composer.attach')}
        >
          {uploading ? '…' : '📎'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onShowScheduled}
          aria-label={t('composer.scheduledAria')}
          title={t('composer.scheduleTooltip')}
        >
          ⏰
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
              <EmojiPicker
                onPick={(e) => {
                  onDraftChange(draft + e)
                }}
                onClose={() => setShowEmoji(false)}
              />
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
          onClick={recording ? onRecordStop : onRecordStart}
          disabled={uploading && !recording}
          aria-label={recording ? t('composer.stopRecording') : t('composer.recordVoice')}
          title={recording ? t('composer.stopRecordingSend') : t('composer.voice')}
        >
          {recording ? '⏹' : '🎤'}
        </Button>
        <Suspense fallback={<div className="min-h-[44px] w-full flex-1 rounded-xl border border-border bg-surface" aria-hidden />}>
          <RichTextEditor
            value={draft}
            onChange={onDraftChange}
            onEnter={onSubmit}
            placeholder={t('composer.placeholder', { channel: channel.name })}
            className="flex-1 w-full"
            autoFocus
            focusTrigger={focusTrigger}
          />
        </Suspense>
        <Button type="submit" disabled={uploading}>
          {t('composer.send')}
        </Button>
      </form>
      <div className="mt-2 flex items-center justify-between text-xs text-fg-faint">
        <p>
          {t('composer.hintMd')} · <span className="text-fg-muted">**{t('composer.hintBold')}**</span>{' '}
          <span className="text-fg-muted">*{t('composer.hintItalic')}*</span>{' '}
          <span className="text-fg-muted">`{t('composer.hintCode')}`</span> · {t('composer.hintBlock')} · {t('composer.hintEnter')}
        </p>
        {draft.length > 3000 && (
          <span className={`font-semibold shrink-0 select-none ${draft.length > 4000 ? 'text-danger animate-pulse' : ''}`}>
            {draft.length} / 4000
          </span>
        )}
      </div>
    </div>
  )
}
