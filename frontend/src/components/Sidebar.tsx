import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { createChannel, joinChannel, selectChannel } from '../features/channels/channelsSlice'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import SearchModal from './SearchModal'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const inputClass =
  'min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950/60 dark:placeholder:text-slate-600'

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
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 transform flex-col border-r border-slate-200 bg-slate-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0 dark:border-slate-800 dark:bg-slate-900/40 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Ripple<span className="text-indigo-500 dark:text-indigo-400">Chat</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSearch(true)}
                title="Mesajlarda ara"
                className="rounded-md p-1 text-base leading-none text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
              >
                🔍
              </button>
              <ThemeToggle />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={displayName} online={selfOnline} size="sm" />
              <span className="truncate text-sm text-slate-600 dark:text-slate-300">{displayName}</span>
            </span>
            <button
              onClick={onLogout}
              className="shrink-0 text-xs text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-300"
            >
              Çıkış
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Kanallar
          </div>

          {loadingChannels && (
            <div className="mt-2 space-y-1.5 px-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-slate-200 dark:bg-slate-800/70" />
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
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                        selectedId === channel.id
                          ? 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                          : unread > 0
                            ? 'font-semibold text-slate-900 hover:bg-slate-200/70 dark:text-white dark:hover:bg-slate-800/60'
                            : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">
                        <span className="text-slate-400 dark:text-slate-500">#</span> {channel.name}
                      </span>
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
              {items.length === 0 && (
                <li className="px-2 py-3 text-sm text-slate-500">
                  Henüz kanalın yok.
                  <br />
                  <span className="text-slate-400 dark:text-slate-600">Aşağıdan bir tane oluştur.</span>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-200 px-3 py-3 dark:border-slate-800">
          <form onSubmit={onCreate} className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Yeni kanal" className={inputClass} />
            <button className="rounded-md bg-indigo-600 px-2.5 py-1 text-sm text-white transition hover:bg-indigo-500">
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
            <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500">
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
    </>
  )
}
