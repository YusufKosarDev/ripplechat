# Integration end-to-end tests

These run the **production build against a real backend** — PostgreSQL, Redis and
Spring Boot, nothing stubbed.

The suite in [`../e2e`](../e2e) intercepts every request, which is what makes it
fast and deterministic. It is also why it can never catch a disagreement between
what the client expects and what the server sends, and can never exercise
anything the server decides: authorisation, token revocation, the WebSocket. A
test that asserts against a hand-written fixture is asserting the fixture.

So these specs are deliberately few, and cover only what the mocked suite
structurally cannot. UI behaviour belongs over there.

## Running them

```bash
docker compose up -d                       # PostgreSQL + Redis (needs .env — see .env.example)
cd backend  && ./mvnw spring-boot:run      # port 8081
cd frontend && npm run test:e2e:integration
```

The preview server proxies `/api` and `/ws` to the backend (`vite.config.ts`), so
the app is same-origin and runs under the real Content-Security-Policy — a
cross-origin backend would be blocked by its own `connect-src`.

## Fixtures

Accounts are created through the real API, with a per-run suffix on every
username. That is what lets the suite run repeatedly against a long-lived
database: nothing collides, and there is no teardown to get wrong. Do not add
fixtures with fixed names.
