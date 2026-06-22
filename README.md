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

### ⚡ Real-time
- **Live messaging** over WebSocket / STOMP — messages fan out instantly to every subscriber of a channel
- **Presence** — see who's online at a glance
- **Typing indicators** — know when someone in the channel is composing a message
- **Automatic reconnection** — the client recovers transparently from dropped connections, with a visible connection banner

### 💬 Messaging
- **Channels** with membership management
- **Direct messages** — private 1:1 conversations, plus **group DMs** (multi-party), reusing the same real-time pipeline
- **Threads** — keep focused reply chains off the main timeline
- **Edit & delete** messages — **delete for everyone** (soft delete) or **delete for me** (hide from your own view)
- **Quote-reply** to a specific message, **forward** messages to other chats, and **pin** important messages
- **Markdown** formatting and **syntax-highlighted code blocks**
- **@mentions** with autocomplete, in-message highlighting, and a per-channel mention badge
- **Full-text search** (PostgreSQL `tsvector` + GIN index) with filters (channel, sender, date) and **jump-to-message**
- **Infinite scroll** — older history loads as you scroll up

### 🎉 Interaction
- **Persistent emoji reactions** on any message, plus a **full emoji picker**
- **Live flying emoji** — reactions burst across the screen in real time
- **GIFs** — search and send GIFs from a picker (Giphy)
- **Polls** — create and vote on polls right inside a channel (`/poll`)
- **Slash commands** — an extensible command system (`/poll`, `/giphy`, `/shrug`)

### 📎 Media & attachments
- **Image, file, and voice-message attachments** (recorded in-browser), stored on Cloudinary
- **Per-channel media gallery** of shared images
- **Link previews** — URLs unfurl into title/description/image cards (server-side, SSRF-guarded)

### 🔔 Presence & notifications
- **Presence** and **last-seen** timestamps · **typing indicators**
- **Read receipts** — delivery/read ticks in direct messages
- **Web push notifications** (VAPID) for messages while you're away
- **Mute** channels and DMs · **unread badges** with a live count in the browser tab title

### 🔐 Security & privacy
- **JWT authentication** with stateless sessions and BCrypt-hashed passwords
- **Refresh tokens** with rotation and server-side revocation — short-lived access tokens are renewed transparently, and logout truly invalidates the session
- **Role-based authorization** per channel: `OWNER` › `MODERATOR` › `MEMBER`, with server-side moderation checks
- **Private channels** — live messages are restricted to members; subscriptions are authorized per channel so non-members can't eavesdrop
- **User blocking** — hide messages from blocked users
- **End-to-end encryption** (opt-in) for direct messages — AES-GCM with a passphrase-derived key (PBKDF2), encrypted entirely in the browser via Web Crypto; the server only ever relays opaque ciphertext
- **Abuse protection** — input size limits plus rate limiting on login, message sends, and reactions (rate-limited responses carry a `Retry-After` hint)
- **Security headers** — HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and a `frame-ancestors` CSP on every response
- **Hardened secrets** — the JWT secret is validated at startup (rejects a too-short or placeholder value); SSRF guard on link unfurling; outbound calls (Cloudinary, link/GIF) are timeout-bounded
- **Security audit log** — authentication events (login success/failure/throttle, registration, refresh, logout) on a dedicated logger, correlated by request id

### 🎨 Experience & platform
- **Light / dark theme** toggle and a **responsive** layout that adapts to mobile
- **Installable PWA** with an offline app shell (service worker)
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
- Spring Security (JWT access + rotating refresh tokens, HS256)
- Spring Data JPA
- Spring WebSocket (STOMP messaging)
- PostgreSQL (full-text search) · Flyway migrations · HikariCP (tuned pool)
- Cloudinary (media uploads) · web-push/VAPID (notifications) · jsoup (link unfurling) · Giphy (GIF search)
- Caffeine (link-preview cache) · RFC 7807 ProblemDetail · gzip compression
- springdoc-openapi (Swagger UI) · Spring Boot Actuator · Micrometer + Prometheus

