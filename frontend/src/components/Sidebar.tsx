import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { createChannel, joinChannel, selectChannel } from '../features/channels/channelsSlice'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import SearchModal from './SearchModal'
import SettingsModal from './SettingsModal'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const inputClass =
  'min-w-0 flex-1 rounded-lg border border-control bg-surface px-2 py-1 text-sm outline-none transition placeholder:text-fg-faint focus:border-accent'

export default function Sidebar({ open, onClose }: SidebarProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items, selectedId, status } = useAppSelector((state) => state.channels)
  const user = useAppSelector((state) => state.auth.user)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const unreadCounts = useAppSelector((state) => state.unread.counts)
  const selfOnline = user ? onlineUserIds.includes(user.id) : false

  const [newName, setNewName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
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
              <button
                onClick={() => setShowSearch(true)}
                title="Mesajlarda ara"
                className="rounded-lg p-1 text-base leading-none text-fg-muted transition hover:text-fg"
              >
                🔍
              </button>
              <ThemeToggle />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setShowSettings(true)}
              title="Ayarlar"
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 transition hover:bg-surface-muted"
            >
              <Avatar name={displayName} color={user?.avatarColor} online={selfOnline} size="sm" />
              <span className="truncate text-sm text-fg-secondary">{displayName}</span>
            </button>
            <button
              onClick={onLogout}
              className="shrink-0 text-xs text-fg-muted transition hover:text-fg"
            >
              Çıkış
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-fg-faint">
            Kanallar
          </div>

          {loadingChannels && (
            <div className="mt-2 space-y-1.5 px-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded-lg bg-surface-muted" />
              ))}
            </div>
          )}

          {!loadingChannels && (
            <ul className="mt-2 space-y-0.5">
              {items.map((channel) => {
                const unread = selectedId === channel.id ? 0 : (unreadCounts[channel.id] ?? 0)
                return (
                  <li key={channel.id}>
                    <button
                      onClick={() => {
                        dispatch(selectChannel(channel.id))
                        onClose()
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
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
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
              {items.length === 0 && (
                <li className="px-2 py-3 text-sm text-fg-muted">
                  Henüz kanalın yok.
                  <br />
                  <span className="text-fg-faint">Aşağıdan bir tane oluştur.</span>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-border px-3 py-3">
          <form onSubmit={onCreate} className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Yeni kanal" className={inputClass} />
            <button className="rounded-lg bg-brand px-2.5 py-1 text-sm text-white transition hover:bg-brand-hover">
              +
            </button>
          </form>
          <form onSubmit={onJoin} className="flex gap-2">
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Kanal ID ile katıl"
              className={`${inputClass} text-xs`}
            />
            <button className="rounded-lg border border-control px-2 py-1 text-xs text-fg-muted transition hover:border-control-hover">
              Katıl
            </button>
          </form>
        </div>
      </aside>

      {showSearch && (
        <SearchModal
          onPick={(channelId) => {
            dispatch(selectChannel(channelId))
            setShowSearch(false)
            onClose()
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
