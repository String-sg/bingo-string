# Live Bingo preview and release checks

Use a dedicated empty database for preview. Apply the tracked Prisma migrations before deploying the app. Seed synthetic fixtures with `tests/fixtures/seed-checked.ts`. The seed requires a loopback `bingo_e2e` database or the isolated `bingo_preview` database with its exact host in `BINGO_ISOLATED_DATABASE_HOST`.

Configure these server values on the preview deployment.

- `BINGO_DEMO_BOARD_ID` points to the configured board. The fixture uses `bingodemoboard`.
- `BINGO_DEMO_FROM` and `BINGO_DEMO_UNTIL` define the demo window as ISO timestamps with offsets.
- `CRON_SECRET` authorises the cleanup route. Expired entries become inaccessible at seven days and the hourly job deletes them. Test that route directly on preview.
- The test-only identity module in `tests/fixtures/preview-identity.ts` can be imported from the API entry point in a disposable preview checkout. Supply distinct random 64-character hexadecimal `BINGO_TEST_HOST_COOKIE` and `BINGO_TEST_OTHER_COOKIE` values as preview-only secrets. The module checks the environment and database and mocks only the upstream String ID member response. The checked-in API does not import it.

Run the repository checks, then run the acceptance and load scripts against the isolated deployment. Set `BINGO_TEST_TARGET` to the preview origin. Use the matching synthetic cookies and set `BINGO_TEST_CRON_SECRET` for the retention check. For a protected Vercel preview, use the linked project’s short-lived development OIDC token through `vercel env run`. Load fixtures require a fresh seed for each run.

```sh
npm run check:backend
npm run check:startup
npm run test:backend
npm test
npm run build
node tests/live-acceptance.mjs
node tests/live-load.mjs
```

The function region is Singapore to keep the API close to the Bingo database. Before a separately approved production release, verify the migration and configure the selected mixed board, demo window and cleanup secret. The production API uses the existing String ID integration.
