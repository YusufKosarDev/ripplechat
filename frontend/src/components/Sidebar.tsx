import { useState, lazy, Suspense } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { setJumpTarget } from '../features/ui/uiSlice'
import { createChannel, createGroupDm, joinChannel, openDm, selectChannel } from '../features/channels/channelsSlice'
import { useT } from '../i18n'
import Avatar from './Avatar'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { focusRing } from './ui/focusRing'

// Mounted only on user action, so their code is split into on-demand chunks
// instead of riding along in the main chat bundle.
const NewDmModal = lazy(() => import('./NewDmModal'))
const SearchModal = lazy(() => import('./SearchModal'))
const SettingsModal = lazy(() => import('./SettingsModal'))
const SavedMessagesModal = lazy(() => import('./SavedMessagesModal'))
const DiscoverChannelsModal = lazy(() => import('./DiscoverChannelsModal'))
import type { Channel } from '../api/types'
import SkeletonLoader from './ui/SkeletonLoader'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useT()
  const { items, dms, selectedId, status } = useAppSelector((state) => state.channels)
  const user = useAppSelector((state) => state.auth.user)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const unreadCounts = useAppSelector((state) => state.unread.counts)
  const mentions = useAppSelector((state) => state.unread.mentions)
  const muted = useAppSelector((state) => state.muted.muted)
  const category = useAppSelector((state) => state.channelOrg.category)
  const archived = useAppSelector((state) => state.channelOrg.archived)
  const selfOnline = user ? onlineUserIds.includes(user.id) : false

  const [newName, setNewName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNewDm, setShowNewDm] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (name.length > 80) {
      alert('Kanal adı en fazla 80 karakter olabilir.')
      return
    }
    dispatch(createChannel({ name }))
    setNewName('')
  }
  const onJoin = (e: FormEvent) => {
    e.preventDefault()
    const id = joinId.trim()
    if (!id) return
    dispatch(joinChannel(id))
    setJoinId('')
  }
  const onLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const loadingChannels = status === 'loading' && items.length === 0
  const displayName = user?.displayName ?? user?.username ?? ''

  const activeItems = items.filter((c) => !archived[c.id])
  const archivedItems = items.filter((c) => archived[c.id])
  const uncategorized = activeItems.filter((c) => !category[c.id])
  const categoryNames = Array.from(
    new Set(activeItems.map((c) => category[c.id]).filter((x): x is string => !!x)),
  ).sort()
  const toggleCat = (cat: string) =>
    setCollapsedCats((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))

  const channelRow = (channel: Channel) => {
    const unread = selectedId === channel.id ? 0 : (unreadCounts[channel.id] ?? 0)
    return (
      <li key={channel.id}>
        <button
          onClick={() => {
            dispatch(selectChannel(channel.id))
            onClose()
          }}
          className={`${focusRing} flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
            selectedId === channel.id
              ? 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
              : unread > 0
                ? 'font-semibold text-fg hover:bg-surface-muted'
                : 'text-fg-secondary hover:bg-surface-muted'
          }`}
        >
          <span className="truncate">
            <span className="text-fg-faint">#</span> {channel.name}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {muted[channel.id] && <span className="text-fg-faint" title={t('sidebar.muted')}>🔕</span>}
            {mentions[channel.id] && selectedId !== channel.id && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-2xs font-bold text-white" title={t('sidebar.mentioned')}>
                @
              </span>
            )}
            {unread > 0 && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-2xs font-semibold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
        </button>
      </li>
    )
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 transform flex-col border-r border-border bg-surface-raised transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight text-fg">
              Ripple<span className="text-indigo-500 dark:text-indigo-400">Chat</span>
            </span>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button
                onClick={() => setShowSearch(true)}
                title={t('sidebar.search')}
                className={`rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
              >
                🔍
              </button>
              <button
                onClick={() => setShowSaved(true)}
                title={t('sidebar.saved')}
                className={`rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
              >
                🔖
              </button>
              {user?.admin && (
                <button
                  onClick={() => navigate('/admin')}
                  title={t('sidebar.admin')}
                  className={`rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
                >
                  🛡️
                </button>
              )}
              <ThemeToggle />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setShowSettings(true)}
              title={t('sidebar.settings')}
              className={`flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 transition hover:bg-surface-muted ${focusRing}`}
            >
              <Avatar name={displayName} color={user?.avatarColor} imageUrl={user?.avatarUrl} online={selfOnline} size="sm" />
              <span className="truncate text-sm text-fg-secondary">{displayName}</span>
              {user?.statusEmoji && (
                <span className="shrink-0 text-sm" title={user.statusText ?? undefined} aria-label={user.statusText ?? 'Durum'}>
                  {user.statusEmoji}
                </span>
              )}
            </button>
            <button
              onClick={onLogout}
              className={`shrink-0 rounded-lg text-xs text-fg-muted transition hover:text-fg ${focusRing}`}
            >
              {t('sidebar.logout')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-fg-faint">
            {t('sidebar.channels')}
          </div>

          {loadingChannels && <SkeletonLoader type="channel-list" count={3} />}

          {!loadingChannels && (
            <div className="mt-2">
              <ul className="space-y-0.5">{uncategorized.map(channelRow)}</ul>

              {categoryNames.map((cat) => {
                const collapsed = collapsedCats.includes(cat)
                return (
                  <div key={cat} className="mt-2">
                    <button
                      onClick={() => toggleCat(cat)}
                      className={`flex w-full items-center gap-1 px-2 text-2xs font-semibold uppercase tracking-wider text-fg-faint transition hover:text-fg-muted ${focusRing}`}
                    >
                      <span className="w-2">{collapsed ? '▸' : '▾'}</span> {cat}
                    </button>
                    {!collapsed && (
                      <ul className="mt-1 space-y-0.5">
                        {activeItems.filter((c) => category[c.id] === cat).map(channelRow)}
                      </ul>
                    )}
                  </div>
                )
              })}

              {archivedItems.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowArchived((s) => !s)}
                    className={`flex w-full items-center gap-1 px-2 text-2xs font-semibold uppercase tracking-wider text-fg-faint transition hover:text-fg-muted ${focusRing}`}
                  >
                    <span className="w-2">{showArchived ? '▾' : '▸'}</span> {t('sidebar.archived')} ({archivedItems.length})
                  </button>
                  {showArchived && <ul className="mt-1 space-y-0.5 opacity-70">{archivedItems.map(channelRow)}</ul>}
                </div>
              )}

              {items.length === 0 && (
                <p className="px-2 py-3 text-sm text-fg-muted">
                  {t('sidebar.noChannels')}
                  <br />
                  <span className="text-fg-faint">{t('sidebar.createOneBelow')}</span>
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between px-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
              {t('sidebar.directMessages')}
            </span>
            <button
              onClick={() => setShowNewDm(true)}
              title={t('sidebar.newDm')}
              className={`rounded-lg px-1 text-base leading-none text-fg-muted transition hover:text-fg ${focusRing}`}
            >
              +
            </button>
          </div>
          <ul className="mt-2 space-y-0.5">
            {dms.map((d) => {
              const name = d.group ? (d.name ?? t('sidebar.group')) : (d.otherUser?.displayName ?? d.otherUser?.username ?? 'DM')
              const unread = selectedId === d.id ? 0 : (unreadCounts[d.id] ?? 0)
              const online = !d.group && d.otherUser ? onlineUserIds.includes(d.otherUser.id) : false
              return (
                <li key={d.id}>
                  <button
                    onClick={() => {
                      dispatch(selectChannel(d.id))
                      onClose()
                    }}
                    className={`${focusRing} flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      selectedId === d.id
                        ? 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                        : unread > 0
                          ? 'font-semibold text-fg hover:bg-surface-muted'
                          : 'text-fg-secondary hover:bg-surface-muted'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {d.group ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm">
                          👥
                        </span>
                      ) : (
                        <Avatar name={name} color={d.otherUser?.avatarColor} imageUrl={d.otherUser?.avatarUrl} online={online} size="sm" />
                      )}
                      <span className="truncate">{name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {muted[d.id] && <span className="text-fg-faint" title={t('sidebar.muted')}>🔕</span>}
                      {mentions[d.id] && selectedId !== d.id && (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-2xs font-bold text-white" title={t('sidebar.mentioned')}>
                          @
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-2xs font-semibold text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
            {dms.length === 0 && (
              <li className="px-2 py-2 text-xs text-fg-faint">{t('sidebar.noDms')}</li>
            )}
          </ul>
        </div>

        <div className="space-y-3 border-t border-border px-3 py-3">
          <form onSubmit={onCreate} className="flex gap-2">
            <Input
              inputSize="sm"
              className="min-w-0 flex-1"
              value={newName}
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('sidebar.newChannel')}
            />
            <Button type="submit" size="sm" aria-label={t('sidebar.createChannel')}>
              +
            </Button>
          </form>
          <form onSubmit={onJoin} className="flex gap-2">
            <Input
              inputSize="sm"
              className="min-w-0 flex-1"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder={t('sidebar.joinById')}
            />
            <Button type="submit" variant="secondary" size="sm">
              {t('sidebar.join')}
            </Button>
          </form>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setShowDiscover(true)}
          >
            🧭 {t('sidebar.discover')}
          </Button>
        </div>
      </aside>

      <Suspense fallback={null}>
        {showSearch && (
          <SearchModal
            onPick={(channelId, messageId) => {
              dispatch(selectChannel(channelId))
              dispatch(setJumpTarget(messageId))
              setShowSearch(false)
              onClose()
            }}
            onClose={() => setShowSearch(false)}
          />
        )}

        {showSaved && <SavedMessagesModal onClose={() => setShowSaved(false)} />}

        {showDiscover && (
          <DiscoverChannelsModal
            onClose={() => setShowDiscover(false)}
            onJoined={(channelId) => {
              dispatch(selectChannel(channelId))
              setShowDiscover(false)
              onClose()
            }}
          />
        )}

        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

        {showNewDm && (
          <NewDmModal
            onStart={(userIds, name) => {
              if (userIds.length === 1) dispatch(openDm(userIds[0]))
              else dispatch(createGroupDm({ userIds, name }))
              setShowNewDm(false)
              onClose()
            }}
            onClose={() => setShowNewDm(false)}
          />
        )}
      </Suspense>
    </>
  )
}
