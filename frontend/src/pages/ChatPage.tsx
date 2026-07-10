import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { logout, fetchCurrentUser } from '../features/auth/authSlice'
import { fetchChannels, fetchDms } from '../features/channels/channelsSlice'
import { setConnectionStatus } from '../features/connection/connectionSlice'
import { fetchMessages, loadOfflineMessages, messageReceived } from '../features/messages/messagesSlice'
import { fetchOnline, presenceChanged } from '../features/presence/presenceSlice'
import { addMention, incrementUnread } from '../features/unread/unreadSlice'
import { fetchBlocks } from '../features/blocks/blocksSlice'
import { fetchNotifications, notificationReceived } from '../features/notifications/notificationsSlice'
import { fetchBookmarkIds } from '../features/bookmarks/bookmarksSlice'
import { connectChat, disconnectChat, setNotificationHandler, setPresenceHandler, watchAllChannels } from '../realtime/chatSocket'
import Sidebar from '../components/Sidebar'
import ChannelPanel from '../components/ChannelPanel'
import ThreadPanel from '../components/ThreadPanel'
import { getAsymmetricKeyPair, saveAsymmetricKeyPair } from '../db'
import { client } from '../api/client'
import { replenishPreKeys } from '../crypto/e2ee'
import { syncPendingMessages } from '../sync/syncManager'
import ConnectionBanner from '../components/ui/ConnectionBanner'
import { useT } from '../i18n'


// Loaded on demand the first time the quick switcher (Ctrl/Cmd+K) is opened.
const QuickSwitcher = lazy(() => import('../components/QuickSwitcher'))

// True if the message text @mentions the given username (standalone token).
function mentionsUser(content: string, username: string): boolean {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\w@])@${escaped}\\b`, 'i').test(content ?? '')
}

export default function ChatPage() {
  const { t } = useT()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
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
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)

  // Global Ctrl/Cmd+K opens the quick switcher. Capture phase so it works even
  // while the message composer (or any input) has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setQuickSwitcherOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const selectedIdRef = useRef(selectedId)
  const currentUserIdRef = useRef(currentUserId)
  const currentUsernameRef = useRef(currentUsername)
  const mutedRef = useRef(muted)
  const blockedRef = useRef(blockedIds)

  useLayoutEffect(() => {
    selectedIdRef.current = selectedId
    currentUserIdRef.current = currentUserId
    currentUsernameRef.current = currentUsername
    mutedRef.current = muted
    blockedRef.current = blockedIds
  }, [selectedId, currentUserId, currentUsername, muted, blockedIds])

  const connectionStatus = useAppSelector((state) => state.connection.status)

  useEffect(() => {
    if (connectionStatus === 'connected') {
      void syncPendingMessages()
    }
  }, [connectionStatus])

  useEffect(() => {
    connectChat({
      onStatus: (status) => dispatch(setConnectionStatus(status)),
      onReconnect: () => {
        // Refresh after a gap: presence list + the open channel's history
        // (dedup keeps any messages missed while offline from duplicating).
        dispatch(fetchOnline())
        const id = selectedIdRef.current
        if (id) {
          dispatch(loadOfflineMessages(id))
          dispatch(fetchMessages(id))
        }
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

  // Personal activity feed: subscribe to the user's notification topic (mentions,
  // replies, reactions to their messages) and load the initial feed + unread count.
  useEffect(() => {
    if (!currentUsername) return
    setNotificationHandler(currentUsername, (n) => dispatch(notificationReceived(n)))
    dispatch(fetchNotifications())
    dispatch(fetchBookmarkIds())
  }, [currentUsername, dispatch])

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

  // Automatically generate and upload asymmetric E2EE key pair if missing
  useEffect(() => {
    if (!user) return

    const initKeys = async () => {
      try {
        let keys = await getAsymmetricKeyPair()
        if (!keys) {
          const keyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
          )
          keys = {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
          }
          await saveAsymmetricKeyPair(keys)
        }

        if (!user.publicKey) {
          const publicJwk = await window.crypto.subtle.exportKey('jwk', keys.publicKey)
          const publicJwkString = JSON.stringify(publicJwk)
          await client.post('/api/users/me/public-key', publicJwkString, {
            headers: { 'Content-Type': 'text/plain' }
          })
          dispatch(fetchCurrentUser())
        }

        // Check and replenish pre-keys if low
        try {
          const countRes = await client.get<{ oneTimePreKeyCount: number }>('/api/e2ee/keys/count')
          if (countRes.data.oneTimePreKeyCount < 5) {
            await replenishPreKeys()
          }
        } catch (err) {
          console.error('Failed to check or replenish pre-keys:', err)
        }
      } catch (err) {
        console.error('Failed to initialize or upload asymmetric key pair:', err)
      }
    }

    initKeys()
  }, [user, dispatch])

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
        {t('chat.skipToContent')}
      </a>
      <ConnectionBanner status={connectionStatus} />
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ChannelPanel onOpenSidebar={() => setSidebarOpen(true)} />
        <ThreadPanel />
      </div>
      <Suspense fallback={null}>
        {quickSwitcherOpen && <QuickSwitcher onClose={() => setQuickSwitcherOpen(false)} />}
      </Suspense>
    </div>
  )
}
