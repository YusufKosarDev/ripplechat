import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { addMember, deleteChannel, kickMember, setMemberRole, updateChannel } from '../features/channels/channelsSlice'
import { blockUser, unblockUser } from '../features/blocks/blocksSlice'
import { client } from '../api/client'
import type { MemberResponse, MembershipRole, UserSummary } from '../api/types'
import Avatar from './Avatar'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'
import { useDialog } from './ui/useDialog'
import { useT } from '../i18n'

function RoleBadge({ role }: { role: MembershipRole }) {
  const { t } = useT()
  if (role === 'OWNER') {
    return <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-2xs font-medium text-warning">OWNER</span>
  }
  if (role === 'MODERATOR') {
    return <span className="rounded-lg bg-indigo-500/20 px-2 py-0.5 text-2xs font-medium text-accent">MOD</span>
  }
  return <span className="rounded-lg bg-surface-muted px-2 py-0.5 text-2xs text-fg-muted">{t('members.member')}</span>
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
  const { t } = useT()
  const dispatch = useAppDispatch()
  const channel = useAppSelector((state) => state.channels.items.find((c) => c.id === channelId))
  const blockedIds = useAppSelector((state) => state.blocks.ids)
  const isOwner = myRole === 'OWNER'
  const canModerate = myRole === 'OWNER' || myRole === 'MODERATOR'

  const [name, setName] = useState(channel?.name ?? '')
  const [description, setDescription] = useState(channel?.description ?? '')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<UserSummary[]>([])
  const [searching, setSearching] = useState(false)
  const panelRef = useDialog<HTMLDivElement>(onClose)

  // Debounced people search for the add-member picker. Derived state is settled
  // during render and only the fetch lives in the effect — same shape as
  // NewDmModal, which is also what keeps set-state-in-effect quiet.
  const trimmedSearch = search.trim()
  if (trimmedSearch.length < 2 && results.length > 0) {
    setResults([])
  }
  if (trimmedSearch.length < 2 && searching) {
    setSearching(false)
  }
  if (trimmedSearch.length >= 2 && !searching) {
    setSearching(true)
  }

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) return
    const timer = setTimeout(async () => {
      try {
        const { data } = await client.get<UserSummary[]>('/api/users/search', { params: { q: term } })
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Someone already in the channel is not a candidate.
  const memberIds = new Set(members.map((m) => m.user.id))
  const candidates = results.filter((u) => !memberIds.has(u.id))

  const onAddMember = (userId: string) => {
    dispatch(addMember({ channelId, userId }))
    setSearch('')
    setResults([])
  }

  const onSaveChannel = () => {
    const trimmedName = name.trim()
    const trimmedDesc = description.trim()
    if (!trimmedName) {
      alert(t('members.nameRequired'))
      return
    }
    if (trimmedName.length > 80) {
      alert(t('sidebar.channelNameTooLong'))
      return
    }
    if (trimmedDesc.length > 500) {
      alert(t('members.descTooLong'))
      return
    }
    dispatch(updateChannel({ channelId, name: trimmedName, description: trimmedDesc || undefined }))
  }
  const onDeleteChannel = () => {
    if (window.confirm(t('members.deleteConfirm'))) {
      dispatch(deleteChannel(channelId))
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('members.title')}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-border bg-surface-overlay p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">{t('members.title')}</h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
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
                            {t('members.makeMod')}
                          </button>
                        ) : (
                          <button
                            onClick={() => dispatch(setMemberRole({ channelId, userId: m.user.id, role: 'MEMBER' }))}
                            className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}
                          >
                            {t('members.removeMod')}
                          </button>
                        )}
                        <button
                          onClick={() => dispatch(kickMember({ channelId, userId: m.user.id }))}
                          className={`rounded-lg text-danger transition hover:text-danger-hover ${focusRing}`}
                        >
                          {t('members.kick')}
                        </button>
                      </>
                    )}
                    {blockedIds.includes(m.user.id) ? (
                      <button
                        onClick={() => dispatch(unblockUser(m.user.id))}
                        className={`rounded-lg text-fg-muted transition hover:text-fg ${focusRing}`}
                      >
                        {t('chat.unblock')}
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch(blockUser(m.user.id))}
                        className={`rounded-lg text-danger transition hover:text-danger-hover ${focusRing}`}
                      >
                        {t('chat.block')}
                      </button>
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        {canModerate && (
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('members.addMember')}</h4>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('members.addMemberPlaceholder')}
              aria-label={t('members.addMember')}
            />
            {candidates.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {candidates.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => onAddMember(u.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition hover:bg-surface-muted ${focusRing}`}
                    >
                      <Avatar name={u.displayName ?? u.username} color={u.avatarColor} imageUrl={u.avatarUrl} size="sm" />
                      <span className="truncate text-sm text-fg">{u.displayName ?? u.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim().length >= 2 && !searching && candidates.length === 0 && (
              <p className="mt-2 text-xs text-fg-muted">{t('members.noCandidates')}</p>
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="mb-2 text-sm font-medium text-fg-secondary">{t('members.channelSettings')}</h4>
            <Input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('members.namePlaceholder')}
              className="mb-2"
            />
            <Input
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('members.descPlaceholder')}
              className="mb-3"
            />
            <div className="flex justify-between">
              <Button onClick={onSaveChannel}>{t('msg.save')}</Button>
              <Button onClick={onDeleteChannel} variant="danger">
                {t('members.deleteChannel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
