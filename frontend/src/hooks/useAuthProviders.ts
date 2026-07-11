import { useEffect, useState } from 'react'
import { client } from '../api/client'

/**
 * Which social sign-in providers the backend can actually serve. The Google
 * registration always exists server-side (with a placeholder client-id), so
 * the auth pages use this flag to render the button only when clicking it
 * can succeed. Defaults to hidden until the answer arrives — a button that
 * pops in late beats one that fails when pressed.
 */
export function useAuthProviders(): { google: boolean } {
  const [google, setGoogle] = useState(false)

  useEffect(() => {
    let cancelled = false
    client
      .get<{ google?: boolean }>('/api/auth/providers')
      .then(({ data }) => {
        if (!cancelled) setGoogle(!!data.google)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return { google }
}
