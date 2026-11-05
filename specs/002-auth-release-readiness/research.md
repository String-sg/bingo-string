# Research: Auth release readiness

## Incident boundary

The supplied mobile screenshot and live browser both show `Request service unavailable. Please retry.` The deployed `/api/auth/me` returns 503 from `identityLimiter`, before `authenticateString` or the String ID request. Guest session requests still succeed. Read-only production inspection found only the four migrations through `20251208012308_add_default_game_sessions` applied; `string_member_id`, `creator_id`, `identity_link_audit` and `rate_limit_buckets` were absent. Aggregate baseline: 12 users, 9 games, zero games without a matching legacy owner. No production data was changed.

## Decision

Reuse existing migrations `202610250001_stable_string_identity` and `202610250002_host_request_limits`. Gate Vercel builds with installed Prisma `migrate status`; use the same guarded build in CI. Keep the normal frontend build available without a database. Follow Ponytail full: use existing commands, retain security and data boundaries, add no custom readiness service.

## Rationale

The database predates the code already deployed. Bypassing the limiter would only expose the next missing-column failure. Applying the existing migrations restores both boundaries; a read-only migration check catches this release-order failure before future deployment.

## Alternatives considered

- New auth provider or cookie changes: unsupported by the failed boundary.
- Removing/failing open the limiter: violates the existing authority contract.
- Custom schema checker or automatic migration during build: adds code or mutates production without the required approval.

`migrate status` checks migration history, not arbitrary manual schema drift. Revisit schema-diff checks if drift becomes an observed problem. It cannot protect the database after build time, so release still requires the documented post-migration and browser checks.

## CI runner compatibility

The first PR run passed the guarded build, backend typecheck, startup and all backend tests on Node 22, then failed before browser tests because `ubuntu-latest` resolved to Ubuntu 26.04, unsupported by the locked Playwright 1.56.0. Pin the existing job to supported Ubuntu 24.04; no dependency upgrade is needed.
