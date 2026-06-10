import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { closeThread, fetchThread, threadReplyReceived } from '../features/threads/threadsSlice'
import { sendChatMessage, unwatchThread, watchThread } from '../realtime/chatSocket'
import type { Message } from '../api/types'
import Avatar from './Avatar'
import MessageContent from './MessageContent'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function body(m: Message) {
  if (m.deleted) {
    return <p className="text-sm italic text-fg-faint">Bu mesaj silindi</p>
  }
  return (
    <>
      <MessageContent content={m.content} />
      {m.editedAt && <span className="text-[11px] text-fg-faint">(düzenlendi)</span>}
    </>
  )
}

export default function ThreadPanel() {
  const dispatch = useAppDispatch()
  const channelId = useAppSelector((state) => state.channels.selectedId)
  const openParentId = useAppSelector((state) => state.threads.openParentId)
  const repliesByParent = useAppSelector((state) => state.threads.repliesByParent)
  const messages = useAppSelector((state) =>
    channelId ? (state.messages.byChannel[channelId] ?? []) : [],
  )
  const onlineUserIds = useAppSelector((state) => state.presence.onlineUserIds)

  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const parent = openParentId ? (messages.find((m) => m.id === openParentId) ?? null) : null
  const replies = openParentId ? (repliesByParent[openParentId] ?? []) : []

  useEffect(() => {
    if (!channelId || !openParentId) return
    dispatch(fetchThread({ channelId, parentId: openParentId }))
    watchThread(channelId, openParentId, (reply) => dispatch(threadReplyReceived(reply)))
    return () => unwatchThread()
  }, [channelId, openParentId, dispatch])

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [replies.length])

  if (!openParentId || !channelId) return null

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    sendChatMessage(channelId, text, openParentId)
    setDraft('')
  }

  return (
    <aside className="fixed inset-0 z-30 flex w-full shrink-0 flex-col border-l border-border bg-surface-overlay md:static md:z-auto md:w-96 md:bg-surface-raised">
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <span className="font-semibold">Thread</span>
        <button
          onClick={() => dispatch(closeThread())}
          className="text-fg-muted transition hover:text-fg"
          title="Kapat"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {parent && (
          <div className="flex gap-3 border-b border-border pb-3">
            <Avatar
              name={parent.sender.displayName ?? parent.sender.username}
              color={parent.sender.avatarColor}
              online={onlineUserIds.includes(parent.sender.id)}
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-fg">
                  {parent.sender.displayName ?? parent.sender.username}
                </span>
                <span className="text-xs text-fg-faint">{formatTime(parent.createdAt)}</span>
              </div>
              {body(parent)}
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-fg-muted">{replies.length} yanıt</div>
        <div className="mt-2 space-y-3">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-3">
              <Avatar
                name={r.sender.displayName ?? r.sender.username}
                color={r.sender.avatarColor}
                online={onlineUserIds.includes(r.sender.id)}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-fg">
                    {r.sender.displayName ?? r.sender.username}
                  </span>
                  <span className="text-xs text-fg-faint">{formatTime(r.createdAt)}</span>
                </div>
                {body(r)}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={onSend} className="border-t border-border p-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Yanıt yaz..."
          className="w-full rounded-lg border border-control bg-surface px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-faint focus:border-accent"
        />
      </form>
    </aside>
  )
}
