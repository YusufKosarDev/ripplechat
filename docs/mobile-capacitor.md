# Feasibility note — Native mobile wrapper (Capacitor)

> **Status: design note, not shipped.** Producing installable apps needs a native
> build toolchain — the **Android SDK / Android Studio** for Android and **Xcode +
> CocoaPods on macOS** for iOS (iOS cannot be built off a Mac at all). This repo's
> dev environment is Windows without those SDKs, so the mobile build cannot be run
> or verified here. This step is therefore delivered as a grounded wiring plan; the
> parts that live in the repo (Capacitor config, the small backend/CSP changes) are
> specified so it's a mechanical task on a machine with the toolchain.

## Why Capacitor, and why it's mostly config here

[Capacitor](https://capacitorjs.com) wraps the **existing built web app** in a
native shell: a full-screen system WebView (Android WebView / WKWebView) plus a
bridge to native plugins (push, filesystem, haptics, status bar). We ship the same
`frontend/dist` bundle — no rewrite, no React Native, no second codebase.

RippleChat is unusually well-positioned to be wrapped, because of choices already
in the codebase:

- **It's already an offline-first PWA** — `vite-plugin-pwa` (autoUpdate manifest +
  Workbox), IndexedDB message cache, service worker. A PWA is the exact input
  Capacitor expects.
- **Auth is a JWT in the `Authorization` header** (see `api/client.ts` /
  `api/token.ts`), **not a cookie**. This sidesteps the single biggest webview
  headache — cross-origin/`SameSite` cookie loss when the app is served from a
  `capacitor://` / `https://localhost` origin. Header auth just works.
- **The backend base URL is already configurable** — `src/config.ts` reads
  `VITE_API_URL` (empty in dev for the Vite proxy, absolute in prod). A mobile
  build just points `VITE_API_URL` / `VITE_WS_URL` at the deployed backend; no code
  change.

So most of the work is **configuration and packaging**, with exactly one genuine
feature-parity gap (push — see below).

## The origin shift and what it touches

In a Capacitor webview the app is **not** served from `ripplechat-app.vercel.app`;
it runs from a local scheme (`https://localhost` on Android, `capacitor://localhost`
on iOS). Three things must account for that:

1. **CORS (backend)** — `APP_ALLOWED_ORIGINS` (see `SecurityConfig`
   `corsConfigurationSource`) must include the Capacitor origins
   (`https://localhost`, `capacitor://localhost`). The allowlist is explicit and
   already env-driven, so this is a one-line env change per environment — no code
   change. (Auth is header-based, so `allowCredentials` isn't even required for the
   mobile origin.)
2. **CSP** — the app's `connect-src` (in `vite.config.ts` / `vercel.json`) already
   allowlists the backend (`https://...onrender.com` + `wss://...`). Under Capacitor
   the document origin changes but `connect-src` to the backend is unchanged, so it
   keeps working; `default-src 'self'` resolves against the local scheme, which is
   what we want. Verify on-device and add the local scheme only if a plugin needs it.
3. **WebSocket** — SockJS/STOMP over `wss://` to the deployed backend works from the
   webview exactly as in the browser (again, header/token auth, no cookies).

## The one real gap: push notifications

Browser **Web Push (VAPID)** — our current `push/WebPushService` + service-worker
`push` handler — does **not** fire inside a Capacitor webview (there's no browser
push service behind it). Native apps must use the OS channels:

- **`@capacitor/push-notifications`** → **FCM** (Android) and **APNs** (iOS).
- Backend: add an **FCM/APNs sender** alongside the existing VAPID path. The
  subscription model generalizes cleanly — `PushSubscription` already stores a
  per-device token; add a `platform` discriminator (`web` | `fcm` | `apns`) and
  branch the sender. The `MessageSentEvent` → push listener pipeline is unchanged.
- This is the only change that is real backend feature work rather than config.

WebRTC calls (`useWebRTC`) run in the system webview with `getUserMedia`, but the
OS needs **native permission declarations** — camera/microphone in
`AndroidManifest.xml` and `NSCameraUsageDescription`/`NSMicrophoneUsageDescription`
in `Info.plist` — plus the runtime permission prompt via a Capacitor plugin.

## Wiring plan (on a machine with the toolchain)

```bash
# in frontend/
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init RippleChat app.ripplechat --web-dir=dist

# build the web app pointed at the deployed backend, then sync into native shells
VITE_API_URL=https://ripplechat-backend.onrender.com \
VITE_WS_URL=wss://ripplechat-backend.onrender.com/ws \
npm run build
npx cap add android      # + `npx cap add ios` on macOS
npx cap sync
npx cap open android     # opens Android Studio to build/run/emulate
```

`capacitor.config.ts` — the one file this plan would add to the repo, since it is
inert without `@capacitor/cli` installed:

```ts
import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'app.ripplechat',
  appName: 'RippleChat',
  webDir: 'dist',
  // No `server.url`: bundle the assets into the app (offline-capable, store-safe)
  // rather than loading a remote URL. API/WS still go to VITE_API_URL over the net.
}
export default config
```

Then, per platform:
- **Native permissions** — camera/mic (calls) and notifications in the Android
  manifest and iOS `Info.plist`.
- **Push** — register `@capacitor/push-notifications`, wire FCM (Android) / APNs
  (iOS) credentials, add the backend FCM/APNs sender described above.
- **Store submission** — Google Play Console and Apple App Store accounts,
  signing keys, and the platform review process. (Accounts + a Mac for iOS are
  external prerequisites this environment can't provide.)

## Honest scope summary

| Piece | Effort | In this repo? |
|-------|--------|---------------|
| Capacitor config + `cap add/sync` | low (config) | ✅ config committable; build needs SDKs |
| CORS origin for `*localhost` | trivial (env) | ✅ env only |
| CSP verification | low | ✅ |
| Camera/mic/native permissions | low (manifests) | ⚠️ generated in native projects |
| **Native push (FCM/APNs)** | **medium (real backend work)** | ⚠️ code specified above, needs device testing |
| Android/iOS build + store | external toolchain + accounts | ❌ not possible here |

**Bottom line:** because RippleChat is already a header-auth PWA with a
configurable backend URL, wrapping it with Capacitor is largely a packaging
exercise; the only substantive engineering is swapping Web Push for native
FCM/APNs. Everything past the config lives on a machine with the Android/iOS
toolchain, which is why this backlog item ships as a plan.
