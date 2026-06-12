import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.ts so the build config stays untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Unit tests live under src/; e2e/ is Playwright's and must not be picked up here.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
