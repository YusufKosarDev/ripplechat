// Backend connection settings, read from Vite env (see .env / .env.example).
// Nothing connects yet — this just centralizes the endpoints for later use.
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8081',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'http://localhost:8081/ws',
}
