import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { deleteChannel, kickMember, setMemberRole, updateChannel } from '../features/channels/channelsSlice'
import type { MemberResponse, MembershipRole } from '../api/types'
import Avatar from './Avatar'

function RoleBadge({ role }: { role: MembershipRole }) {
  if (role === 'OWNER') {
    return <span className="rounded-lg bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">OWNER</span>
  }
  if (role === 'MODERATOR') {
    return <span className="rounded-lg bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">MOD</span>
  }
  return <span className="rounded-lg bg-surface-muted px-1.5 py-0.5 text-[10px] text-fg-muted">üye</span>
}

const settingsInput =
  'w-full rounded-lg border border-control bg-surface px-3 py-1.5 text-sm text-fg outline-none transition placeholder:text-fg-faint focus:border-accent'

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
  const isOwner = myRole === 'OWNER'

  const [name, setName] = useState(channel?.name ?? '')
  const [description, setDescription] = useState(channel?.description ?? '')

  const onSaveChannel = () => {
    if (name.trim()) {
      dispatch(updateChannel({ channelId, name: name.trim(), description: description.trim() || undefined }))
    }
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
        className="w-full max-w-md rounded-2xl border border-border bg-surface-overlay p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Üyeler</h3>
          <button onClick={onClose} className="text-fg-muted transition hover:text-fg">
            ✕
          </button>
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {members.map((m) => {
            const isSelf = m.user.id === currentUserId
            const canManage = isOwner && !isSelf && m.role !== 'OWNER'
            return (
              <li key={m.user.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={m.user.displayName ?? m.user.username} color={m.user.avatarColor} size="sm" />
                  <span className="truncate text-sm text-fg">
                    {m.user.displayName ?? m.user.username}
                  </span>
                  <RoleBadge role={m.role} />
                </span>
                {canManage && (
                  <span className="flex shrink-0 gap-2 text-xs">
                    {m.role === 'MEMBER' ? (
                      <button
                        onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MODERATOR' }))}
                        className="text-accent transition hover:text-accent-hover"
                      >
                        Mod yap
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MEMBER' }))}
                        className="text-fg-muted transition hover:text-fg"
                      >
                        Mod al
                      </button>
                    )}
                    <button
                      onClick={() => dispatch(kickMember({ channelId, userId: m.user.id }))}
                      className="text-danger transition hover:text-danger-hover"
                    >
                      Çıkar
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        {isOwner && (
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="mb-2 text-sm font-medium text-fg-secondary">Kanal ayarları</h4>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kanal adı"
              className={`mb-2 ${settingsInput}`}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama"
              className={`mb-3 ${settingsInput}`}
            />
            <div className="flex justify-between">
              <button
                onClick={onSaveChannel}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white transition hover:bg-brand-hover"
              >
                Kaydet
              </button>
              <button
                onClick={onDeleteChannel}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-danger transition hover:bg-red-500/10"
              >
                Kanalı sil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
