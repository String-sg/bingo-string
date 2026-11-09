import { createHash } from "node:crypto";
import type { CheckedEntry, LiveRound, Prisma } from "@prisma/client";

export const retentionMs = 7 * 24 * 60 * 60 * 1000;
export const activeSince = () => new Date(Date.now() - retentionMs);
export const validToken = (value: unknown): value is string =>
  typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value);
export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizeAnswer = (value: string) => value.trim().toLowerCase();

export type Challenge = { id: string; text: string; mode?: "photo" | "typed" | "manual"; aliases?: string[] };
type Tile = { state: "done" | "pending" | "returned"; text?: string; requestId?: string };
export type Tiles = Record<number, Tile>;
export const challengesOf = (json: Prisma.JsonValue) => json as Challenge[];
export const tilesOf = (entry: CheckedEntry) => entry.tiles as Tiles;

export function parseChallenges(value: unknown, size: number, checked: boolean): Challenge[] | null {
  if (!Array.isArray(value) || value.length !== size * size) return null;
  const result: Challenge[] = [];
  for (const [index, c] of value.entries()) {
    if (!c || typeof c.id !== "string" || c.id.length > 100 || c.id.includes("\0") ||
        typeof c.text !== "string" || !c.text.trim() || c.text.length > 100 || c.text.includes("\0")) return null;
    const free = checked && size === 5 && index === 12;
    const tile: Challenge = { id: c.id, text: free ? "FREE" : c.text };
    if (checked && !free) {
      if (c.mode !== "photo" && c.mode !== "typed" && c.mode !== "manual") return null;
      tile.mode = c.mode;
      if (tile.mode === "typed") {
        if (!Array.isArray(c.aliases) || !c.aliases.length || c.aliases.length > 20 ||
            c.aliases.some((a: unknown) => typeof a !== "string" || !a.trim() || a.length > 160 || a.includes("\0"))) return null;
        tile.aliases = [...new Set<string>(c.aliases.map(normalizeAnswer))];
      }
    }
    result.push(tile);
  }
  return result;
}

export function publicChallenges(json: Prisma.JsonValue) {
  return challengesOf(json).map(({ id, text, mode }) => ({ id, text, ...(mode ? { mode } : {}) }));
}

export function firstLine(size: number, done: Set<number>) {
  if (size === 5) done.add(12);
  const indices = Array.from({ length: size }, (_, i) => i);
  const lines = [
    ...indices.map((r) => indices.map((c) => r * size + c)),
    ...indices.map((c) => indices.map((r) => r * size + c)),
    indices.map((i) => i * (size + 1)),
    indices.map((i) => (i + 1) * (size - 1)),
  ];
  return lines.find((line) => line.every((i) => done.has(i)));
}

export function updatedEntry(entry: CheckedEntry, challenges: Challenge[], size: number, tiles: Tiles, now: Date): Prisma.CheckedEntryUpdateInput {
  const update: Prisma.CheckedEntryUpdateInput = { tiles, activeAt: now, revision: { increment: 1 } };
  if (entry.completedAt) return update;
  const line = firstLine(size, new Set(Object.entries(tiles).filter(([, tile]) => tile.state === "done").map(([i]) => Number(i))));
  if (!line) return update;
  update.completedAt = now;
  update.win = line.map((index) => ({
    index,
    prompt: challenges[index].text,
    mode: size === 5 && index === 12 ? "free" : challenges[index].mode || "photo",
    ...(tiles[index]?.text !== undefined ? { text: tiles[index].text } : {}),
  }));
  return update;
}

export function playerView(entry: CheckedEntry) {
  return {
    nickname: entry.nickname,
    revision: entry.revision,
    tiles: Object.fromEntries(Object.entries(tilesOf(entry)).map(([i, tile]) => [i, tile.state])),
    completedAt: entry.completedAt,
    line: (entry.win as { index: number }[] | null)?.map(({ index }) => index) ?? null,
  };
}

export function roundStatus(round: LiveRound, now = new Date()) {
  if (round.endedAt || round.closesAt <= now) return "ended";
  return round.startedAt ? "playing" : "waiting";
}
