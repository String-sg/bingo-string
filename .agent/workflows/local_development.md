---
description: Run Bingo locally with String ID hosting
---

# Local development

Use Node22 and install with `npm ci` at the root. Follow `backend/README.md`
for the isolated database, additive migrations and server-only configuration.
Run `npm run dev` plus `npx tsx backend/src/index.ts` with
`BINGO_APP_ORIGIN=http://localhost:5173`. Google credentials belong to String ID,
not Bingo. Use `BINGO_TEST_DATABASE_URL` for browser tests, never production.

Run build, backend typecheck, API startup and host/guest tests before a draft PR.
