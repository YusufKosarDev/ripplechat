import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchChannels } from '../features/channels/channelsSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { connectChat, disconnectChat, watchChannel } from '../realtime/chatSocket'
import Sidebar from '../components/Sidebar'
import ChannelPanel from '../components/ChannelPanel'

export default function ChatPage() {
  const dispatch = useAppDispatch()
  const selectedId = useAppSelector((state) => state.channels.selectedId)

  // Open the realtime connection and load channels once.
  useEffect(() => {
    connectChat()
    dispatch(fetchChannels())
    return () => disconnectChat()
  }, [dispatch])

  // On channel change: load history (REST) and re-subscribe (WS).
  useEffect(() => {
    if (!selectedId) return
    dispatch(fetchMessages(selectedId))
    watchChannel(selectedId, (msg) => dispatch(messageReceived(msg)))
  }, [selectedId, dispatch])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <ChannelPanel />
    </div>
  )
}
