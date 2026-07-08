import { useState } from 'react'
import type { Channel, DirectChannel } from '../../api/types'
import Avatar from '../Avatar'
import Button from '../ui/Button'
import { focusRing } from '../ui/focusRing'
import { ttlLabel, TTL_OPTIONS } from '../../features/channels/channelsSlice'

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

function formatLastSeen(iso: string): string {
  const d = new Date(iso)
  const today = startOfDay(new Date())
  const that = startOfDay(d)
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (that === today) return `bugün ${time}`
  if (that === today - 86_400_000) return `dün ${time}`
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} ${time}`
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
  const borderC = 'border-border'

  return (
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
          onClick={onMuteToggle}
          title={isMuted ? 'Bildirimleri aç' : 'Sessize al'}
        >
          {isMuted ? '🔕' : '🔔'}
        </Button>
        <Button variant="secondary" size="sm" title="Medya" onClick={onShowGallery}>
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
              title="Kategori"
              onClick={onSetCategory}
            >
              📁
            </Button>
            <Button
              variant="secondary"
              size="sm"
              title={isArchived ? 'Arşivden çıkar' : 'Arşivle'}
              onClick={onToggleArchive}
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
                        onSetDisappearing(opt.value)
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
            onClick={onBlockToggle}
          >
            {blockedIds.includes(dmPartner.id) ? 'Engeli kaldır' : 'Engelle'}
          </Button>
        )}
        {dmPartner && (
          <Button
            variant="primary"
            size="sm"
            onClick={onCallStart}
            title="Görüntülü/Sesli Ara"
          >
            📞
          </Button>
        )}
        {aiEnabled && (
          <Button variant="secondary" size="sm" onClick={onSummarize} disabled={summarizing || isE2EE} title={isE2EE ? "Şifreli sohbetler özetlenemez" : "Yapay zeka ile özetle"}>
            {summarizing ? '✨ ...' : '✨ Özetle'}
          </Button>
        )}
        {pinnedLength > 0 && (
          <Button variant="secondary" size="sm" onClick={onShowPinned} title="Sabitlenenler">
            📌 {pinnedLength}
          </Button>
        )}
        {(!dm || dm.group) && (
          <Button variant="secondary" size="sm" onClick={onShowMembers}>
            Üyeler ({membersLength})
          </Button>
        )}
        {!dm && canModerate && (
          <Button variant="secondary" size="sm" onClick={onShowWebhooks} title="Incoming webhook'lar">
            🔗
          </Button>
        )}
      </div>
    </header>
  )
}
