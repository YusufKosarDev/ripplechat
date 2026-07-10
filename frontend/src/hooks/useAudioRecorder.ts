import { useRef, useState } from 'react'
import { client } from '../api/client'
import { toBase64 } from '../crypto/doubleRatchet'

interface UseAudioRecorderProps {
  dmPartner: { id: string; publicKey?: string | null } | null
  asymmetricKey: CryptoKey | null
  passphrase?: string
  onUploadSuccess: (attachment: { url: string; name: string; type: 'audio'; e2ee?: { key: string; iv: string } }) => void
  onError: (message: string) => void
}

export function useAudioRecorder({
  dmPartner,
  asymmetricKey,
  passphrase,
  onUploadSuccess,
  onError,
}: UseAudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const startRecording = async () => {
    onError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        setUploading(true)

        try {
          const form = new FormData()
          let fileToUpload = new File([blob], 'sesli-mesaj.webm', { type: blob.type })
          let e2eeKeyB64 = ''
          let e2eeIvB64 = ''

          const isE2EE = !!(dmPartner || asymmetricKey || passphrase)

          if (isE2EE) {
            const rawKey = crypto.getRandomValues(new Uint8Array(32))
            const iv = crypto.getRandomValues(new Uint8Array(12))

            const key = await crypto.subtle.importKey(
              'raw',
              rawKey,
              'AES-GCM',
              false,
              ['encrypt']
            )

            const fileBytes = await blob.arrayBuffer()
            const encryptedBytes = await crypto.subtle.encrypt(
              { name: 'AES-GCM', iv },
              key,
              fileBytes
            )

            e2eeKeyB64 = toBase64(rawKey)
            e2eeIvB64 = toBase64(iv)

            const encryptedBlob = new Blob([encryptedBytes], { type: 'application/octet-stream' })
            fileToUpload = new File([encryptedBlob], 'sesli-mesaj.webm', { type: 'application/octet-stream' })
          }

          form.append('file', fileToUpload)
          const { data } = await client.post<{ url: string; name: string }>('/api/uploads/file', form)

          onUploadSuccess({
            url: data.url,
            name: 'Sesli mesaj',
            type: 'audio',
            e2ee: isE2EE ? { key: e2eeKeyB64, iv: e2eeIvB64 } : undefined,
          })
        } catch (err) {
          console.error(err)
          onError('rec.uploadFailed')
        } finally {
          setUploading(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      console.error(err)
      onError('rec.micFailed')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  return {
    recording,
    uploading,
    startRecording,
    stopRecording,
  }
}