**Frontend**
- React + TypeScript
- Vite
- Redux Toolkit
- Tailwind CSS
- STOMP.js / SockJS
- Web Crypto (E2EE) · service worker (PWA + push)
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
- GitHub Actions CI (backend, frontend, e2e) · Dependabot (Maven, npm, Actions)

---

## 🏗️ Architecture

**Modular monolith backend.** The codebase is organized by domain, each package owning its own controllers, services, and persistence:

```
auth · user · channel (+ membership · direct messages · categories) · message (+ threads · pins · forwards)
presence · typing · reaction · poll · search (full-text) · read receipts · push · link previews · media · gif · websocket
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

On first boot against an empty database, Flyway applies the migrations in order (`V1__initial_schema` … `V17__disappearing_messages`) and Hibernate validates the schema against the entities. The full environment list lives in `.env.example`.

Several features are **optional and gracefully disabled when their credentials are absent**, so the app always boots: `CLOUDINARY_URL` (image/file/voice uploads), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (web push), and `GIPHY_API_KEY` (GIF search). End-to-end encryption is entirely client-side and needs no server configuration.

---

## 📁 Project Structure

```
ripplechat/
├── backend/                     # Spring Boot application
│   ├── src/main/java/com/ripplechat/backend/
│   │   ├── auth/                # Registration, login, JWT, security config
│   │   ├── user/                # Profiles, settings, password, avatars, blocking
│   │   ├── channel/             # Channels, membership & roles, direct/group messages
│   │   ├── message/             # Messages, threads, edit/delete, pins, forwards, quotes
│   │   ├── reaction/            # Emoji reactions
│   │   ├── poll/                # Polls (REST + WebSocket, persisted)
│   │   ├── presence/            # Online status & last seen
│   │   ├── typing/              # Typing indicators
│   │   ├── read/                # Read receipts
│   │   ├── search/              # Full-text message search (tsvector)
│   │   ├── push/                # Web push (VAPID) subscriptions & sending
│   │   ├── link/                # Link-preview unfurling (jsoup, SSRF-guarded)
│   │   ├── media/ · gif/        # Cloudinary uploads · Giphy GIF search
│   │   ├── websocket/           # STOMP config & subscription auth
│   │   └── common/              # Shared errors, exceptions, rate limiter
│   └── src/main/resources/
│       └── db/migration/        # Flyway migrations V1–V17 (prod schema)
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

RippleChat runs as a single backend instance, which keeps a few things in-process:

- **Rate limiting** is in-memory (per-instance token buckets).
- **WebSocket fan-out** uses Spring's in-memory `SimpleBroker`.
- **The disappearing-message sweep** is a `@Scheduled` task running on every instance.

That's the right choice for one instance. To scale **horizontally** (multiple backend replicas behind a load balancer), a few pieces would move to shared infrastructure:

1. **Distributed rate limiting** — back the limiter with **Redis** (e.g. atomic `INCR` + TTL, or a token-bucket library) so limits hold across replicas instead of per-instance.
2. **External STOMP relay** — replace the in-memory broker with a real message broker (**RabbitMQ** or **Redis**) via `enableStompBrokerRelay`, so a message published on one replica reaches subscribers connected to another.
3. **Single-runner scheduling** — the expiry sweep is naturally idempotent (it only ever touches not-yet-deleted rows), but on multiple replicas it would run redundantly and could double-broadcast a deletion; a lock (e.g. **ShedLock**) would elect one runner.

Both are intentionally deferred: they add operational dependencies that bring no benefit at single-instance scale, and can't be meaningfully exercised without a multi-replica deployment. Sticky sessions at the load balancer are a lighter interim option for the WebSocket layer.

Other possible next steps: paginating search results, reaction notifications, and extending internationalization coverage across the in-app chat surfaces.

---

## 📄 License

This project is licensed under the **MIT License**.
