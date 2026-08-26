import { useEffect, useRef, useState } from 'react'
import { useAppDispatch } from '../app/hooks'
import {
  messageReactionsUpdated,
  messageReceived,
  messageUpdated,
  threadSummaryUpdated,
} from '../features/messages/messagesSlice'
import {
  channelRemoved,
} from '../features/channels/channelsSlice'
import { pollUpserted } from '../features/polls/pollsSlice'
import { readReceived } from '../features/reads/readsSlice'
import { closeThread, threadReplyUpdated } from '../features/threads/threadsSlice'
import { clearCall, setIncomingCall } from '../features/call/callSlice'
import { watchChannel } from '../realtime/chatSocket'
import type { ReactionEvent, TypingEvent, Message, Poll } from '../api/types'
import type { FlyingEmoji } from '../components/ReactionOverlay'

const TYPING_TTL = 4000
const MAX_FLYING = 40

interface UseChannelSocketProps {
  channelId: string
  currentUserId: string | undefined
  blockedIds: string[]
  onRefreshPinned: (channelId: string) => void
}

function makeFlyingEmoji(emoji: string): FlyingEmoji {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())
  return {
    id,
    emoji,
    left: 15 + Math.random() * 70,
    drift: (20 + Math.random() * 60) * (Math.random() < 0.5 ? -1 : 1),
    duration: 2.6 + Math.random() * 1.2,
    size: 1.6 + Math.random() * 0.8,
  }
}

export function useChannelSocket({
  channelId,
  currentUserId,
  blockedIds,
  onRefreshPinned,
}: UseChannelSocketProps) {
  const dispatch = useAppDispatch()
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [flying, setFlying] = useState<FlyingEmoji[]>([])

  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const reactionTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const blockedRef = useRef(blockedIds)
  const currentUserIdRef = useRef(currentUserId)

  useEffect(() => {
    blockedRef.current = blockedIds
    currentUserIdRef.current = currentUserId
  }, [blockedIds, currentUserId])

  const handleTyping = (event: TypingEvent) => {
    if (event.userId === currentUserIdRef.current) return
    if (blockedRef.current.includes(event.userId)) return
    const name = event.displayName ?? event.username
    if (event.typing) {
      setTypingUsers((prev) => ({ ...prev, [event.userId]: name }))
      clearTimeout(typingTimers.current[event.userId])
      typingTimers.current[event.userId] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev }
          delete next[event.userId]
          return next
        })
        delete typingTimers.current[event.userId]
      }, TYPING_TTL)
    } else {
      setTypingUsers((prev) => {
        const next = { ...prev }
        delete next[event.userId]
        return next
      })
      clearTimeout(typingTimers.current[event.userId])
      delete typingTimers.current[event.userId]
    }
  }

  const handleReaction = (event: ReactionEvent) => {
    if (blockedRef.current.includes(event.userId)) return
    const item = makeFlyingEmoji(event.emoji)
    setFlying((prev) => (prev.length >= MAX_FLYING ? [...prev.slice(1), item] : [...prev, item]))
    const timer = setTimeout(() => {
      setFlying((prev) => prev.filter((f) => f.id !== item.id))
      reactionTimers.current.delete(timer)
    }, item.duration * 1000 + 300)
    reactionTimers.current.add(timer)
  }

  useEffect(() => {
    if (!channelId) return
    const currentReactionTimers = reactionTimers.current

    watchChannel(channelId, {
      onMessage: (msg: Message) => {
        if (blockedRef.current.includes(msg.sender.id)) return
        dispatch(messageReceived(msg))
      },
      onTyping: handleTyping,
      onReaction: handleReaction,
      onMessageReaction: (update) =>
        dispatch(
          messageReactionsUpdated({
            channelId,
            messageId: update.messageId,
            reactions: update.reactions,
          }),
        ),
      onMessageUpdate: (updated) => {
        if (blockedRef.current.includes(updated.sender.id)) return
        if (updated.parentMessageId) {
          dispatch(threadReplyUpdated(updated))
        } else {
          dispatch(messageUpdated(updated))
        }
      },
      onThreadUpdate: (update) =>
        dispatch(
          threadSummaryUpdated({
            channelId,
            parentMessageId: update.parentMessageId,
            thread: update.thread,
          }),
        ),
      onChannelDeleted: () => {
        dispatch(closeThread())
        dispatch(channelRemoved(channelId))
      },
      onPoll: (poll: Poll) => dispatch(pollUpserted(poll)),
      onRead: (receipt) => dispatch(readReceived(receipt)),
      onCallSignal: (signal) => {
        if (blockedRef.current.includes(signal.senderId)) return
        if (signal.type === 'OFFER') {
          dispatch(setIncomingCall({ channelId, senderId: signal.senderId }))
        } else if (signal.type === 'HANG_UP' || signal.type === 'REJECT') {
          dispatch(clearCall())
        }
      },
    })

    onRefreshPinned(channelId)

    return () => {
      // Clear timers on cleanup — capture ref values from the effect body so
      // the cleanup references the snapshot, not the potentially-stale ref.
      const typing = typingTimers.current
      const reactions = currentReactionTimers
      Object.values(typing).forEach(clearTimeout)
      typingTimers.current = {}
      reactions.forEach(clearTimeout)
      reactions.clear()
      setTypingUsers({})
      setFlying([])
    }
  }, [channelId, dispatch, onRefreshPinned])

  return {
    typingUsers,
    flying,
    setFlying,
  }
}
