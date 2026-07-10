import { useState } from 'react'
import type { Channel, DirectChannel } from '../../api/types'
import Avatar from '../Avatar'
import Button from '../ui/Button'
import { focusRing } from '../ui/focusRing'
import { ttlLabel, TTL_OPTIONS } from '../../features/channels/channelsSlice'
import { dateLocale, useT } from '../../i18n'

interface ChannelHeaderProps {
  channel: Channel
  dm: DirectChannel | null
  isMuted: boolean
  onMuteToggle: () => void
  onShowGallery: () => void
  onShowWebhooks: () => void
  onShowMembers: () => void
  onShowPinned: () => void
  onSummarize: () => void
  summarizing: boolean
  aiEnabled: boolean
  isE2EE: boolean
  passphrase?: string
  dmPartner: { id: string; username: string; displayName?: string | null; avatarColor?: string | null; avatarUrl?: string | null; lastSeenAt?: string | null; publicKey?: string | null } | null
  blockedIds: string[]
  onlineUserIds: string[]
  partnerOnline: boolean
  membersLength: number
  pinnedLength: number
  canModerate: boolean
  isArchived: boolean
  onOpenSidebar: () => void
  onCallStart: () => void
  onSetCategory: () => void
  onToggleArchive: () => void
  onSetDisappearing: (ttlSeconds: number | null) => void
  onBlockToggle: () => void
  onPassphraseToggle: () => void
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function formatLastSeen(iso: string, t: (key: string, vars?: Record<string, string | number>) => string, locale: string): string {
  const d = new Date(iso)
  const today = startOfDay(new Date())
  const that = startOfDay(d)
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (that === today) return t('date.todayAt', { time })
  if (that === today - 86_400_000) return t('date.yesterdayAt', { time })
  return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })} ${time}`
}

export default function ChannelHeader({
  channel,
  dm,
  isMuted,
  onMuteToggle,
  onShowGallery,
  onShowWebhooks,
  onShowMembers,
  onShowPinned,
  onSummarize,
  summarizing,
  aiEnabled,
  isE2EE,
  passphrase,
  dmPartner,
  blockedIds,
  onlineUserIds,
  partnerOnline,
  membersLength,
  pinnedLength,
  canModerate,
  isArchived,
  onOpenSidebar,
  onCallStart,
  onSetCategory,
  onToggleArchive,
  onSetDisappearing,
  onBlockToggle,
  onPassphraseToggle,
}: ChannelHeaderProps) {
  const [showTtl, setShowTtl] = useState(false)
  const { t, lang } = useT()
  const locale = dateLocale(lang)
  const borderC = 'border-border'

  return (
    <header className={`flex items-center justify-between gap-3 border-b px-4 py-4 md:px-6 ${borderC}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="secondary" size="sm" onClick={onOpenSidebar} className="shrink-0 md:hidden" title={t('chat.channels')}>
          ☰
        </Button>
        {dm && dm.group ? (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-lg">
              👥
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight">{channel.name}</h2>
              <p className="truncate text-sm text-fg-muted">{t('chat.memberCount', { n: dm.participants.length + 1 })}</p>
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
              <h2 className="truncate text-base font-semibold tracking-tight">
                {channel.name}
                {dm.otherUser.statusEmoji && (
                  <span className="ml-1.5 font-normal" title={dm.otherUser.statusText ?? undefined}>
                    {dm.otherUser.statusEmoji}
                  </span>
                )}
              </h2>
              <p className="truncate text-sm text-fg-muted">
                {dm.otherUser.statusText
                  ? dm.otherUser.statusText
                  : partnerOnline
                    ? t('chat.online')
                    : dm.otherUser.lastSeenAt
                      ? t('chat.lastSeen', { when: formatLastSeen(dm.otherUser.lastSeenAt, t, locale) })
                      : t('chat.offline')}
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
          onClick={onMuteToggle}
          title={isMuted ? t('chat.unmute') : t('chat.mute')}
        >
          {isMuted ? '🔕' : '🔔'}
        </Button>
        <Button variant="secondary" size="sm" title={t('chat.media')} onClick={onShowGallery}>
          🖼️
        </Button>
        {dm && (
          dmPartner?.publicKey ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-1 rounded" title={t('chat.e2eeAutoTooltip')}>
              🔒 {t('chat.e2eeActive')}
            </div>
          ) : (
            <Button
              variant={passphrase ? 'primary' : 'secondary'}
              size="sm"
              aria-label={t('chat.e2ee')}
              title={passphrase ? t('chat.e2eeOn') : t('chat.e2ee')}
              onClick={onPassphraseToggle}
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
              title={t('chat.category')}
              onClick={onSetCategory}
            >
              📁
            </Button>
            <Button
              variant="secondary"
              size="sm"
              title={isArchived ? t('chat.unarchive') : t('chat.archive')}
              onClick={onToggleArchive}
            >
              {isArchived ? '📂' : '🗄️'}
            </Button>
            <div className="relative">
              <Button
                variant={channel.messageTtlSeconds ? 'primary' : 'secondary'}
                size="sm"
                title={t('chat.disappearing')}
                onClick={() => setShowTtl((s) => !s)}
              >
                {channel.messageTtlSeconds ? `⏲️ ${ttlLabel(channel.messageTtlSeconds, t)}` : '⏲️'}
              </Button>
              {showTtl && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface-overlay py-1 shadow-elevated">
                  <p className="px-3 py-1 text-xs text-fg-faint">{t('chat.disappearAfter')}</p>
                  {TTL_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => {
                        onSetDisappearing(opt.value)
                        setShowTtl(false)
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-fg transition hover:bg-surface-muted ${focusRing}`}
                    >
                      <span>{opt.n ? t(opt.labelKey, { n: opt.n }) : t(opt.labelKey)}</span>
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
            onClick={onBlockToggle}
          >
            {blockedIds.includes(dmPartner.id) ? t('chat.unblock') : t('chat.block')}
          </Button>
        )}
        {dmPartner && (
          <Button
            variant="primary"
            size="sm"
            onClick={onCallStart}
            title={t('chat.call')}
          >
            📞
          </Button>
        )}
        {aiEnabled && (
          <Button variant="secondary" size="sm" onClick={onSummarize} disabled={summarizing || isE2EE} title={isE2EE ? t('chat.summarizeE2ee') : t('chat.summarizeTooltip')}>
            {summarizing ? '✨ ...' : `✨ ${t('chat.summarize')}`}
          </Button>
        )}
        {pinnedLength > 0 && (
          <Button variant="secondary" size="sm" onClick={onShowPinned} title={t('chat.pinnedTitle')}>
            📌 {pinnedLength}
          </Button>
        )}
        {(!dm || dm.group) && (
          <Button variant="secondary" size="sm" onClick={onShowMembers}>
            {t('chat.members', { n: membersLength })}
          </Button>
        )}
        {!dm && canModerate && (
          <Button variant="secondary" size="sm" onClick={onShowWebhooks} title={t('chat.webhooks')}>
            🔗
          </Button>
        )}
      </div>
    </header>
  )
}
