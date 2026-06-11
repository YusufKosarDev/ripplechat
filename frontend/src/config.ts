// Backend endpoints, read from Vite env (see .env / .env.example / .env.production).
// Dev leaves these relative (empty API base + "/ws" path) so the Vite proxy
// forwards them same-origin; production sets them to the deployed backend's
// absolute URLs. `apiUrl` is the axios baseURL; `wsUrl` is the SockJS endpoint.
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  wsUrl: import.meta.env.VITE_WS_URL ?? '/ws',
}
