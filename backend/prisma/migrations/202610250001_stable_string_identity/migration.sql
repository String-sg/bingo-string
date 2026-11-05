BEGIN;
-- Preserve every game and user ID; stop if historical data cannot be backfilled.
ALTER TABLE "users" ADD COLUMN "string_member_id" TEXT;
CREATE UNIQUE INDEX "users_string_member_id_key" ON "users"("string_member_id");
ALTER TABLE "games" ADD COLUMN "creator_id" TEXT;
UPDATE "games" g SET "creator_id"=u."id" FROM "users" u WHERE g."creator_email"=u."email";
ALTER TABLE "games" ALTER COLUMN "creator_id" SET NOT NULL;
ALTER TABLE "games" DROP CONSTRAINT "games_creator_email_fkey";
ALTER TABLE "games" ADD CONSTRAINT "games_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "games" ALTER COLUMN "creator_email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL;
CREATE TABLE "identity_link_audit" (
 "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "string_member_id" TEXT NOT NULL,
 "method" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "games" ADD COLUMN "client_create_key" TEXT;
CREATE UNIQUE INDEX "games_client_create_key_key" ON "games"("client_create_key");

-- Keep the previous release able to insert games during the migration/deploy gap.
CREATE FUNCTION "bingo_fill_creator_id"() RETURNS trigger AS $$
BEGIN
 IF NEW."creator_id" IS NULL AND NEW."creator_email" IS NOT NULL THEN
  SELECT "id" INTO NEW."creator_id" FROM "users" WHERE "email"=NEW."creator_email";
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bingo_fill_creator_id" BEFORE INSERT ON "games"
 FOR EACH ROW EXECUTE FUNCTION "bingo_fill_creator_id"();
COMMIT;
