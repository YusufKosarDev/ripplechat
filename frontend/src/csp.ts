/**
 * The Content-Security-Policy the app is served under.
 *
 * Production sets it on Vercel via `vercel.json`; `vite preview` sets the same
 * value so the Playwright suite exercises the app under the real, enforced
 * policy rather than a permissive dev one.
 *
 * Those are two different mechanisms — a build config and a static JSON file —
 * so the string cannot simply be imported in both places. It lives here, and
 * `csp.test.ts` asserts `vercel.json` still matches. A CSP that drifts fails
 * only in production, and only for the request that trips it, so the check is
 * worth more than it looks.
 *
 * The backend origin in `connect-src` is spelled out rather than derived: a
 * static JSON file cannot read an env var. `csp.test.ts` therefore also checks
 * it against `VITE_API_URL`/`VITE_WS_URL` in `.env.production`, so pointing the
 * app at a different backend fails the build instead of silently blocking every
 * API call in the browser. If you fork this, change all three together.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Tailwind and the syntax highlighter both emit inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.giphy.com",
  "font-src 'self' data:",
  "connect-src 'self' https://ripplechat-backend.onrender.com wss://ripplechat-backend.onrender.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ')
