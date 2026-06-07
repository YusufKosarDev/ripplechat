import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
