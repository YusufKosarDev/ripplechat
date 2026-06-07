import { useEffect } from 'react'
import { useAppDispatch } from '../app/hooks'
import { fetchChannels } from '../features/channels/channelsSlice'
import { fetchOnline, presenceChanged } from '../features/presence/presenceSlice'
import { connectChat, disconnectChat, setPresenceHandler } from '../realtime/chatSocket'
import Sidebar from '../components/Sidebar'
import ChannelPanel from '../components/ChannelPanel'

export default function ChatPage() {
  const dispatch = useAppDispatch()

  // Open the realtime connection once, wire global presence, load initial data.
  useEffect(() => {
    connectChat()
    setPresenceHandler((event) => dispatch(presenceChanged(event)))
    dispatch(fetchOnline())
    dispatch(fetchChannels())
    return () => disconnectChat()
  }, [dispatch])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <ChannelPanel />
    </div>
  )
}
