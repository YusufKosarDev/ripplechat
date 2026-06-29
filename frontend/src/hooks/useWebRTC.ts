import { useEffect, useRef, useState, useCallback } from 'react'
import { sendCallSignal } from '../realtime/chatSocket'
import type { CallSignal } from '../api/types'
import { useAppSelector } from '../app/hooks'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useWebRTC(channelId: string | null, peerId: string | null) {
  const user = useAppSelector((state) => state.auth.user)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  // The camera+mic stream stays live while screen sharing so we can switch back.
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  const initializePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && peerId && user && channelId) {
        sendCallSignal(channelId, {
          type: 'ICE_CANDIDATE',
          senderId: user.id,
          receiverId: peerId,
          payload: event.candidate,
        })
      }
    }

    return pc
  }, [channelId, peerId, user])

  useEffect(() => {
    return () => {
      // Cleanup on unmount: close the connection and stop any live media.
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      cameraStreamRef.current = stream
      setLocalStream(stream)
      const pc = initializePeerConnection()
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })
      return stream
    } catch (err) {
      console.error('Error accessing media devices.', err)
      return null
    }
  }, [initializePeerConnection])

  const stopLocalMedia = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setLocalStream(null)
    setIsScreenSharing(false)
  }, [])

  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicMuted(!audioTrack.enabled)
      }
    }
  }, [localStream])

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoMuted(!videoTrack.enabled)
      }
    }
  }, [localStream])

  // Swap the outgoing video track between camera and screen with replaceTrack —
  // no renegotiation needed since it reuses the same sender / m-line.
  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current
    const camera = cameraStreamRef.current
    if (!pc || !camera) return
    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
    if (!videoSender) return

    const backToCamera = () => {
      const cameraVideo = camera.getVideoTracks()[0]
      if (cameraVideo) videoSender.replaceTrack(cameraVideo)
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      setLocalStream(camera)
      setIsScreenSharing(false)
    }

    if (isScreenSharing) {
      backToCamera()
      return
    }

    let display: MediaStream
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true })
    } catch {
      return // user dismissed the screen picker
    }
    const screenTrack = display.getVideoTracks()[0]
    await videoSender.replaceTrack(screenTrack)
    screenStreamRef.current = display
    // Local preview shows the shared screen while keeping the mic audio track.
    setLocalStream(new MediaStream([screenTrack, ...camera.getAudioTracks()]))
    setIsScreenSharing(true)
    // Revert when the user stops sharing from the browser's own UI.
    screenTrack.onended = backToCamera
  }, [isScreenSharing])

  const startCall = useCallback(async () => {
    if (!user || !peerId || !channelId) return
    await startLocalMedia()
    const pc = initializePeerConnection()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendCallSignal(channelId, {
      type: 'OFFER',
      senderId: user.id,
      receiverId: peerId,
      payload: offer,
    })
  }, [user, peerId, channelId, startLocalMedia, initializePeerConnection])

  const handleIncomingSignal = useCallback(async (signal: CallSignal) => {
    if (signal.senderId === user?.id || !channelId) return

    const pc = initializePeerConnection()

    if (signal.type === 'OFFER') {
      await startLocalMedia()
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendCallSignal(channelId, {
        type: 'ANSWER',
        senderId: user?.id ?? 'unknown',
        receiverId: signal.senderId,
        payload: answer,
      })
    } else if (signal.type === 'ANSWER') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))
    } else if (signal.type === 'ICE_CANDIDATE') {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCLocalIceCandidateInit))
      } catch (e) {
        console.error('Error adding received ice candidate', e)
      }
    } else if (signal.type === 'HANG_UP') {
       stopLocalMedia()
       setRemoteStream(null)
       if (pcRef.current) {
         pcRef.current.close()
         pcRef.current = null
       }
    }
  }, [user, channelId, initializePeerConnection, startLocalMedia, stopLocalMedia])

  const endCall = useCallback(() => {
    stopLocalMedia()
    setRemoteStream(null)
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (user && peerId && channelId) {
       sendCallSignal(channelId, {
          type: 'HANG_UP',
          senderId: user.id,
          receiverId: peerId,
          payload: null
       })
    }
  }, [user, peerId, channelId, stopLocalMedia])

  return {
    localStream,
    remoteStream,
    startCall,
    handleIncomingSignal,
    endCall,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
    isMicMuted,
    isVideoMuted,
    isScreenSharing
  }
}
