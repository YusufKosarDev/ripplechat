import { config } from '../config'

/**
 * Fire-and-forget wake-up ping to the backend host. Free-tier hosting spins
 * the backend down when idle, so hitting the public health endpoint the
 * moment the app loads starts the wake-up while the visitor is still reading
 * the page — instead of when they first press a button. `no-cors` keeps the
 * request quiet (the response body is irrelevant) and every failure is
 * swallowed: this is purely a warm-up, never user-facing.
 */
export function warmUpBackend(): void {
  // Dev leaves apiUrl relative (Vite proxy, no /actuator route) and a local
  // backend has no cold start anyway — only warm a configured remote host.
  if (!config.apiUrl) return
  fetch(`${config.apiUrl}/actuator/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
}
