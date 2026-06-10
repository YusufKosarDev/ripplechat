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
- **JWT authentication** with stateless sessions
- **Role-based authorization** per channel: `OWNER` › `MODERATOR` › `MEMBER`
- **Channel moderation** — owners and moderators manage membership and content; all checks are enforced server-side

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
- Maven

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

---

## 📁 Project Structure

```
ripplechat/
├── backend/                     # Spring Boot application
│   └── src/main/java/com/ripplechat/backend/
│       ├── auth/                # Registration, login, JWT
│       ├── user/                # Profiles, settings, password
│       ├── channel/             # Channels + membership & roles
│       ├── message/             # Messages, threads, edit/delete
│       ├── reaction/            # Emoji reactions
│       ├── poll/                # Polls (REST + WebSocket)
│       ├── presence/            # Online status
│       ├── typing/              # Typing indicators
│       ├── search/              # Message search
│       ├── websocket/           # STOMP config & security
│       └── common/              # Shared errors, exceptions, utilities
├── frontend/                    # React + TypeScript app
│   └── src/
│       ├── api/                 # HTTP client & types
│       ├── app/                 # Redux store & hooks
│       ├── features/            # auth, channels, messages, threads,
│       │                        #   polls, presence, unread, connection, ui
│       ├── realtime/            # STOMP socket lifecycle
│       ├── commands/            # Slash-command registry
│       ├── components/          # UI components
│       └── pages/               # Route-level views
├── docker-compose.yml           # PostgreSQL service
└── .env.example                 # Environment template
```

---

## 📸 Screenshots

_Coming soon._

> Add screenshots or a short demo GIF here — channel view, threads, reactions, and dark mode showcase the project well.

---

## 📄 License

This project is licensed under the **MIT License**.
