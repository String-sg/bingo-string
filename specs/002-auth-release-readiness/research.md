# Research: Auth release readiness

## Incident boundary

The supplied mobile screenshot and live browser both show `Request service unavailable. Please retry.` The deployed `/api/auth/me` returns 503 from `identityLimiter`, before `authenticateString` or the String ID request. Guest session requests still succeed. Read-only production inspection found only the four migrations through `20251208012308_add_default_game_sessions` applied; `string_member_id`, `creator_id`, `identity_link_audit` and `rate_limit_buckets` were absent. Aggregate baseline: 12 users, 9 games, zero games without a matching legacy owner. No production data was changed.

## Decision

Keep String ID primary and restore direct Google as a secondary fallback, as requested. Reuse the existing OAuth client and Google's rendered button with official server verification. Resolve by verified Google subject and discard the Google credential. An opaque Bingo session is stored only as a hash, with its user and expiry, in one additive session table. This satisfies the constitution's prohibition on retaining provider bearer tokens and supports revocation without a new signing secret. A provider-choice cookie prevents account switching on expiry. Clearing the fallback before the primary String ID handoff is Origin-protected and database-independent. Google's [server verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) recommends its verification library and stable `sub` identity; its [button guide](https://developers.google.com/identity/gsi/web/guides/display-button) supplies the rendering API.

Reuse existing migrations `202610250001_stable_string_identity` and `202610250002_host_request_limits`. Both providers still require them. Add `202611070001_google_host_sessions` for Bingo-owned fallback sessions. Gate Vercel builds with installed Prisma `migrate status`; use the same guarded build in CI. Keep the normal frontend build available without a database. Follow Ponytail full: reuse configuration and ownership fields; no custom JWT signer, new signing-secret setup or readiness service.

## Rationale

The database predates the code already deployed. Bypassing the limiter would only expose the next missing-column failure. Applying the existing migrations restores both boundaries; a read-only migration check catches this release-order failure before future deployment.

## Alternatives considered

- Replacing String ID with Google: contradicts the user's clarified provider order.
- Reusing the old browser-decoded/localStorage token flow: does not establish a server-authoritative session; use official verification and HttpOnly cookies.
- Matching Google users by email: could reassign legacy games; use stable subject matching and reject collisions.
- Removing/failing open the limiter: violates the existing authority contract.
- Custom schema checker or automatic migration during build: adds code or mutates production without the required approval.

`migrate status` checks migration history, not arbitrary manual schema drift. Revisit schema-diff checks if drift becomes an observed problem. It cannot protect the database after build time, so release still requires the documented post-migration and browser checks.

## CI runner compatibility

The first PR run passed the guarded build, backend typecheck, startup and all backend tests on Node 22, then failed before browser tests because `ubuntu-latest` resolved to Ubuntu 26.04, unsupported by the locked Playwright 1.56.0. Pin the existing job to supported Ubuntu 24.04; no dependency upgrade is needed.
