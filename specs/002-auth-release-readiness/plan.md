# Implementation Plan: Auth release readiness

**Branch**: `codex/fix-host-auth-schema-check` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

## Summary

Keep String ID as the primary action and restore Google's rendered sign-in button as a secondary fallback, using the official server verification library. POST the credential to an Origin-protected Bingo endpoint and resolve the user by Google subject. Discard the provider credential and issue a 256-bit opaque Bingo session: store its SHA-256 hash, owner and expiry in an additive table and place only the opaque value in a host-only HttpOnly/SameSite cookie. Expiry is bounded by the verified token and one hour; sign-out revokes the session. Retain stable owner IDs and shared rate limits. The explicit Google choice remains selected after expiry until a user chooses String ID or signs out. The two existing migrations and new session migration require separate production approval; retain the read-only Vercel build gate.

## Technical Context

**Language/Version**: Existing JS/TypeScript, Node 22.
**Primary Dependencies**: Existing Prisma 5, Vite, Express and express-rate-limit; reinstated official google-auth-library 11.3.3.
**Storage**: Existing PostgreSQL; only isolated local PostgreSQL for tests.
**Testing**: Migration lifecycle fixture, existing backend and desktop/mobile Playwright suites.
**Target Platform**: Existing Vercel project `bingo-string` and custom domain `bingo.string.sg`.
**Project Type**: Web application.
**Performance Goals**: Google verification runs only at login with the library's certificate cache; session lookup uses its hash primary key; readiness runs during build only.
**Constraints**: No automatic migration, secret output, production tests or ownership reassignment.
**Scale/Scope**: Google fallback, existing auth/game callers, labels, config and tests; two existing migrations plus the additive Bingo session table.

## Constitution Check

PASS before and after design: server-side authority and fail-closed limits retained; original IDs and owners preserved; guest routes unchanged; isolated migration/access tests required; existing stack reused. The user explicitly authorizes reinstating Google; its separate session leaves String ID's cookie contract unchanged. Production migration/deployment remain approval-gated. Existing Google client configuration matches; no new setup is required.

## Project Structure

- `package.json`: check:db and build:vercel.
- `vercel.json`: guarded build command.
- `.github/workflows/check.yml`: same guarded build in CI. GitHub requires the journey check against current main. Vercel independently checks migration state before building.
- `backend/README.md`: repair and release checks.
- `backend/src/middleware/auth.ts` and `backend/src/routes/auth.ts`: Google verification, stable-user resolution and cookie session.
- `backend/src/routes/games.ts`: shared host authentication for both providers.
- `js/authManager.js`, `js/game-creation.js`, `index.html`, `new.html`: Google button, continuation and provider-neutral labels.
- `tests/backend/server.ts`, `tests/backend/auth.test.ts`, `tests/host-onboarding.spec.js`: identity-boundary fixtures and desktop/mobile Google journeys.
- `backend/prisma/migrations/`: reuse existing SQL unchanged.
- `tests/backend/auth.test.ts`: existing authority and shared-limit checks.
- `tests/host-onboarding.spec.js`: existing desktop/mobile journeys.
- `specs/002-auth-release-readiness/`: spec, plan, research, data model, run guide, tasks.

**Structure Decision**: Reuse existing commands and layout; no new application module.
