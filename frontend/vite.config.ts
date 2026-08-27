import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // injectManifest, not the default generateSW: in generateSW the plugin
    // emits its own worker and manifest *over* the hand-written ones in
    // public/, which silently dropped every push handler from the shipped
    // sw.js and replaced the manifest with one pointing at icons that did not
    // exist. src/sw.ts is now the real worker and gets the precache manifest
    // injected into self.__WB_MANIFEST.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // public/manifest.webmanifest is the single source of truth; without
      // this the plugin would generate a competing one again.
      manifest: false,
      // main.tsx already registers /sw.js on window load. Letting the plugin
      // inject registerSW.js too would register the same scope twice.
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Precaching every emitted chunk meant ~200 Prism grammars (2.7 MB) were
        // downloaded up front, which is exactly what CodeBlock's PrismAsyncLight
        // import is designed to avoid. They stay lazily fetched, and the worker's
        // runtime stale-while-revalidate cache keeps the ones actually used.
        // og-image.png is 408 KB and only ever read by link-preview scrapers.
        globIgnores: ['assets/prism/**', 'og-image.png'],
      },
    })
  ],
  // SockJS (sockjs-client) references Node's `global`, which doesn't exist in
  // the browser. The Vite dev server tolerated it, but the production bundle
  // threw "global is not defined" (blank screen). Map it to the browser's
  // globalThis. Applies to dev too (harmless — globalThis exists everywhere).
  define: {
    global: 'globalThis',
  },
  build: {
    // The TipTap/ProseMirror editor is deliberately one big lazy chunk (it
    // loads after first paint and caches well); don't warn about it.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Route the syntax-highlighter grammars into assets/prism/ so the
        // service worker can exclude them from the precache by path. Matching
        // them by name otherwise means listing ~200 languages by hand.
        chunkFileNames(chunk) {
          const isGrammar = chunk.moduleIds.some((id) => id.includes('refractor'))
          return isGrammar ? 'assets/prism/[name]-[hash].js' : 'assets/[name]-[hash].js'
        },
      },
    },
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
  preview: {
    // Mirror the production Content-Security-Policy (set on Vercel via
    // vercel.json) so `vite preview` — and the Playwright e2e suite that runs
    // against it — exercises the app under the real, enforced policy.
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com https://*.giphy.com; font-src 'self' data:; connect-src 'self' https://ripplechat-backend.onrender.com wss://ripplechat-backend.onrender.com; media-src 'self' blob: https://res.cloudinary.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    },
  },
})
