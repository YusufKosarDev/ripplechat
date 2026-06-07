import { useEffect, useRef } from 'react'
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
import ConnectionBanner from '../components/ConnectionBanner'

export default function ChatPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const selectedId = useAppSelector((state) => state.channels.selectedId)

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
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <ConnectionBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChannelPanel />
      </div>
    </div>
  )
}
