BEGIN;
CREATE TABLE "bingo_host_sessions" (
  "token_hash" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "bingo_host_sessions_expires_at_idx" ON "bingo_host_sessions"("expires_at");
COMMIT;
