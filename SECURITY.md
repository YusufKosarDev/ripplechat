# Security Policy

## Supported versions

RippleChat is a portfolio project deployed as a single live instance; only the
latest commit on `main` (and the most recent release) is supported.

| Version | Supported |
|---------|-----------|
| latest `main` / newest release | ✅ |
| anything older | ❌ |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Preferred: [GitHub private vulnerability reporting](../../security/advisories/new)
  ("Report a vulnerability" on the Security tab).
- You should receive an acknowledgement within a few days. Please include
  reproduction steps and the affected endpoint/component.

Out of scope: the intentionally public demo credentials (`demo` / `demo1234`)
and anything only reachable with them — the demo account is sandboxed (rate
limits stay active, the account is reset nightly, and demo channels
self-clean). Reports about denial of service against the free-tier hosting are
also out of scope.

## Hardening already in place

Authentication uses short-lived JWTs with rotating refresh tokens and 2FA;
passwords are BCrypt-hashed; secrets are validated at startup. The backend
sets HSTS, frame-deny and a `frame-ancestors` CSP; the frontend ships a strict
enforced CSP. Rate limiting and account lockout are Redis-backed, link
unfurling is SSRF-guarded, and CodeQL runs on every push and weekly.
