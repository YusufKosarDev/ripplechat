import { client } from './api/client'

// Browser Web Push helpers. Activation requires VAPID keys configured on the
// backend (GET /api/push/key reports enabled) and the user granting permission.

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

/** Subscribes this browser to push. Returns false if unsupported, denied, or push is off server-side. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false
  const { data } = await client.get<{ enabled: boolean; publicKey: string }>('/api/push/key')
  if (!data.enabled || !data.publicKey) return false
  if ((await Notification.requestPermission()) !== 'granted') return false

  const reg = await navigator.serviceWorker.register('/sw.js')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
  })
  const json = sub.toJSON()
  await client.post('/api/push/subscribe', {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
  return true
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await client.delete('/api/push/subscribe', { params: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}
