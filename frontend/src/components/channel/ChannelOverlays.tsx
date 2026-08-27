import { Suspense, lazy } from 'react'
import { SummaryModal, EditHistoryModal } from '../MessageInfoModals'
import PinnedDrawer from './PinnedDrawer'
import type { EditHistoryEntry } from '../../hooks/useEditHistory'
import type { MemberResponse, MembershipRole, Message } from '../../api/types'

// Kept lazy: none of these dialogs is on the first-paint path.
const ChannelMembersModal = lazy(() => import('../ChannelMembersModal'))
const ForwardModal = lazy(() => import('../ForwardModal'))
const MediaGalleryModal = lazy(() => import('../MediaGalleryModal'))
const ScheduledMessagesModal = lazy(() => import('../ScheduledMessagesModal'))
const WebhooksModal = lazy(() => import('../WebhooksModal'))
const SafetyNumberModal = lazy(() => import('../SafetyNumberModal'))

interface ChannelOverlaysProps {
  channelId: string
  members: MemberResponse[]
  myRole: MembershipRole
  currentUserId: string | undefined
  draft: string

  summary: string | null
  onCloseSummary: () => void

  history: EditHistoryEntry[] | null
  historyLoading: boolean
  onCloseHistory: () => void

  showMembers: boolean
  onCloseMembers: () => void

  forwardingMsg: Message | null
  onForward: (targetChannelId: string) => void
  onCloseForward: () => void

  showGallery: boolean
  onCloseGallery: () => void

  showScheduled: boolean
  onCloseScheduled: () => void

  showWebhooks: boolean
  onCloseWebhooks: () => void

  /** Both identity public keys, present only for a DM with E2EE available. */
  safetyNumberKeys: { ours: string; theirs: string; theirName: string } | null
  onCloseSafetyNumber: () => void

  showPinned: boolean
  pinned: Message[]
  onClosePinned: () => void
  onUnpin: (msg: Message) => void
}

/** Every dialog that floats above the channel, in one place. */
export default function ChannelOverlays({
  channelId,
  members,
  myRole,
  currentUserId,
  draft,
  summary,
  onCloseSummary,
  history,
  historyLoading,
  onCloseHistory,
  showMembers,
  onCloseMembers,
  forwardingMsg,
  onForward,
  onCloseForward,
  showGallery,
  onCloseGallery,
  showScheduled,
  onCloseScheduled,
  showWebhooks,
  onCloseWebhooks,
  safetyNumberKeys,
  onCloseSafetyNumber,
  showPinned,
  pinned,
  onClosePinned,
  onUnpin,
}: ChannelOverlaysProps) {
  return (
    <>
      {summary !== null && <SummaryModal summary={summary} onClose={onCloseSummary} />}

      {(history !== null || historyLoading) && (
        <EditHistoryModal entries={history} loading={historyLoading} onClose={onCloseHistory} />
      )}

      <Suspense fallback={null}>
        {showMembers && (
          <ChannelMembersModal
            channelId={channelId}
            members={members}
            myRole={myRole}
            currentUserId={currentUserId}
            onClose={onCloseMembers}
          />
        )}

        {forwardingMsg && <ForwardModal onPick={onForward} onClose={onCloseForward} />}

        {showGallery && <MediaGalleryModal channelId={channelId} onClose={onCloseGallery} />}

        {showScheduled && (
          <ScheduledMessagesModal channelId={channelId} initialDraft={draft} onClose={onCloseScheduled} />
        )}

        {showWebhooks && <WebhooksModal channelId={channelId} onClose={onCloseWebhooks} />}

        {safetyNumberKeys && (
          <SafetyNumberModal
            ourPublicKey={safetyNumberKeys.ours}
            theirPublicKey={safetyNumberKeys.theirs}
            theirName={safetyNumberKeys.theirName}
            onClose={onCloseSafetyNumber}
          />
        )}
      </Suspense>

      {showPinned && <PinnedDrawer pinned={pinned} onClose={onClosePinned} onUnpin={onUnpin} />}
    </>
  )
}
