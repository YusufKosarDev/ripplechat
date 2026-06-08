import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout } from '../features/auth/authSlice'
import { fetchChannels } from '../features/channels/channelsSlice'
import { setConnectionStatus } from '../features/connection/connectionSlice'
import { fetchMessages } from '../features/messages/messagesSlice'
import { fetchOnline, presenceChanged } from '../features/presence/presenceSlice'
import { connectChat, disconnectChat, setPresenceHandler } from '../realtime/chatSocket'
import Sidebar from '../components/Sidebar'
import ChannelPanel from '../components/ChannelPanel'
import ThreadPanel from '../components/ThreadPanel'
import ConnectionBanner from '../components/ConnectionBanner'

export default function ChatPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const selectedId = useAppSelector((state) => state.channels.selectedId)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Keep the latest selected channel available to the reconnect handler.
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <ConnectionBanner />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ChannelPanel onOpenSidebar={() => setSidebarOpen(true)} />
        <ThreadPanel />
      </div>
    </div>
  )
}
