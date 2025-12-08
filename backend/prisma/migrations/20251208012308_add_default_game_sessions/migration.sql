-- CreateTable
CREATE TABLE "default_game_sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "challenge_set" TEXT NOT NULL,
    "grid_size" INTEGER NOT NULL DEFAULT 5,
    "progress_json" JSONB NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "default_game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "default_game_sessions_session_id_key" ON "default_game_sessions"("session_id");
