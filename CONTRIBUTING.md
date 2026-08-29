# Contributing to RippleChat

Thank you for your interest in contributing to RippleChat! This guide will help you get started.

## Prerequisites

- **Java 21** (Temurin recommended)
- **Node.js 22+** with npm
- **Docker** (for PostgreSQL and Redis via Docker Compose, and for Testcontainers in tests)
- **Maven** (or use the bundled `mvnw` wrapper)

## Getting Started

1. **Fork & clone** the repository.

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env — set a strong JWT_SECRET and your PostgreSQL credentials.
   # The Redis defaults work as-is.
   ```

3. **Start PostgreSQL and Redis:**
   ```bash
   docker compose up -d
   ```

4. **Run the backend:**
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

5. **Run the frontend:**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```

6. Open **http://localhost:5173** and register an account.

## Branch Naming

Use a prefix that describes the type of change:

| Prefix | Use for |
|--------|---------|
| `feat/` | New features (`feat/group-calls`) |
| `fix/` | Bug fixes (`fix/websocket-reconnect`) |
| `docs/` | Documentation only (`docs/api-guide`) |
| `refactor/` | Code restructuring (`refactor/message-service`) |
| `test/` | Adding or updating tests (`test/e2e-polls`) |
| `chore/` | Tooling, CI, dependencies (`chore/bump-spring`) |

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>
```

**Examples:**
```
feat(channel): add channel archiving support
fix(auth): don't reveal ban status before password check
docs(readme): add performance benchmarks section
test(e2e): add accessibility checks for the admin page
```

A `commit-msg` hook checks the message before it is written. Enable it once per
clone — `.git/hooks/` is not cloned, so the hooks are versioned under
`scripts/hooks/` and reached through a config setting:

```bash
git config core.hooksPath scripts/hooks
```

See [`scripts/hooks/README.md`](scripts/hooks/README.md) for what it checks.

## Code Style

### Backend (Java / Spring Boot)

- **Constructor injection only** — field injection with `@Autowired` is forbidden (enforced by ArchUnit).
- Naming conventions: `*Controller`, `*Service`, `*Repository` (enforced by ArchUnit).
- Services must not depend on controllers; repositories must not depend on services (enforced by ArchUnit).
- The `common` package must not import from any feature package.
- Use Lombok (`@Data`, `@Builder`, `@RequiredArgsConstructor`) for boilerplate reduction.
- Follow the existing package-per-domain structure when adding new features.

### Frontend (TypeScript / React)

- **TypeScript strict mode** is enabled — no `any` unless absolutely necessary.
- State management with **Redux Toolkit** — one slice per feature.
- Use the design tokens from `index.css` and existing Tailwind utilities — no ad-hoc colors.
- Components go in `src/components/`, feature logic in `src/features/<name>/`.
- Use the `useDialog` hook for modals (focus trap, Escape, focus restore).

### Linting

```bash
cd frontend && npm run lint    # ESLint
```

## Testing

We maintain a multi-layer test pyramid. **All PRs should include tests** for new behavior.

### Backend

```bash
cd backend
./mvnw -B verify              # Integration tests + JaCoCo coverage
```

- Tests use **Testcontainers** — real PostgreSQL, Redis and Elasticsearch containers spin up automatically and are shared across every integration context (Docker must be running).
- Coverage report: `target/site/jacoco/index.html`

### Frontend

```bash
cd frontend
npm test                       # Vitest unit tests
npm run test:coverage          # Unit tests + v8 coverage report
```

- Coverage report: `coverage/index.html`

### End-to-End

```bash
cd frontend
npx playwright install --with-deps chromium
npm run test:e2e               # Playwright against vite preview
```

- E2E tests run against a **production build** with the backend stubbed (no server needed).
- Includes automated **accessibility checks** via axe-core.

### Architecture Tests

ArchUnit tests in `ArchitectureTests.java` enforce the modular-monolith conventions. They run automatically with the backend test suite.

### Mutation Testing (optional)

```bash
cd backend
./mvnw -Ppitest test org.pitest:pitest-maven:mutationCoverage
# Report: target/pit-reports/index.html
```

## Pull Request Process

1. Create a branch from `main` with the appropriate prefix.
2. Make your changes with tests.
3. Ensure all checks pass locally:
   - `cd backend && ./mvnw -B verify`
   - `cd frontend && npm run lint && npm test`
4. Open a pull request against `main`.
5. Fill in the PR template (what, why, how to test).
6. Wait for CI to pass and a maintainer review.

## Reporting Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.**

Instead, please use [GitHub's private vulnerability reporting](../../security/advisories/new) (the "Report a vulnerability" button on the Security tab). See [SECURITY.md](SECURITY.md) for what is in and out of scope. Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 7 days.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
