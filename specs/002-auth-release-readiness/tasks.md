# Tasks: Auth release readiness

## Phase 1: Setup

- [x] T001 Reproduce the reported error, inspect deployed migration state read-only, and record the boundary in specs/002-auth-release-readiness/research.md.

## Phase 2: Foundation

- [x] T002 Review the two existing auth migrations under backend/prisma/migrations/ and production approval constraints in .specify/memory/constitution.md.

## Phase 3: Resume hosting (US1)

**Independent test**: Synthetic legacy owner/game retain IDs and ownership after both existing migrations; existing host/guest/access suites pass.

- [x] T003 [US1] Exercise backend/prisma/migrations/ against isolated legacy fixtures, including the previous-release compatibility insert.
- [x] T004 [US1] Run tests/backend/auth.test.ts and the desktop/mobile tests/host-onboarding.spec.js suite with isolated data; record results in specs/002-auth-release-readiness/quickstart.md.
- [x] T005 [US1] Prepare the exact production repair and verification steps in backend/README.md for separate approval, including backup and owner-count checks.

## Phase 4: Reject an unready release (US2)

**Independent test**: The Vercel build fails with two and then one pending migration, passes after both, and does not modify fixtures during checks.

- [x] T006 [US2] Add Prisma-based check:db and build:vercel scripts in package.json and select the guarded build in vercel.json.
- [x] T007 [US2] Use build:vercel in .github/workflows/check.yml and verify missing migrations/configuration fail, while ordinary build remains database-independent.

## Phase 5: Review

- [x] T008 Record validation, limitations and pending production work in specs/002-auth-release-readiness/quickstart.md for the reviewable branch and draft PR.

## Phase 6: Reinstate Google (US1)

- [x] T009 [US1] Add Google identity-boundary cases to tests/backend/auth.test.ts and direct sign-in/expiry/draft/browser cases to tests/host-onboarding.spec.js, mocking only the provider.
- [x] T010 [US1] Restore official verification and stable subject matching in backend/src/middleware/auth.ts, add opaque revocable sessions via backend/prisma/migrations/202611070001_google_host_sessions/, and an Origin-protected HttpOnly exchange/logout in backend/src/routes/auth.ts; update every protected caller in backend/src/routes/games.ts.
- [x] T011 [US1] Keep String ID primary in js/authManager.js and render Google as a secondary fallback, retain saved continuation, and update host labels in js/game-creation.js and new.html.
- [x] T012 [US1] Update backend/README.md, environment examples and Spec Kit evidence; run the scoped backend and full desktop/mobile checks for review in PR #72.

## Dependencies and implementation strategy

T001 → T002 → T003. T006 enables the guarded-build portion of T003; T004 and T007 follow migration fixture validation. T005 and T008 complete review before requesting production approval. No production mutation is an implementation task.

There is no useful parallel implementation work in this small repair. Existing independent typecheck/startup commands may run together. MVP is the verified existing migration repair; US2 prevents this release-order failure recurring.

## Phase 7: Convergence

- [x] T013 [US2] Require the GitHub Actions journey check on current main and verify the rule has no bypass (FR-011).
- [ ] T014 [US2] After separate production migration approval, verify schema and ownership, validate the exact Vercel Preview candidate and complete a real signed-in smoke test (FR-001, FR-002, FR-006, FR-011).
