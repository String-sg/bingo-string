# Bingo API and String ID hosting

Bingo serves vanilla JS/Vite and Express/Prisma from the same HTTPS origin.
All String ID members may host; guests play public games without signing in.
The host workspace is **My games**. Site-wide admin reporting is not part of this release.

## Local setup

Use Node 22.12+ in the Node 22 line. From the repository root:

```sh
npm ci
# Set DATABASE_URL to a development database, never production for tests.
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run dev
# Separate terminal: BINGO_APP_ORIGIN=http://localhost:5173 PORT=3000 npx tsx backend/src/index.ts
```

Prisma generation uses its default location. Install from the root for Vercel;
`npm run check:startup` proves the exported API can load without a database query.

## Authentication contract

Bingo links to `https://id.string.sg/login?continue=bingo`. The backend validates
only the `string_session` cookie by calling fixed `https://id.string.sg/api/me`.
It returns a minimal identity to the browser; provider tokens, Google subjects and
private String ID profile fields are never copied into browser storage.
401 means signed out; 503 means identity service unavailable. A failed identity
lookup never becomes an empty game list. Host mutations require the exact
`BINGO_APP_ORIGIN` Origin (production default `https://bingo.string.sg`).

- `GET /api/auth/me`: validated local host projection.
- `POST /api/auth/logout`: guarded proxy to String ID; successful deletion cookie
  is relayed. This signs out this browser across String apps, not every device.
- `GET/POST /api/games`: list/create the signed-in user's games.
- `GET/PUT/DELETE /api/games/:id`: public read or owner-only management.
- `GET /api/games/:id/play`: public saved board including grid size.
- `POST /api/games/:id/join` and `/progress`: public games only, bounded guest
  name/UUID/cell indices; bingo is calculated server-side.
- `GET /api/games/:id/results`: authenticated owner only.
- Existing `/api/default-sessions` endpoints remain guest accessible.

Creation accepts an optional UUID `createKey`; repeated requests from the same
owner return the same game. The guided host editor uses this for retry safety.
`BINGO_ADMIN_MEMBER_IDS` is an explicit comma-separated String member UUID allowlist;
it never inherits String ID admin status and does not bypass owner-only routes.

## Existing games and release order

1. Deploy String ID PR75 before enabling Bingo's sign-in link. String ID needs
   `COOKIE_DOMAIN=.string.sg` and HTTPS. Google login is configured there.
2. Back up and review migration `202610250001_stable_string_identity`; apply
   `npx prisma migrate deploy --schema backend/prisma/schema.prisma` before deploying
   new readers. It backfills creator IDs through the existing email relationship,
   retains every user/game ID, and rolls back atomically if an owner is missing.
   A compatibility insert trigger fills creator IDs for the previous release.
3. Deploy Bingo. The same verified Google subject links a legacy host once, with
   an audit record. Email changes never reassign ownership. Phone-only new members
   can host. Email collisions without Google proof require an explicit review.
4. For an approved manual match, run the dry-run first:
   `npx tsx backend/scripts/link-member.ts USER_ID STRING_MEMBER_UUID`; verify
   ownership evidence, then repeat with `--apply`. Conflicts fail without rebinding.

Rollback application code first; retain the additive columns, backfilled IDs,
audit records and compatibility trigger. Do not drop new data during rollback.
Production migrations/configuration/deployments require separate approval.

## Verification

Use an isolated local database. Backend tests clear only test data and refuse
remote database hosts. Browser tests use real Bingo HTTP and database operations,
with only String ID mocked.

```sh
npm run build
npm run check:backend
npm run check:startup
DATABASE_URL=postgresql://e2e@127.0.0.1:55475/bingo_e2e npm run test:backend
BINGO_TEST_DATABASE_URL=postgresql://e2e@127.0.0.1:55475/bingo_e2e npm test
```

Photos now use per-game, per-player local storage keys. Legacy unscoped
`bingoCellImages` data is retained but not automatically attributed to another
game. Browser drafts use versioned session storage and clear only after creation.
The old GitHub Pages workflow cannot serve this authenticated backend; Vercel's
same-origin API is the release target. CI verifies the API and user journeys.

## Analytics Review and Proposed Scope (#56)

This is a source-code review, not confirmation of production database migrations
or successful Google Analytics delivery. The original "Better analytics" issue
remains relevant for tracking correctness and reporting. Phase 1 has an existing
implementation to repair, not a missing system to build again.

### Existing coverage

| Original requirement | Current implementation |
| --- | --- |
| Phase 1: default session storage, API, frontend integration | Present in source: `DefaultGameSession`, the `20251208012308_add_default_game_sessions` migration, the endpoints above, and `BingoApp.initializeDefaultGameSession()`. A UUID is persisted under `defaultBingoSession` in localStorage and reused on reload, but a missing import blocks session creation (see below). |
| Phase 2: game metrics | Partial: the database holds the latest cell indices and bingo state; GA event calls exist for `default_game_start`, `default_cell_completed`, and `default_game_completed`. No challenge-level aggregates exist. |
| Phase 2: session and performance metrics | Creation/update/completion timestamps exist, but no explicit active-duration, interaction-history, drop-off, load-time, or error-rate instrumentation exists. Console/server logs are not an error-rate metric. |
| Phase 3: analytics dashboard | Not implemented for default games. The existing dashboard shows custom-game results to their creator, not site-wide default-game statistics or trends. |

