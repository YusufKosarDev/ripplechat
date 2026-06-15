import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { fetchChannels, fetchDms } from '../features/channels/channelsSlice'
import { setConnectionStatus } from '../features/connection/connectionSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { fetchOnline, presenceChanged } from '../features/presence/presenceSlice'
import { addMention, incrementUnread } from '../features/unread/unreadSlice'
import { fetchBlocks } from '../features/blocks/blocksSlice'
import { connectChat, disconnectChat, setPresenceHandler, watchAllChannels } from '../realtime/chatSocket'
import Sidebar from '../components/Sidebar'
import ChannelPanel from '../components/ChannelPanel'
import ThreadPanel from '../components/ThreadPanel'

// True if the message text @mentions the given username (standalone token).
function mentionsUser(content: string, username: string): boolean {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\w@])@${escaped}\\b`, 'i').test(content ?? '')
}

export default function ChatPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const selectedId = useAppSelector((state) => state.channels.selectedId)
  const channelIds = useAppSelector((state) =>
    [...state.channels.items.map((c) => c.id), ...state.channels.dms.map((d) => d.id)].join(','),
  )
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const currentUsername = useAppSelector((state) => state.auth.user?.username)
  const muted = useAppSelector((state) => state.muted.muted)
  const blockedIds = useAppSelector((state) => state.blocks.ids)
  const totalUnread = useAppSelector((state) =>
    Object.values(state.unread.counts).reduce((sum, n) => sum + n, 0),
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Keep the latest values available to the (stable) realtime handlers.
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const currentUserIdRef = useRef(currentUserId)
  currentUserIdRef.current = currentUserId
  const currentUsernameRef = useRef(currentUsername)
  currentUsernameRef.current = currentUsername
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const blockedRef = useRef(blockedIds)
  blockedRef.current = blockedIds

  useEffect(() => {
    connectChat({
      onStatus: (status) => dispatch(setConnectionStatus(status)),
      onReconnect: () => {
        // Refresh after a gap: presence list + the open channel's history
        // (dedup keeps any messages missed while offline from duplicating).
        dispatch(fetchOnline())
        const id = selectedIdRef.current
        if (id) dispatch(fetchMessages(id))
      },
      onAuthError: () => {
        dispatch(logout())
        navigate('/login')
      },
    })
    setPresenceHandler((event) => dispatch(presenceChanged(event)))
    dispatch(fetchOnline())
    dispatch(fetchChannels())
    dispatch(fetchDms())
    dispatch(fetchBlocks())
    return () => disconnectChat()
  }, [dispatch, navigate])

  // Subscribe to every channel's message topic so unread counts stay accurate
  // even for channels the user isn't currently viewing.
  useEffect(() => {
    const ids = channelIds ? channelIds.split(',') : []
    watchAllChannels(ids, (msg) => {
      if (blockedRef.current.includes(msg.sender.id)) return
      dispatch(messageReceived(msg))
      if (
        msg.channelId !== selectedIdRef.current &&
        msg.sender.id !== currentUserIdRef.current &&
        !mutedRef.current[msg.channelId]
      ) {
        dispatch(incrementUnread(msg.channelId))
        const uname = currentUsernameRef.current
        if (uname && mentionsUser(msg.content, uname)) {
          dispatch(addMention(msg.channelId))
        }
      }
    })
  }, [channelIds, dispatch])

  // Reflect total unread in the tab title (e.g. "(3) RippleChat").
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) RippleChat` : 'RippleChat'
    return () => {
      document.title = 'RippleChat'
    }
  }, [totalUnread])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface-overlay focus:px-3 focus:py-2 focus:text-sm focus:shadow-elevated"
      >
        İçeriğe geç
      </a>
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ChannelPanel onOpenSidebar={() => setSidebarOpen(true)} />
        <ThreadPanel />
      </div>
    </div>
  )
}
