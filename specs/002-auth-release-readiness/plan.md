# Implementation Plan: Auth release readiness

**Branch**: `codex/fix-host-auth-schema-check` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

## Summary

Apply the existing stable-identity and request-limit migrations only after production approval. Add `check:db` using Prisma's installed `migrate status` command, run it before the Vercel build, and exercise that exact build path in CI. Keep local `build` database-independent. No new runtime code, schema, dependency or auth policy.

## Technical Context

**Language/Version**: Existing JS/TypeScript, Node 22.
**Primary Dependencies**: Existing Prisma 5, Vite, Express and express-rate-limit.
**Storage**: Existing PostgreSQL; only isolated local PostgreSQL for tests.
**Testing**: Migration lifecycle fixture, existing backend and desktop/mobile Playwright suites.
**Target Platform**: Existing Vercel project `bingo-string` and custom domain `bingo.string.sg`.
**Project Type**: Web application.
**Performance Goals**: No added request-time work; readiness check runs during build only.
**Constraints**: No automatic migration, secret output, production tests or ownership reassignment.
**Scale/Scope**: Two existing pending migrations and three build/CI configuration files.

## Constitution Check

PASS before and after design: server-side authority and fail-closed limits retained; original IDs and owners preserved; guest routes unchanged; isolated migration/access tests required; existing stack reused. Production migration/deployment remain approval-gated. No unresolved research or technology selection needs delegation.

## Project Structure

- `package.json`: check:db and build:vercel.
- `vercel.json`: guarded build command.
- `.github/workflows/check.yml`: same guarded build in CI.
- `backend/README.md`: repair and release checks.
- `backend/prisma/migrations/`: reuse existing SQL unchanged.
- `tests/backend/auth.test.ts`: existing authority and shared-limit checks.
- `tests/host-onboarding.spec.js`: existing desktop/mobile journeys.
- `specs/002-auth-release-readiness/`: spec, plan, research, data model, run guide, tasks.

**Structure Decision**: Reuse existing commands and layout; no new application module.
