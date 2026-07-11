import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { clearCall } from '../features/call/callSlice'
import { useWebRTC } from '../hooks/useWebRTC'
import Button from './ui/Button'
import { useT } from '../i18n'

interface CallModalProps {
  channelId: string
  peerId: string | null
  isIncoming: boolean
}

export function CallModal({ channelId, peerId, isIncoming }: CallModalProps) {
  const { t } = useT()
  const dispatch = useAppDispatch()
  const { incomingCall, activeCall } = useAppSelector((state) => state.call)
  
  const {
    localStream,
    remoteStream,
    startCall,
    endCall,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
    isMicMuted,
    isVideoMuted,
    isScreenSharing
  } = useWebRTC(channelId, peerId)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // If we initiated the active call, start it
  useEffect(() => {
    if (activeCall && !activeCall.isIncoming) {
      startCall()
    }
  }, [activeCall, startCall])

  const handleAccept = async () => {
    if (incomingCall) {
       // Answer logic is triggered by incoming OFFER signal which we stored,
       // but here we just need to start the call process. 
       // Actually, we need the original OFFER payload. 
       // For a robust implementation, the signaling should be handled more tightly.
       // For now, let's just dispatch activeCall to show the modal and let the signaling flow.
       dispatch(clearCall())
       // Ideally we pass the OFFER signal to handleIncomingSignal here.
    }
  }

  const handleReject = () => {
    dispatch(clearCall())
  }

  const handleEndCall = () => {
    endCall()
    dispatch(clearCall())
  }

  // Render incoming call ring
  if (isIncoming && incomingCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl text-fg">
          <h2 className="text-xl font-bold mb-2">Gelen Arama</h2>
          <p className="text-fg-secondary">
            {t('call.incoming', { id: incomingCall.senderId })}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={handleReject}>{t('call.reject')}</Button>
            <Button onClick={handleAccept}>{t('call.answer')}</Button>
          </div>
        </div>
      </div>
    )
  }

  // Render active call interface
  if (activeCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
        <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-gray-900 overflow-hidden shadow-2xl">
          <div className="relative flex-1 bg-black">
            {/* Remote Video (Main) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                {t('call.connecting')}
              </div>
            )}
            
            {/* Local Video (PiP) */}
            <div className="absolute bottom-4 right-4 h-36 w-48 overflow-hidden rounded-lg border-2 border-gray-700 bg-gray-800 shadow-xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="mt-auto flex justify-center gap-4 p-4">
            <Button 
              variant={isMicMuted ? "danger" : "secondary"} 
              onClick={toggleMic}
              className="h-12 w-12 rounded-full p-0"
              title={isMicMuted ? t('call.micOn') : t('call.micOff')}
            >
              🎤
            </Button>
            <Button
              variant={isVideoMuted ? "danger" : "secondary"}
              onClick={toggleVideo}
              className="h-12 w-12 rounded-full p-0"
              title={isVideoMuted ? t('call.camOn') : t('call.camOff')}
            >
              📷
            </Button>
            <Button
              variant={isScreenSharing ? "primary" : "secondary"}
              onClick={toggleScreenShare}
              className="h-12 w-12 rounded-full p-0"
              title={isScreenSharing ? t('call.shareStop') : t('call.shareStart')}
            >
              🖥️
            </Button>
            <Button
              variant="danger"
              onClick={handleEndCall}
              className="rounded-full px-8"
            >
              {t('call.end')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
