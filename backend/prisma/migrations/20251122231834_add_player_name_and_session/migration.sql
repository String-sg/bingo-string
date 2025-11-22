/*
  Warnings:

  - You are about to drop the column `user_email` on the `game_sessions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[game_id,session_id]` on the table `game_sessions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `player_name` to the `game_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session_id` to the `game_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "game_sessions" DROP CONSTRAINT "game_sessions_user_email_fkey";

-- DropIndex
DROP INDEX "game_sessions_game_id_user_email_key";

-- AlterTable
ALTER TABLE "game_sessions" DROP COLUMN "user_email",
ADD COLUMN     "is_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "player_name" TEXT NOT NULL,
ADD COLUMN     "session_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_game_id_session_id_key" ON "game_sessions"("game_id", "session_id");
