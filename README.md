<p align="center">
  <img src="docs/logo.png" alt="RippleChat" width="110" />
</p>

# 💬 RippleChat

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

---

## ✨ Features

### ⚡ Real-time
- **Live messaging** over WebSocket / STOMP — messages fan out instantly to every subscriber of a channel
- **Presence** — see who's online at a glance
- **Typing indicators** — know when someone in the channel is composing a message
- **Automatic reconnection** — the client recovers transparently from dropped connections, with a visible connection banner

### 💬 Messaging
- **Channels** with membership management
- **Threads** — keep focused reply chains off the main timeline
- **Edit & delete** messages, with soft delete so history stays consistent
- **Markdown** formatting and **syntax-highlighted code blocks**
- **Message search** across channels

### 🎉 Interaction
- **Persistent emoji reactions** on any message
- **Live flying emoji** — reactions burst across the screen in real time
- **Polls** — create and vote on polls right inside a channel (`/poll`)
- **Slash commands** — an extensible command system (`/poll`, `/giphy`, `/shrug`)

### 🔐 Security & Authorization
- **JWT authentication** with stateless sessions and BCrypt-hashed passwords
- **Role-based authorization** per channel: `OWNER` › `MODERATOR` › `MEMBER`
- **Channel moderation** — owners and moderators manage membership and content; all checks are enforced server-side
- **Private channels** — live messages are restricted to members; subscriptions are authorized per channel so non-members (or removed members) can't eavesdrop
- **Abuse protection** — input size limits plus rate limiting on login, message sends, and reactions

### 🎨 Experience
- **Light / dark theme** toggle
- **Responsive layout** that adapts to mobile
- **Unread message badges** so nothing slips by
- **User profile & settings** — display name, avatar color, and password management

---

## 🧱 Tech Stack

**Backend**
- Java 21
- Spring Boot 3.5
- Spring Security (JWT, HS256)
- Spring Data JPA
- Spring WebSocket (STOMP messaging)
- PostgreSQL

**Frontend**
- React + TypeScript
- Vite
- Redux Toolkit
- Tailwind CSS
- STOMP.js / SockJS

**DevOps**
- Docker Compose (PostgreSQL)
- Flyway (production schema migrations)
- Maven · Spring profiles (dev / prod)

---

## 🏗️ Architecture

**Modular monolith backend.** The codebase is organized by domain, each package owning its own controllers, services, and persistence:

```
auth · user · channel (+ membership) · message
presence · typing · reaction · poll · search · websocket
```

**WebSocket layer.** Clients open a single STOMP connection authenticated with a JWT on `CONNECT`. The server broadcasts to `/topic/...` destinations (e.g. `/topic/channels/{id}`); clients publish via `/app/...`. Messages, reactions, presence, typing, and polls all travel over this channel for instant fan-out.

**Frontend.** Application state lives in Redux Toolkit, with a dedicated realtime layer managing the socket lifecycle, subscriptions, and reconnection. UI state (theme, modals, unread counts) is kept in feature slices.

**Security is enforced on the backend.** Authentication and every role/permission check (channel membership, moderation, profile ownership) run server-side — the frontend never holds the authority, only reflects it.

**Dev vs. production.** Development favours fast iteration: Hibernate auto-updates the schema (`ddl-auto=update`) and SQL logging is on. The `prod` profile is hardened instead — schema is owned by **Flyway** migrations and only *validated* by Hibernate, SQL logging is off, and CORS / WebSocket origins come from an explicit, environment-configured allowlist (no wildcards).

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

On first boot against an empty database, Flyway applies `V1__initial_schema.sql` and Hibernate validates the schema against the entities. The full list lives in `.env.example`.

---

## 📁 Project Structure

```
ripplechat/
├── backend/                     # Spring Boot application
│   ├── src/main/java/com/ripplechat/backend/
│   │   ├── auth/                # Registration, login, JWT, security config
│   │   ├── user/                # Profiles, settings, password (self-service)
│   │   ├── channel/             # Channels + membership & roles
│   │   ├── message/             # Messages, threads, edit/delete
│   │   ├── reaction/            # Emoji reactions
│   │   ├── poll/                # Polls (REST + WebSocket)
│   │   ├── presence/            # Online status
│   │   ├── typing/              # Typing indicators
│   │   ├── search/              # Message search
│   │   ├── websocket/           # STOMP config & subscription auth
│   │   └── common/              # Shared errors, exceptions, rate limiter
│   └── src/main/resources/
│       └── db/migration/        # Flyway migrations (prod schema)
├── frontend/                    # React + TypeScript app
│   └── src/
│       ├── api/                 # HTTP client & types
│       ├── app/                 # Redux store & hooks
│       ├── features/            # auth, channels, messages, threads,
│       │                        #   polls, presence, unread, connection, ui
│       ├── realtime/            # STOMP socket lifecycle
│       ├── commands/            # Slash-command registry
│       ├── components/          # UI components (+ ui/ Button/Input primitives)
│       └── pages/               # Route-level views
├── docker-compose.yml           # PostgreSQL service
└── .env.example                 # Environment template
```

---

## 📸 Screenshots

Screenshots live in [`docs/screenshots/`](docs/screenshots). Capture the running app (`docker compose up -d`, start the backend and frontend, open <http://localhost:5173>) — the channel view, a thread with reactions, message search, and dark mode show it off best — then drop the PNGs in and embed them here:

```md
![Channel view](docs/screenshots/channel.png)
![Dark mode](docs/screenshots/dark.png)
![Thread & reactions](docs/screenshots/thread.png)
```

---

## 📄 License

This project is licensed under the **MIT License**.
