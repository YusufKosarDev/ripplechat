import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

/**
 * Integration end-to-end tests: the production build against a **real** backend
 * (PostgreSQL + Redis + Spring Boot), with nothing stubbed.
 *
 * <p>Separate from `playwright.config.ts`, which intercepts every request and so
 * stays fast and deterministic — but for that same reason can never catch a
 * disagreement between what the client expects and what the server actually
 * sends, nor exercise anything the server decides (authorisation, revocation,
 * the WebSocket). These specs cover exactly that, and are deliberately few:
 * the mocked suite remains the place to test UI behaviour.
 *
 * Bring the stack up first (see e2e-integration/README.md):
 *   docker compose up -d
 *   cd backend && ./mvnw spring-boot:run
 *   cd frontend && npm run test:e2e:integration
 *
 * The preview server proxies /api and /ws to the backend (see vite.config.ts),
 * so the app is same-origin and runs under the real Content-Security-Policy.
 */
export default defineConfig({
  testDir: './e2e-integration',
  // Each spec creates its own accounts; running them in parallel is safe and the
  // backend is the slow part.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flake here is a signal about the stack, not something to paper over.
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    locale: 'tr-TR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --mode integration, not the default production mode: otherwise the build
    // picks up .env.production and the bundle talks to the *deployed* backend
    // instead of the local one. See .env.integration.
    command: `npm run build -- --mode integration && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
