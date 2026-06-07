import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { createChannel, joinChannel, selectChannel } from '../features/channels/channelsSlice'
import Avatar from './Avatar'

export default function Sidebar() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items, selectedId, status } = useAppSelector((state) => state.channels)
  const user = useAppSelector((state) => state.auth.user)
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)
  const selfOnline = user ? onlineUserIds.includes(user.id) : false

  const [newName, setNewName] = useState('')
  const [joinId, setJoinId] = useState('')

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
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="text-lg font-semibold tracking-tight">
          Ripple<span className="text-indigo-400">Chat</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={displayName} online={selfOnline} size="sm" />
            <span className="truncate text-sm text-slate-300">{displayName}</span>
          </span>
          <button onClick={onLogout} className="shrink-0 text-xs text-slate-500 transition hover:text-slate-300">
            Çıkış
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Kanallar
        </div>

        {loadingChannels && (
          <div className="mt-2 space-y-1.5 px-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-slate-800/70" />
            ))}
          </div>
        )}

        {!loadingChannels && (
          <ul className="mt-2 space-y-0.5">
            {items.map((channel) => (
              <li key={channel.id}>
                <button
                  onClick={() => dispatch(selectChannel(channel.id))}
                  className={`w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition ${
                    selectedId === channel.id
                      ? 'bg-indigo-500/20 text-indigo-200'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-slate-500">#</span> {channel.name}
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-2 py-3 text-sm text-slate-500">
                Henüz kanalın yok.
                <br />
                <span className="text-slate-600">Aşağıdan bir tane oluştur.</span>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-800 px-3 py-3">
        <form onSubmit={onCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni kanal"
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
          />
          <button className="rounded-md bg-indigo-600 px-2.5 py-1 text-sm text-white transition hover:bg-indigo-500">
            +
          </button>
        </form>
        <form onSubmit={onJoin} className="flex gap-2">
          <input
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Kanal ID ile katıl"
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
          />
          <button className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500">
            Katıl
          </button>
        </form>
      </div>
    </aside>
  )
}
