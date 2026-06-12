import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { fetchChannels } from '../features/channels/channelsSlice'
import { setConnectionStatus } from '../features/connection/connectionSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { fetchOnline, presenceChanged } from '../features/presence/presenceSlice'
import { incrementUnread } from '../features/unread/unreadSlice'
import { connectChat, disconnectChat, setPresenceHandler, watchAllChannels } from '../realtime/chatSocket'
import Sidebar from '../components/Sidebar'
import ChannelPanel from '../components/ChannelPanel'
import ThreadPanel from '../components/ThreadPanel'
import ConnectionBanner from '../components/ConnectionBanner'

export default function ChatPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const selectedId = useAppSelector((state) => state.channels.selectedId)
  const channelIds = useAppSelector((state) => state.channels.items.map((c) => c.id).join(','))
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const totalUnread = useAppSelector((state) =>
    Object.values(state.unread.counts).reduce((sum, n) => sum + n, 0),
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Keep the latest values available to the (stable) realtime handlers.
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const currentUserIdRef = useRef(currentUserId)
  currentUserIdRef.current = currentUserId

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
    return () => disconnectChat()
  }, [dispatch, navigate])

  // Subscribe to every channel's message topic so unread counts stay accurate
  // even for channels the user isn't currently viewing.
  useEffect(() => {
    const ids = channelIds ? channelIds.split(',') : []
    watchAllChannels(ids, (msg) => {
      dispatch(messageReceived(msg))
      if (msg.channelId !== selectedIdRef.current && msg.sender.id !== currentUserIdRef.current) {
        dispatch(incrementUnread(msg.channelId))
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
      <ConnectionBanner />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ChannelPanel onOpenSidebar={() => setSidebarOpen(true)} />
        <ThreadPanel />
      </div>
    </div>
  )
}
