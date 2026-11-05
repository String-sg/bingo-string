# Validation and release

Use Node 22 and disposable local PostgreSQL. Never point tests at production.

1. On isolated storage, apply only the first four existing migrations and insert a synthetic legacy user/game.
2. Run `npm run build:vercel`: expect nonzero exit identifying both pending migrations, no Vite build, and unchanged fixture IDs/counts.
3. Apply only the stable-identity migration; rerun the guarded build: expect failure identifying the rate-limit migration.
4. Apply all existing migrations with `npx prisma migrate deploy --schema backend/prisma/schema.prisma`. Verify original user/game IDs and the backfilled creator ID. Verify an old-style game insert still fills its creator ID.
5. Set `DATABASE_URL` and `BINGO_TEST_DATABASE_URL` to the isolated local database. Run `npm run build:vercel`, `npm run check:backend`, `npm run check:startup`, `npm run test:backend`, and `npm test -- --workers=2 --reporter=line`.
6. With `DATABASE_URL` absent, `npm run build` must still work. `npm run check:db` must fail.

Before production: obtain separate approval, take a restorable backup, refresh migration status and owner/count baseline, then apply only the two reviewed pending migrations. Verify stable ownership, request counters and `check:db`; check the live signed-out and real signed-in mobile host journeys. Keep completed migrations and their data during application rollback. Do not call local mocked-identity success a real String ID pilot.

## Local validation evidence

- Migration lifecycle assertions passed: both pending migrations block `build:vercel`; after stable identity alone the request-limit migration still blocks it. Neither status check changed legacy fixture records. After both migrations, original user/game IDs and ownership remained intact and the previous-release insert trigger worked.
- `build:vercel` passed after all six migrations; missing and unreachable database checks failed as required. Plain `build` passed with `DATABASE_URL` absent.
- Backend typecheck and API startup passed. All 8 backend tests passed, including legacy linking, phone-only hosting, cookie filtering, Origin and cross-owner rejection, atomic shared counters and HTTP 429.
- All 38 desktop/mobile browser tests passed, including create/share/guest play, draft retention, session expiry and photo isolation. Identity alone was mocked; HTTP and local PostgreSQL were real.
- Local runtime reports Node 25.9.0; CI remains configured for the supported Node 22 line. The named local node@22 path also resolved to Node 25, so no local Node 22 claim is made.
- Node 22 CI run [41942038115](https://github.com/String-sg/bingo-string/actions/runs/41942038115) passed migrations, guarded build, typecheck, startup, all 8 backend tests and all 38 desktop/mobile browser tests. The workflow pins Ubuntu 24.04, supported by locked Playwright 1.56.0.
- The [latest Vercel preview](https://vercel.com/ogp-string/bingo-string/9MtXwyWkcfgeGY9pUXhKunzQQ8Ng) reached Neon and correctly stopped on exactly the two pending auth migrations. An earlier attempt had a P1001 connection failure. No successful preview deployment is claimed before those migrations are applied.
- Spec Kit prerequisites passed, the 7-item spec checklist passed, and all 6 functional requirements map to the 8 completed implementation tasks. No consistency or constitution issues found. No extension hooks are configured.

Production was inspected read-only. No production migration, account mapping, merge or deployment has been performed. A live signed-in pilot remains pending approval and real account access.
