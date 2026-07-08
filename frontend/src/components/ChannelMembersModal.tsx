import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { deleteChannel, kickMember, setMemberRole, updateChannel } from '../features/channels/channelsSlice'
import { blockUser, unblockUser } from '../features/blocks/blocksSlice'
import type { MemberResponse, MembershipRole } from '../api/types'
import Avatar from './Avatar'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'

function RoleBadge({ role }: { role: MembershipRole }) {
  if (role === 'OWNER') {
    return <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-2xs font-medium text-warning">OWNER</span>
  }
  if (role === 'MODERATOR') {
    return <span className="rounded-lg bg-indigo-500/20 px-2 py-0.5 text-2xs font-medium text-accent">MOD</span>
  }
  return <span className="rounded-lg bg-surface-muted px-2 py-0.5 text-2xs text-fg-muted">üye</span>
}

interface ChannelMembersModalProps {
  channelId: string
  members: MemberResponse[]
  myRole?: MembershipRole
  currentUserId?: string
  onClose: () => void
}

export default function ChannelMembersModal({
  channelId,
  members,
  myRole,
  currentUserId,
  onClose,
}: ChannelMembersModalProps) {
  const dispatch = useAppDispatch()
  const channel = useAppSelector((state) => state.channels.items.find((c) => c.id === channelId))
  const blockedIds = useAppSelector((state) => state.blocks.ids)
  const isOwner = myRole === 'OWNER'

  const [name, setName] = useState(channel?.name ?? '')
  const [description, setDescription] = useState(channel?.description ?? '')
  const panelRef = useDialog<HTMLDivElement>(onClose)

  const onSaveChannel = () => {
    const trimmedName = name.trim()
    const trimmedDesc = description.trim()
    if (!trimmedName) {
      alert('Kanal adı gereklidir.')
      return
    }
    if (trimmedName.length > 80) {
      alert('Kanal adı en fazla 80 karakter olabilir.')
      return
    }
    if (trimmedDesc.length > 500) {
      alert('Kanal açıklaması en fazla 500 karakter olabilir.')
      return
    }
    dispatch(updateChannel({ channelId, name: trimmedName, description: trimmedDesc || undefined }))
  }
  const onDeleteChannel = () => {
    if (window.confirm('Bu kanalı silmek istediğine emin misin? Geri alınamaz.')) {
      dispatch(deleteChannel(channelId))
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Üyeler"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-border bg-surface-overlay p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Üyeler</h3>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}
          >
            ✕
          </button>
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {members.map((m) => {
            const isSelf = m.user.id === currentUserId
            const canManage = isOwner && !isSelf && m.role !== 'OWNER'
            return (
              <li key={m.user.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={m.user.displayName ?? m.user.username} color={m.user.avatarColor} imageUrl={m.user.avatarUrl} size="sm" />
                  <span className="truncate text-sm text-fg">
                    {m.user.displayName ?? m.user.username}
                  </span>
                  <RoleBadge role={m.role} />
                </span>
                {!isSelf && (
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    {canManage && (
                      <>
                        {m.role === 'MEMBER' ? (
                          <button
                            onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MODERATOR' }))}
                            className={`rounded-lg text-accent transition hover:text-accent-hover ${focusRing}`}
                          >
                            Mod yap
                          </button>
                        ) : (
                          <button
                            onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MEMBER' }))}
                            className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}
                          >
                            Mod al
                          </button>
                        )}
                        <button
                          onClick={() => dispatch(kickMember({ channelId, userId: m.user.id }))}
                          className={`rounded-lg text-danger transition hover:text-danger-hover ${focusRing}`}
                        >
                          Çıkar
                        </button>
                      </>
                    )}
                    {blockedIds.includes(m.user.id) ? (
                      <button
                        onClick={() => dispatch(unblockUser(m.user.id))}
                        className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}
                      >
                        Engeli kaldır
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch(blockUser(m.user.id))}
                        className={`rounded-lg text-danger transition hover:text-danger-hover ${focusRing}`}
                      >
                        Engelle
                      </button>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        {isOwner && (
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="mb-2 text-sm font-medium text-fg-secondary">Kanal ayarları</h4>
            <Input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kanal adı"
              className="mb-2"
            />
            <Input
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama"
              className="mb-3"
            />
            <div className="flex justify-between">
              <Button onClick={onSaveChannel}>Kaydet</Button>
              <Button onClick={onDeleteChannel} variant="danger">
                Kanalı sil
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
