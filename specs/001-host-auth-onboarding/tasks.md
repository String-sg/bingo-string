# Tasks: host-auth-onboarding

## Phase 1: Setup

- [X] T001 Fix Prisma generation and API cold-start checks in backend/prisma/schema.prisma and package.json.

## Phase 2: Foundational

- [X] T002 Write additive stable-owner schema/migration and audited linking script in backend/prisma and backend/scripts/link-member.ts.

## Phase 3: US1

- [X] T003 [US1] Add adapter/ownership/Origin tests before handlers in tests/backend.test.ts.

## Phase 4: US1

- [X] T004 [US1] Replace Google bearer auth with String ID session projection, linking, explicit admin grants and logout in backend/src/middleware/auth.ts and backend/src/routes/auth.ts.

## Phase 5: US1

- [X] T005 [US1] Switch browser login, host intent and My Games state handling in js/authManager.js and index.html.

## Phase 6: US2

- [X] T006 [US2] Build draft-safe setup/challenges/review/share flow and size-aware CSV validation in js/game-creation.js, new.html and styles/main.css.

## Phase 7: US3

- [X] T007 [US3] Repair board size, private-game checks, payload validation and safe result rendering in backend/src/routes/games.ts and js/authManager.js.

## Phase 8: US3

- [X] T008 [US3] Add accessible cells/dialogs, photo namespacing and unavailable-game states in js/bingoGrid.js, js/modalManager.js and js/app.js.

## Phase 9: Polish

- [X] T009 Add desktop/mobile host/guest acceptance tests in tests/host-onboarding.spec.js and CI checks in .github/workflows/check.yml.

## Phase 10: Polish

- [X] T010 Validate build, backend typecheck, API cold start, isolated DB migration and browser journeys; document rollout in backend/README.md.

## Dependencies

Setup → stable data/auth foundations → user stories → verification. No same-file task runs concurrently.

## Implementation Strategy

Complete identity foundation first, then user-facing flow and failure cases; verify before draft PR. Independent documentation may be reviewed separately.

## Phase 11: Convergence

- [x] T011 [US1] Resolve CodeQL missing rate limiting with atomic shared PostgreSQL counters in backend/src/middleware/rate-limit.ts, additive request-limit migration, HTTP/instance concurrency tests and updated rollout docs.
