# Validation Guide

Use Node22 and isolated local PostgreSQL only. Never use production credentials for tests.

Run `npm ci`, `npm run build`, backend typecheck and backend tests. Start the mocked frontend acceptance suite using Playwright for desktop/mobile. On a separate local DB apply existing migrations plus the stable-owner migration against seeded legacy users/games and verify IDs and ownership remain unchanged. Production requires schema migration, approved legacy mapping, shared String ID cookie and HTTPS.

## Evidence

Node 22.23.4: frontend build, backend TypeScript and API cold-start checks passed. Six real-DB backend tests and all 38 desktop/mobile Playwright checks passed. Browser-to-API-to-DB checks include photo completion and owner result retrieval. Fresh Prisma migrate deploy passed on an isolated DB; legacy SQL fixture retained game/user IDs and accepted a previous-release insert through the compatibility trigger. Visual review caught and fixed outline-button contrast and mobile step wrapping.

All user stories and requirements were compared against code/tests; no implementation gaps remain. Production schema/configuration and a real String ID/MOE pilot remain release prerequisites.