GA is optional: development reads `VITE_GOOGLE_ANALYTICS_ID`; runtime configuration
uses `googleAnalyticsId`. Production configuration supplies it; staging currently
does not. Database tracking operates independently of GA.

### Measurement limitations to resolve first

- **Blocked session creation:** `createDefaultGameSession()` references `CONFIG`,
  but the app imports only `getConfig` from the configuration module. The caught
  `ReferenceError` prevents the create request from being sent, so a new client's
  later progress requests have no database session to update. The following
  measurement issues also need addressing once creation works.
- **Missing starts:** `initializeDefaultGameSession()` attempts `default_game_start`
  before `setupAnalytics()` defines `gtag`, so the event is skipped on a normal
  fresh page load.
- **Sessions are not plays or people:** the default UUID has no expiry and reset
  does not rotate it. Changing the challenge set also reuses it; the create
  endpoint returns existing metadata unchanged. Row counts cannot be described
  as distinct plays or unique users.
- **Inaccurate completion state:** photo confirmation sends progress, but photo
  removal and reset do not. Reload restores images, not the grid's completed-cell
  set. Subsequent updates can therefore overwrite progress with incomplete state.
- **Repeated completions:** after bingo, subsequent successful progress updates
  emit `default_game_completed` again and replace `completedAt`. Completion means
  a bingo line, not every cell completed, and the timestamp is not reliably the
  first bingo.
- **Unreliable challenge denominators:** the intended tracking payload uses
  `CONFIG.GRID.size` (currently 3), while default `setupGrid()` renders size 5.
  Progress and GA labels use cell indices, not the CSV challenge IDs; filenames
  alone do not version challenge content.
- **No active-time or drop-off evidence:** `updatedAt - createdAt` measures elapsed
  time between database writes, including idle time and resumed visits. A latest
  progress snapshot does not reveal interaction order or when a player left.

### Privacy boundary

The default-session schema has no name, email, user relation, or photo field, and
the frontend sends only session metadata and cell indices. Custom sessions are
different: they include player-provided names. Persistent UUIDs still link visits,
and `progressJson` currently accepts arbitrary JSON rather than enforcing the
frontend's minimal payload.

Do not equate this schema with end-to-end anonymity: GA is a separate third-party
collector, and Morgan's `combined` access logs include IP address, request URL,
referrer, and user agent. No analytics consent/opt-out flow or session retention
cleanup is implemented. Decide disclosure, consent where applicable, retention,
and log redaction before expanding collection. Do not send names, emails, photos,
free text, or raw session IDs to GA or aggregate reports.

### Recommended follow-up work, in order

1. **Tracking correctness and privacy contract (next implementation issue).**
   Restore the missing configuration import and verify session creation through
   the API and database. Define a play as a new/reset/expired board, with an inactivity
   timeout; reload within that window resumes it. Rotate on challenge-set/version
   changes. Initialize permitted GA tracking before emitting events; count start
   and first bingo once per play. Synchronize removal/reset/reload state, preserve
   first-bingo time, and report actual board dimensions. Validate bounded session
   metadata and unique in-range cell indices on the backend. Specify and implement
   retention/cleanup and tracking controls.
   **Acceptance:** focused tests cover new/resumed/reset/expired sessions, changed
   challenge sets, first/repeated bingo, removal, reload, malformed payloads, and
   GA-disabled/API-failure paths; analytics failure must not prevent play.
2. **Minimal aggregate reporting, after reliable collection.**
   Record stable challenge IDs, content version, and which challenges were shown.
   Define bingo rate as plays reaching first bingo / eligible started plays,
   challenge completion rate as plays completing a challenge / plays shown it,
   and time-to-first-bingo separately from active duration. Specify reporting
   windows, treatment of unfinished plays, and exclusion of legacy unreliable
   records. Add an authenticated, explicitly authorized site-admin aggregate API
   and a small dashboard for starts, bingo rate, and challenge performance over
   time. Being a custom-game creator must not grant site-wide access.
   **Acceptance:** known-data tests verify denominators, empty windows, legacy
   exclusions, and authorization; reports expose no raw sessions or player data.
3. **Separate discovery for engagement and performance.**
   Define foreground-active time, a drop-off timeout/funnel, load-time boundaries,
   and an error-rate denominator before choosing instrumentation. Evaluate GA's
   existing reports before adding event storage. Any added telemetry should use
   bounded categories, sampling, retention, and no identifying URLs/error payloads.
   **Acceptance:** idle/background tabs do not inflate active time, absent unload
   events do not imply completion, and tests verify redaction and failure isolation.

Treat Phase 1 as present but blocked, and split its repair and Phases 2–3 into
these follow-ups rather than closing them as delivered. This review changes
documentation only; it does not fix the measurement gaps or add telemetry.
