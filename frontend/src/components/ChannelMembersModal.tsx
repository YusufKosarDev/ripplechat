import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { deleteChannel, kickMember, setMemberRole, updateChannel } from '../features/channels/channelsSlice'
import type { MemberResponse, MembershipRole } from '../api/types'
import Avatar from './Avatar'

function RoleBadge({ role }: { role: MembershipRole }) {
  if (role === 'OWNER') {
    return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">OWNER</span>
  }
  if (role === 'MODERATOR') {
    return <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">MOD</span>
  }
  return <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">üye</span>
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
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Üyeler</h3>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-300">
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
                  <Avatar name={m.user.displayName ?? m.user.username} size="sm" />
                  <span className="truncate text-sm text-slate-200">{m.user.displayName ?? m.user.username}</span>
                  <RoleBadge role={m.role} />
                </span>
                {canManage && (
                  <span className="flex shrink-0 gap-2 text-xs">
                    {m.role === 'MEMBER' ? (
                      <button
                        onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MODERATOR' }))}
                        className="text-indigo-400 transition hover:text-indigo-300"
                      >
                        Mod yap
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MEMBER' }))}
                        className="text-slate-400 transition hover:text-slate-200"
                      >
                        Mod al
                      </button>
                    )}
                    <button
                      onClick={() => dispatch(kickMember({ channelId, userId: m.user.id }))}
                      className="text-red-400 transition hover:text-red-300"
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
          <div className="mt-6 border-t border-slate-800 pt-4">
            <h4 className="mb-2 text-sm font-medium text-slate-300">Kanal ayarları</h4>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kanal adı"
              className="mb-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm outline-none transition focus:border-indigo-500"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama"
              className="mb-3 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm outline-none transition focus:border-indigo-500"
            />
            <div className="flex justify-between">
              <button
                onClick={onSaveChannel}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white transition hover:bg-indigo-500"
              >
                Kaydet
              </button>
              <button
                onClick={onDeleteChannel}
                className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10"
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
