ALTER TABLE "games" ADD COLUMN "checked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "live_rounds" (
    "id" TEXT PRIMARY KEY,
    "game_id" TEXT NOT NULL REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "pin" TEXT NOT NULL UNIQUE,
    "demo_key" TEXT UNIQUE,
    "closes_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3)
);
CREATE INDEX "live_rounds_game_id_idx" ON "live_rounds"("game_id");

CREATE TABLE "checked_entries" (
    "id" TEXT PRIMARY KEY,
    "game_id" TEXT NOT NULL REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "scope" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "tiles" JSONB NOT NULL DEFAULT '{}',
    "win" JSONB,
    "completed_at" TIMESTAMPTZ(3),
    "active_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "checked_entries_scope_token_hash_key" ON "checked_entries"("scope", "token_hash");
CREATE INDEX "checked_entries_scope_completed_at_idx" ON "checked_entries"("scope", "completed_at");
CREATE INDEX "checked_entries_active_at_idx" ON "checked_entries"("active_at");
CREATE INDEX "checked_entries_game_id_idx" ON "checked_entries"("game_id");

CREATE TABLE "checked_actions" (
    "entry_id" TEXT NOT NULL REFERENCES "checked_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "request_id" TEXT NOT NULL,
    "tile" INTEGER,
    "outcome" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("entry_id", "request_id")
);
CREATE INDEX "checked_actions_entry_id_tile_outcome_at_idx" ON "checked_actions"("entry_id", "tile", "outcome", "at");
