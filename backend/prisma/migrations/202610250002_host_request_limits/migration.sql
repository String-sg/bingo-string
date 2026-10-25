BEGIN;
CREATE TABLE "rate_limit_buckets" (
 "key" TEXT PRIMARY KEY, "hits" INTEGER NOT NULL, "reset_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");
COMMIT;
