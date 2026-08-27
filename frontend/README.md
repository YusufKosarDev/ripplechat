# RippleChat — frontend

React + TypeScript single-page app for [RippleChat](../README.md). Talks to the Spring Boot
backend over REST for reads and writes, and over a single authenticated STOMP connection for
everything realtime — messages, reactions, presence, typing, polls and calls.

See the [root README](../README.md) for the product tour, architecture and deployment.

## Stack

React 19 · TypeScript (strict) · Vite · Redux Toolkit · Tailwind CSS 4 · React Router ·
STOMP.js / SockJS · TipTap · Web Crypto (E2EE) · IndexedDB via `idb` · `vite-plugin-pwa`

## Getting started

```bash
npm install
cp .env.example .env
npm run dev            # http://localhost:5173
```

The dev server proxies `/api` and `/ws` to the backend on **:8081**, so the browser stays
same-origin and no CORS setup is needed. Change the proxy in `vite.config.ts` if you move the
backend port.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` typecheck, then a production build |
| `npm run preview` | Serve the production build (with the real CSP applied) |
| `npm run lint` | ESLint over the whole project |
| `npm test` | Vitest unit tests |
| `npm run test:coverage` | Unit tests + v8 coverage into `coverage/` |
| `npm run test:e2e` | Playwright end-to-end suite (builds and previews first) |

## Layout

```
src/
├── api/          HTTP client, shared response types
├── app/          Redux store and typed hooks
├── features/     One slice per domain — auth, channels, messages, threads, polls,
│                 presence, reads, blocks, muted, e2ee, unread, connection, ui …
├── realtime/     STOMP socket lifecycle: connect, subscribe, reconnect
├── crypto/       Client-side E2EE — Double Ratchet, X3DH, key storage
├── db/           IndexedDB wrapper for offline history and pending sends
├── sync/         Flushes pending offline messages when the network returns
├── hooks/        Composed behaviour (channel socket, message composition, WebRTC …)
├── components/   UI components, plus `ui/` primitives and `useDialog`
├── pages/        Route-level views
├── commands/     Slash-command registry (`/poll`, `/giphy`, `/shrug`, `/remind`)
└── i18n/         EN/TR string catalog and language provider
e2e/              Playwright specs (run by `npm run test:e2e`, not by Vitest)
```

## Testing

Vitest covers the parts where the logic is genuinely hard — the crypto round-trips, the STOMP
client, reducers, the send path — and Playwright covers the rest end-to-end against the real
production build with a stubbed backend. Unit tests live beside their subject as `*.test.ts`;
`vitest.config.ts` deliberately scopes discovery to `src/` so Playwright's `e2e/` is never picked
up.
