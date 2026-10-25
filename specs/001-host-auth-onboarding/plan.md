# Implementation Plan: host-auth-onboarding

**Branch**: `codex/string-id-host-onboarding` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

Keep vanilla JS/Vite and Express/Prisma on same-origin Vercel. Replace Google browser tokens with server-confirmed String ID sessions. Use stable user IDs for ownership, explicit local admin configuration, and a short accessible creation wizard.

## Technical Context

Existing JavaScript/TypeScript stack; PostgreSQL; existing package-lock files. Local supported Node 22 runtime. Real Google and MOE policy are rollout checks; no production migration/deploy in this task.

## Constitution Check

PASS: server-side authority, stable identity, additive migrations, isolated tests, privacy and existing stack. Post-design recheck: no violations.

## Project Structure

backend/prisma/schema.prisma, backend/prisma/migrations, backend/src/middleware/auth.ts, backend/src/routes/auth.ts, backend/src/routes/games.ts, js/authManager.js, js/game-creation.js, js/app.js, js/bingoGrid.js, js/modalManager.js, new.html, index.html, styles/main.css, styles/host.css, tests

## Phase 0: Research

See [research.md](research.md). No unresolved design choices.

## Phase 1: Design

See [data-model.md](data-model.md), [contracts/auth.md](contracts/auth.md), [quickstart.md](quickstart.md).

## Complexity Tracking

No new service/framework; changes are limited to approved identity and host/guest journeys.

## Convergence addition: request limits

CodeQL identified missing creation rate limiting. Reuse PostgreSQL through express-rate-limit with an atomic shared store, a separate additive counter-table migration, bounded expiry cleanup and no token/raw-IP storage. Add concurrency and HTTP 429 coverage; preserve guest play outside host limits.
