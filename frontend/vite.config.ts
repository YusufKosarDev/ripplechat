import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // SockJS (sockjs-client) references Node's `global`, which doesn't exist in
  // the browser. The Vite dev server tolerated it, but the production bundle
  // threw "global is not defined" (blank screen). Map it to the browser's
  // globalThis. Applies to dev too (harmless — globalThis exists everywhere).
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    // Forward API and WebSocket calls to the backend so the browser stays
    // same-origin (no CORS, no backend changes needed).
    proxy: {
      '/api': 'http://localhost:8081',
      '/ws': { target: 'http://localhost:8081', ws: true },
    },
  },
})
