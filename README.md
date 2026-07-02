<p align="center">
  <img src="docs/logo.png" alt="RippleChat" width="110" />
</p>

# RippleChat

**Real-time, community-driven messaging platform** — a Slack/Discord-style workspace where channels, threads, reactions, and presence all update live over WebSockets. Built with a Spring Boot backend and a React + TypeScript frontend.

![Java](https://img.shields.io/badge/Java-21-orange?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-STOMP-010101?logo=socketdotio&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

[![Backend tests](https://github.com/YusufKosarDev/ripplechat/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/YusufKosarDev/ripplechat/actions/workflows/backend-tests.yml)
[![Frontend tests](https://github.com/YusufKosarDev/ripplechat/actions/workflows/frontend-tests.yml/badge.svg)](https://github.com/YusufKosarDev/ripplechat/actions/workflows/frontend-tests.yml)
[![E2E tests](https://github.com/YusufKosarDev/ripplechat/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/YusufKosarDev/ripplechat/actions/workflows/e2e-tests.yml)

---

## 🔗 Live Demo

- **App:** <https://ripplechat-app.vercel.app>
- **API docs (Swagger UI):** <https://ripplechat-backend.onrender.com/swagger-ui.html>

> Hosted on free tiers, so the backend may take ~30–60s to wake on the first request (the UI shows a "waking up" notice). On the landing page, click **“Demo’yu Dene”** for a one-click guided account — no signup needed.

**Demo account** (or log in manually):

| Username | Password |
|----------|----------|
| `demo`   | `demo1234` |

It lands on a pre-seeded workspace (`#genel`, `#yazılım`, `#tasarım`) with sample messages, reactions, a thread and a poll.

![RippleChat](docs/screenshots/landing.png)

---

## ✨ Features

### ⚡ Real-time & Communication
- **Live messaging** over WebSocket / STOMP — messages fan out instantly to every subscriber of a channel
- **Distributed Pub/Sub (Redis)** — horizontally scalable WebSockets; messages published on any node are reliably broadcasted to users connected to other nodes via Redis Pub/Sub
- **Voice & Video Calls (WebRTC)** — peer-to-peer secure WebRTC calls with **screen sharing** (swapped in via `replaceTrack`, no renegotiation), local/remote stream rendering, mute/video toggles, and signaling via STOMP
- **Optimistic UI** — instant UI updates for messages and channels before server confirmation, with seamless fallback/error handling
- **Presence** — see who's online at a glance
- **Typing indicators** — know when someone in the channel is composing a message
- **Automatic reconnection** — the client recovers transparently from dropped connections, with a visible connection banner

### 💬 Messaging
- **Channels** with membership management
- **Direct messages** — private 1:1 conversations, plus **group DMs** (multi-party), reusing the same real-time pipeline
- **Threads** — keep focused reply chains off the main timeline
- **Edit & delete** messages — **delete for everyone** (soft delete) or **delete for me** (hide from your own view)
- **Quote-reply** to a specific message, **forward** messages to other chats, and **pin** important messages
- **Saved messages** — bookmark any message and revisit them in a dedicated saved-items list (per-user, jump straight back to the message)
- **Rich Text Editor (TipTap)** — WYSIWYG editor with live markdown rendering, bold/italic, code blocks, quotes, and bullet lists
- **@mentions** with autocomplete, in-message highlighting, and a per-channel mention badge
- **Advanced Full-Text Search (Elasticsearch)** — sub-millisecond search across millions of messages with exact matching, wildcard support, and complex querying. **Gracefully degrades** to PostgreSQL full-text when Elasticsearch is unavailable, so the app still boots and search keeps working
- **Scheduled messages** — queue a message to a channel for a future time; a background dispatcher delivers due messages through the normal pipeline. `/remind` schedules one as a quick reminder
- **Infinite scroll** — older history loads as you scroll up

### 🎉 Interaction
- **Persistent emoji reactions** on any message, plus a **full emoji picker**
- **Live flying emoji** — reactions burst across the screen in real time
- **GIFs** — search and send GIFs from a picker (Giphy)
- **Polls** — create and vote on polls right inside a channel (`/poll`)
- **Slash commands** — an extensible command system (`/poll`, `/giphy`, `/shrug`, `/remind`)

### 📎 Media & attachments
- **Image, file, and voice-message attachments** (recorded in-browser), stored on Cloudinary
- **Automatic Storage Cleanup** — media files hosted on Cloudinary are reliably and automatically purged when the owning message is deleted
- **Per-channel media gallery** of shared images
- **Link previews** — URLs unfurl into title/description/image cards (server-side, SSRF-guarded)

### 🔌 Integrations
- **Incoming webhooks** — a channel moderator mints a token'd URL; external systems (CI, monitoring, …) POST `{"text":"..."}` and it lands in the channel as a dedicated **bot** identity. Only the token's **SHA-256 hash** is stored (the URL is shown once), the ingest endpoint is **rate-limited**, and bot accounts are hidden from people-search

### 🔔 Presence & notifications
- **Presence** and **last-seen** timestamps · **typing indicators**
- **Custom status** — an emoji + short text (with optional auto-expiry) shown next to your name and in DM headers
- **Do Not Disturb** — pause web-push notifications for a chosen window (30 min / 1 h / 8 h)
- **Activity center** — a bell with an unread badge that aggregates the events that involve you (someone **@mentioned** you, **replied** to your message, or **reacted** to it) into one feed; new activity arrives live over your own authorized STOMP topic, and clicking an item jumps to the message
- **Read receipts** — delivery/read ticks in direct messages
- **Web push notifications** (VAPID) for messages while you're away — suppressed while you're in Do Not Disturb
- **Mute** channels and DMs · **unread badges** with a live count in the browser tab title

### 🔐 Security & privacy
- **Two-Factor Authentication (2FA)** — TOTP-based multi-factor authentication via Google Authenticator/Authy using a secure Pre-Auth JWT handshake, with **single-use recovery codes** (shown once at enrollment, hash-only storage) that stand in for the authenticator at login and can be regenerated
- **JWT authentication** with stateless sessions and BCrypt-hashed passwords
- **Password reset & email verification** — token'd, single-use, expiring links delivered by email (only the SHA-256 hash is stored). The forgot-password endpoint is rate-limited and never reveals whether an address is registered; a reset ends every existing session. Email gracefully degrades to logging the link when no SMTP server is configured, so the flows work in development
- **Refresh tokens** with rotation, IP/User-Agent metadata tracking, and server-side revocation — short-lived access tokens are renewed transparently, and logout truly invalidates the session
- **Session & Device Management** — users can view active devices (with browser, OS, and IP address details) and perform remote session revocation (log out other devices)
- **Role-based authorization** per channel: `OWNER` › `MODERATOR` › `MEMBER`, with server-side moderation checks
- **Private channels** — live messages are restricted to members; subscriptions are authorized per channel so non-members can't eavesdrop
- **User blocking** — hide messages from blocked users
- **GDPR self-service** — download all of your own data as JSON, and erase your account: personal data is scrubbed and sign-in/session/notification artifacts are purged, while your past messages are retained under an anonymised "Deleted User" so other people's conversation history stays intact
- **End-to-end encryption (E2EE)** (opt-in) for direct messages — supports automatic **Asymmetric E2EE Key Agreement** using **ECDH (P-256)** and **AES-GCM (256-bit)** without manual passphrase entry (generating keypairs in IndexedDB and registering public keys on the server), as well as manual passphrase-derived key (PBKDF2) encryption. The server only ever stores/relays opaque ciphertext
- **Abuse protection** — input size limits plus distributed (Redis) rate limiting on login, **2FA verification**, **registration**, message sends, reactions, and webhook ingestion (rate-limited responses carry a `Retry-After` hint)
- **Account lockout** — after repeated failed password attempts an account is *temporarily* locked (auto-unlocks after a short cooldown, kept short to bound the DoS surface of a targeted lockout; the demo account is exempt). Counters live in Redis and lock events are audit-logged
- **Security headers** — the backend sets HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and a `frame-ancestors` CSP on every response; the static frontend (Vercel) adds a strict enforced **Content-Security-Policy**, `Permissions-Policy`, and the same hardening headers
- **Hardened secrets** — the JWT secret is validated at startup (rejects a too-short or placeholder value); SSRF guard on link unfurling; outbound calls (Cloudinary, link/GIF) are timeout-bounded
- **Security audit log** — authentication events (login success/failure/throttle, registration, refresh, logout) on a dedicated logger, correlated by request id

### 🎨 Experience & platform
- **Quick switcher** — `Ctrl`/`Cmd`+`K` opens a Slack-style palette to jump between channels and DMs with full keyboard navigation
- **Light / dark theme** toggle and a **responsive** layout that adapts to mobile
- **Offline-First PWA** — progressive web app with a service worker (`vite-plugin-pwa`) that caches UI assets and uses **IndexedDB** (`idb`) to store messages locally. Users can read history and send "pending" messages while offline, which automatically sync to the backend when the network recovers.
- **Internationalization** — English / Turkish with a language toggle
- **Accessibility** — accessible dialogs (focus trap, Escape, focus restore), ARIA labels, a skip link, and **automated axe checks** in CI
- **Resilient UI** — an error boundary keeps a component crash from blanking the app, and a toast layer surfaces transient successes/errors
- **Fast first load** — route-level code splitting and on-demand chunks (pickers, syntax highlighter), plus gzip-compressed API responses
- **Disappearing messages** — an optional per-channel timer auto-deletes messages after it elapses
- **Channel organization** — categories and archiving · **profile & settings** (display name, avatar image/color, password)
- **Tested** — backend integration tests on real PostgreSQL (Testcontainers) incl. a STOMP realtime test, frontend unit tests (Vitest), end-to-end + accessibility tests (Playwright), architecture tests (ArchUnit) and mutation testing (PITest) — all wired into CI

### 📊 Observability & operations
- **RFC 7807 problem responses** — every error (validation, auth 401/403, framework) returns a consistent `application/problem+json` body
- **Prometheus metrics** at `/actuator/prometheus` and **build info** (version, build time) at `/actuator/info`
- **Request correlation** — each request gets an `X-Request-Id` that is echoed back and stamped on every log line for that request
- **OpenAPI / Swagger UI** (`/swagger-ui.html`, with a Bearer "Authorize") · **health endpoint** (`/actuator/health`)

---

## 🧱 Tech Stack

**Backend**
- Java 21
- Spring Boot 3.5
- Spring Security (JWT access + rotating refresh tokens, HS384)
- Spring Data JPA · Spring Data Redis · Spring Data Elasticsearch
- Spring WebSocket (STOMP messaging)
- PostgreSQL (primary datastore) · Redis (distributed Pub/Sub & caching) · Elasticsearch (message search engine)
- Cloudinary (media uploads) · web-push/VAPID (notifications) · dev.samstevens.totp (2FA) · Giphy (GIF search)
- Caffeine (link-preview cache) · RFC 7807 ProblemDetail · gzip compression
- springdoc-openapi (Swagger UI) · Spring Boot Actuator · Micrometer + Prometheus

**Frontend**
- React + TypeScript
- Vite
- Redux Toolkit
- Tailwind CSS
- STOMP.js / SockJS
- TipTap (Rich Text Editor)
- WebRTC (P2P Video/Audio Calls + screen sharing)
- Web Crypto (E2EE) · Service Worker (PWA + push) · IndexedDB (Offline sync via idb)
- TypeScript strict mode · error boundary + in-house toast layer · route-level code splitting

**Testing**
- JUnit 5 + Testcontainers (real PostgreSQL) — backend integration tests
- Vitest + React Testing Library — frontend unit tests
- Playwright — end-to-end tests
- ArchUnit — architecture/boundary tests · PITest — mutation testing (`mvn -Ppitest test org.pitest:pitest-maven:mutationCoverage`)
- axe (`@axe-core/playwright`) — automated accessibility checks
- k6 — load test for the read-heavy API path (`k6 run loadtest/messaging.js` against a local instance)

**DevOps**
- Docker Compose (PostgreSQL)
- Flyway (production schema migrations)
- Maven · Spring profiles (dev / prod)
- GitHub Actions CI (backend, frontend, e2e) · Dependabot (Maven, npm, Actions) · `npm audit` gate on shipped dependencies

---

## 🏗️ Architecture

**Modular monolith backend.** The codebase is organized by domain, each package owning its own controllers, services, and persistence:

```
auth · user · channel (+ membership · direct messages · categories) · message (+ threads · pins · forwards · scheduled)
presence · typing · reaction · poll · search (full-text) · read receipts · push · link previews · media · gif · webhook · websocket
```

**WebSocket layer.** Clients open a single STOMP connection authenticated with a JWT on `CONNECT`. The server broadcasts to `/topic/...` destinations (e.g. `/topic/channels/{id}`); clients publish via `/app/...`. Messages, reactions, presence, typing, and polls all travel over this channel for instant fan-out.

**Frontend.** Application state lives in Redux Toolkit, with a dedicated realtime layer managing the socket lifecycle, subscriptions, and reconnection. UI state (theme, modals, unread counts) is kept in feature slices.

**Security is enforced on the backend.** Authentication and every role/permission check (channel membership, moderation, profile ownership) run server-side — the frontend never holds the authority, only reflects it.

**Dev vs. production.** Development favours fast iteration: Hibernate auto-updates the schema (`ddl-auto=update`) and SQL logging is on. The `prod` profile is hardened instead — schema is owned by **Flyway** migrations and only *validated* by Hibernate, SQL logging is off, and CORS / WebSocket origins come from an explicit, environment-configured allowlist (no wildcards). Responses also carry hardening headers (HSTS, `Referrer-Policy`, frame-deny, a `frame-ancestors` CSP).

> **Note on the Swagger UI.** It's left publicly reachable on this demo on purpose, as a showcase of the API surface — the exposure is low since every mutating endpoint requires a JWT and no secrets are returned. In a real production deployment you'd gate it behind authentication or disable it (`springdoc.api-docs.enabled=false`) to avoid publishing the API map.

---

## 🚀 Getting Started

### Prerequisites
- **Java 21**
- **Node.js** (with npm)
- **Docker** (for PostgreSQL)
- **Maven** (or use the bundled `mvnw` wrapper)

### 1. Clone & configure environment

```bash
git clone <your-repo-url> ripplechat
cd ripplechat
cp .env.example .env
```

Edit `.env` and set real values — most importantly a strong `JWT_SECRET` (≥ 32 bytes; generate one with `openssl rand -hex 48`) and your PostgreSQL credentials.

> The Vite dev server proxies API and WebSocket traffic to the backend on **port 8081**, so set `SERVER_PORT=8081` in your `.env` for local development.

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Run the backend

```bash
cd backend
./mvnw spring-boot:run
```

The API starts on `http://localhost:8081`.

### 4. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:5173** — register an account and start chatting. The dev server forwards `/api` and `/ws` to the backend, so the browser stays same-origin (no CORS setup needed).

### Ports at a glance

| Service     | URL / Port              |
|-------------|-------------------------|
| Frontend    | http://localhost:5173   |
| Backend API | http://localhost:8081   |
| PostgreSQL  | localhost:5434 (host)   |

### Running in production

The `prod` profile swaps auto-schema for validated, Flyway-managed migrations and locks down origins. Activate it with `SPRING_PROFILES_ACTIVE=prod` and provide:

| Variable | Notes |
|----------|-------|
| `SPRING_PROFILES_ACTIVE=prod` | enables Flyway + `ddl-auto=validate`, disables SQL logging |
| `POSTGRES_PASSWORD` | strong, unique (never `change-me`) |
| `JWT_SECRET` | long random secret — `openssl rand -hex 48` |
| `APP_ALLOWED_ORIGINS` | comma-separated allowed origins, e.g. `https://chat.example.com` |
| `POSTGRES_DB` · `POSTGRES_USER` · `POSTGRES_HOST_PORT` · `SERVER_PORT` | point at the production database / port |

On first boot against an empty database, Flyway applies the migrations in order (`V1__initial_schema` … `V30__saved_messages`) and Hibernate validates the schema against the entities. The full environment list lives in `.env.example`.

Several features are **optional and gracefully disabled when their credentials are absent**, so the app always boots: `CLOUDINARY_URL` (image/file/voice uploads), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (web push), `GIPHY_API_KEY` (GIF search), and SMTP (`MAIL_ENABLED` + `MAIL_HOST`/`MAIL_USERNAME`/`MAIL_PASSWORD`) for password-reset / verification email — without it those links are logged to the console instead of sent. Set `APP_SEARCH_ELASTICSEARCH_ENABLED=false` to run without Elasticsearch (search falls back to PostgreSQL full-text and the app never contacts ES), and `SWAGGER_ENABLED=false` to stop publishing the API docs. End-to-end encryption is entirely client-side and needs no server configuration.

---

## 📁 Project Structure

```
ripplechat/
├── backend/                     # Spring Boot application
│   ├── src/main/java/com/ripplechat/backend/
│   │   ├── auth/                # Registration, login, JWT, security config
│   │   ├── user/                # Profiles, status/DND, settings, password, avatars, blocking
│   │   ├── channel/             # Channels, membership & roles, direct/group messages
│   │   ├── message/             # Messages, threads, edit/delete, pins, forwards, quotes
│   │   │   └── scheduled/       # Scheduled messages + background dispatcher
│   │   ├── webhook/             # Incoming webhooks (token'd ingest, bot identity)
│   │   ├── reaction/            # Emoji reactions
│   │   ├── poll/                # Polls (REST + WebSocket, persisted)
│   │   ├── presence/            # Online status & last seen
│   │   ├── typing/              # Typing indicators
│   │   ├── read/                # Read receipts
│   │   ├── search/              # Message search (Elasticsearch, PostgreSQL tsvector fallback)
│   │   ├── push/                # Web push (VAPID) subscriptions & sending
│   │   ├── link/                # Link-preview unfurling (jsoup, SSRF-guarded)
│   │   ├── media/ · gif/        # Cloudinary uploads · Giphy GIF search
│   │   ├── websocket/           # STOMP config & subscription auth
│   │   └── common/              # Shared errors, exceptions, rate limiter
│   └── src/main/resources/
│       └── db/migration/        # Flyway migrations V1–V24 (prod schema)
├── frontend/                    # React + TypeScript app
│   ├── public/                  # PWA manifest + service worker (sw.js)
│   └── src/
│       ├── api/                 # HTTP client & types
│       ├── app/                 # Redux store & hooks
│       ├── features/            # auth, channels, messages, threads, polls, presence,
│       │                        #   reads, blocks, muted, e2ee, unread, connection, ui …
│       ├── realtime/            # STOMP socket lifecycle
│       ├── crypto/              # Client-side E2EE (Web Crypto)
│       ├── i18n/                # EN/TR translations + provider
│       ├── commands/            # Slash-command registry
│       ├── components/          # UI components (+ ui/ primitives & useDialog)
│       ├── pages/               # Route-level views
│       └── ../e2e/              # Playwright end-to-end tests
├── docker-compose.yml           # PostgreSQL service
└── .env.example                 # Environment template
```

---

## 📸 Screenshots

**Channel** — live messages, reactions, a thread, markdown and a syntax-highlighted code block:

![Channel view](docs/screenshots/channel.png)

**Direct message** — a private 1:1 conversation:

![Direct messages](docs/screenshots/direct-message.png)

---

## 📈 Scaling & Roadmap

RippleChat is built to run behind a load balancer as **multiple backend replicas**. The pieces that would otherwise be per-instance state have been moved to shared infrastructure:

- **Distributed rate limiting** — the limiter is backed by **Redis** via an atomic token-bucket Lua script, so limits hold across replicas instead of per-instance.
- **Cross-replica WebSocket fan-out** — the local STOMP `SimpleBroker` is fronted by a **Redis Pub/Sub** bridge: a message published on one replica is fanned out to subscribers connected to *any* replica. (Each node still serves its own clients via `SimpMessagingTemplate`; Redis carries the cross-node hop.)

A couple of `@Scheduled` tasks remain genuinely per-instance and are the next item on the roadmap:

- **Single-runner scheduling** — the disappearing-message expiry sweep and the scheduled-message dispatcher run on a timer. On multiple replicas they would run redundantly (e.g. double-delivering a scheduled message), so a distributed lock (e.g. **ShedLock**) would elect one runner. This is deferred because it can't be meaningfully exercised without a multi-replica deployment.

> A heavier alternative to the Redis Pub/Sub bridge would be an **external STOMP relay** (RabbitMQ or Redis via `enableStompBrokerRelay`), which moves broker state out of the JVM entirely. The Pub/Sub bridge is the lighter choice and avoids the extra broker dependency.

Other possible next steps: paginating search results, reaction notifications, and extending internationalization coverage across the in-app chat surfaces.

---

## 📄 License

This project is licensed under the **MIT License**.
