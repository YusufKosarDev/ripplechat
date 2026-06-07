import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { joinChannel } from '../features/channels/channelsSlice'
import { fetchMessages, messageReceived } from '../features/messages/messagesSlice'
import { sendChatMessage, watchChannel } from '../realtime/chatSocket'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChannelPanel() {
  const dispatch = useAppDispatch()
  const { items, selectedId } = useAppSelector((state) => state.channels)
  const { byChannel, loadError } = useAppSelector((state) => state.messages)

  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const channel = items.find((c) => c.id === selectedId) ?? null
  const messages = selectedId ? (byChannel[selectedId] ?? []) : []
  const forbidden = loadError?.channelId === selectedId && loadError.forbidden

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!selectedId || !channel) {
    return (
      <section className="flex flex-1 items-center justify-center text-slate-600">
        Soldan bir kanal seç ya da yeni bir kanal oluştur.
      </section>
    )
  }

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    sendChatMessage(channel.id, content)
    setDraft('')
  }

  const onJoin = async () => {
    await dispatch(joinChannel(channel.id))
    dispatch(fetchMessages(channel.id))
    watchChannel(channel.id, (msg) => dispatch(messageReceived(msg)))
  }

  return (
    <section className="flex flex-1 flex-col">
      <header className="border-b border-slate-800 px-6 py-4">
        <h2 className="font-semibold">
          <span className="text-slate-500">#</span> {channel.name}
        </h2>
        {channel.description && (
          <p className="text-sm text-slate-500">{channel.description}</p>
        )}
      </header>

      {forbidden ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-slate-400">Bu kanalın üyesi değilsin.</p>
          <button
            onClick={onJoin}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Kanala katıl
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-600">Henüz mesaj yok. İlk mesajı sen yaz.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    {msg.sender.displayName ?? msg.sender.username}
                  </span>
                  <span className="text-xs text-slate-600">{formatTime(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-300">{msg.content}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSend} className="border-t border-slate-800 px-6 py-4">
            <div className="flex gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`#${channel.name} kanalına yaz`}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-indigo-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Gönder
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
