import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RippleChat',
        short_name: 'RippleChat',
        description: 'Gerçek zamanlı sohbet platformu',
        theme_color: '#4f46e5',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
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
