import type { Prisma } from "@prisma/client";
import { activeSince, hashToken } from "./checked-bingo";

export const lockGameForPlay = (db: Prisma.TransactionClient, id: string) =>
  db.$queryRaw`SELECT id FROM games WHERE id = ${id} FOR SHARE`;

export async function canEditGame(db: Prisma.TransactionClient, gameId: string) {
  const [session, entry, round] = await Promise.all([
    db.gameSession.findFirst({ where: { gameId }, select: { id: true } }),
    db.checkedEntry.findFirst({ where: { gameId, activeAt: { gt: activeSince() } }, select: { id: true } }),
    db.liveRound.findFirst({ where: { gameId, endedAt: null, closesAt: { gt: new Date() } }, select: { id: true } }),
  ]);
  return !session && !entry && !round;
}

// Tie confirmation to the displayed roster so a retry cannot clear newly joined players.
export const resultsVersion = (rows: { id: string }[]) =>
  hashToken(rows.map(({ id }) => id).sort().join("\n"));

export const validResultsVersion = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
