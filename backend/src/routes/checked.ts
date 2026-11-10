import { randomInt, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import { Prisma, type CheckedEntry } from "@prisma/client";
import prisma from "../lib/prisma";
import { lockGameForPlay, resultsVersion, validResultsVersion } from "../lib/game-management";
import {
  activeSince, challengesOf, hashToken, normalizeAnswer, playerView, publicChallenges,
  roundStatus, tilesOf, updatedEntry, validToken,
} from "../lib/checked-bingo";
import { authenticateString, trustedOrigin, type AuthenticatedRequest } from "../middleware/auth";
import { hostLimiter, pinLimiter, submissionLimiter } from "../middleware/rate-limit";

const router = express.Router();
type Tx = Prisma.TransactionClient;
class Rejection extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function reject(status: number, message: string): never { throw new Rejection(status, message); }
const route = <R extends Request>(handler: (req: R, res: Response) => Promise<unknown>) =>
  async (req: R, res: Response) => {
    res.set("Cache-Control", "no-store");
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof Rejection) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      console.error("Checked Bingo request failed", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unexpected");
      res.status(503).json({ error: "Could not save or load Bingo. Please retry." });
    }
  };

function tokenHash(req: Request) {
  const token = req.get("x-bingo-player");
  if (!validToken(token)) return reject(401, "Join the game first.");
  return hashToken(token);
}

function demoConfig() {
  const gameId = process.env.BINGO_DEMO_BOARD_ID;
  const opensAt = new Date(process.env.BINGO_DEMO_FROM || "");
  const closesAt = new Date(process.env.BINGO_DEMO_UNTIL || "");
  const now = Date.now();
  if (!gameId || !(opensAt.getTime() <= now && now < closesAt.getTime())) return null;
  return { gameId, closesAt, demoKey: gameId + ":" + opensAt.toISOString() };
}

async function scopeFor(db: Tx, kind: string, id: string, lock?: "share" | "update") {
  if (kind === "rounds") {
    if (lock === "share") await db.$queryRaw`SELECT id FROM live_rounds WHERE id = ${id} FOR SHARE`;
    if (lock === "update") await db.$queryRaw`SELECT id FROM live_rounds WHERE id = ${id} FOR UPDATE`;
    const round = await db.liveRound.findUnique({ where: { id }, include: { game: true } });
    if (!round) return reject(404, "Session unavailable.");
    return { game: round.game, round, scope: "round:" + id, status: roundStatus(round) };
  }
  if (kind !== "boards") return reject(404, "Board unavailable.");
  if (lock === "share") await lockGameForPlay(db, id);
  if (lock === "update") await db.$queryRaw`SELECT id FROM games WHERE id = ${id} FOR UPDATE`;
  const game = await db.game.findUnique({ where: { id } });
  if (!game?.checked) return reject(404, "Board unavailable.");
  return { game, round: null, scope: "board:" + id, status: "playing" };
}

function playerAccess(scope: Awaited<ReturnType<typeof scopeFor>>) {
  if (!scope.round && !scope.game.isPublic) return reject(404, "Board unavailable.");
}

function ownGame(scope: Awaited<ReturnType<typeof scopeFor>>, req: AuthenticatedRequest) {
  if (scope.game.creatorId !== req.user?.id) return reject(403, "Only the board owner can do that.");
}

async function findEntry(db: Tx, scope: string, token: string, lock = false) {
  if (lock) await db.$queryRaw`SELECT id FROM checked_entries WHERE scope = ${scope} AND token_hash = ${token} FOR UPDATE`;
  const entry = await db.checkedEntry.findUnique({ where: { scope_tokenHash: { scope, tokenHash: token } } });
  if (!entry || entry.activeAt <= activeSince()) return reject(404, "This player entry has expired. Join again.");
  return entry;
}

function roundView(scope: Awaited<ReturnType<typeof scopeFor>>, entry: CheckedEntry) {
  return {
    status: scope.status,
    name: scope.game.name,
    ...(scope.round ? { roundId: scope.round.id } : {}),
    ...(scope.status === "playing" ? {
      gridSize: scope.game.gridSize,
      challenges: publicChallenges(scope.game.challengesJson),
    } : {}),
    player: playerView(entry),
  };
}

async function join(req: Request, kind: string, id: string) {
  const token = tokenHash(req);
  const { nickname, boardVersion } = req.body;
  if (typeof nickname !== "string" || !nickname.trim() || nickname.length > 40 || nickname.includes("\0"))
    return reject(400, "Enter a nickname of up to 40 characters.");
  return prisma.$transaction(async (db) => {
    const scope = await scopeFor(db, kind, id, "share");
    playerAccess(scope);
    if (scope.status === "ended") return reject(410, "This session has ended. Check the PIN with your teacher.");
    if (!scope.round && boardVersion !== undefined && boardVersion !== scope.game.updatedAt.toISOString())
      return reject(409, "The board changed. Reload to join.");
    await db.checkedEntry.deleteMany({ where: { scope: scope.scope, tokenHash: token, activeAt: { lte: activeSince() } } });
    await db.checkedEntry.createMany({
      data: { scope: scope.scope, gameId: scope.game.id, tokenHash: token, nickname: nickname.trim() },
      skipDuplicates: true,
    });
    return roundView(scope, await findEntry(db, scope.scope, token));
  });
}

router.get("/demo", route(async (_req, res) => {
  const config = demoConfig();
  if (!config) return res.json({ active: false });
  const round = await prisma.liveRound.findUnique({ where: { demoKey: config.demoKey } });
  return res.json({ active: !round || roundStatus(round) !== "ended" });
}));

router.post("/demo", hostLimiter, trustedOrigin, authenticateString, route(async (req: AuthenticatedRequest, res) => {
  const config = demoConfig();
  if (!config) return reject(404, "Demo session unavailable.");
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const round = await prisma.$transaction(async (db) => {
        await lockGameForPlay(db, config.gameId);
        const game = await db.game.findUnique({ where: { id: config.gameId }, select: { creatorId: true, checked: true } });
        if (game?.creatorId !== req.user?.id) return reject(403, "Only the demo owner can open the lobby.");
        if (!game?.checked) return reject(409, "Choose a board created with tile modes.");
        return db.liveRound.upsert({
          where: { demoKey: config.demoKey },
          create: { ...config, pin: String(randomInt(100000, 1000000)) },
          update: {},
        });
      });
      if (roundStatus(round) === "ended") return reject(410, "The demo session has ended.");
      return res.json({ id: round.id });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
  return reject(503, "Could not assign a PIN. Please retry.");
}));

router.post("/join", pinLimiter, route(async (req, res) => {
  const pin = req.body.pin;
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) return reject(400, "Enter the six-digit PIN.");
  const round = await prisma.liveRound.findUnique({ where: { pin }, select: { id: true } });
  if (!round) return reject(404, "Check the PIN with your teacher.");
  return res.json(await join(req, "rounds", round.id));
}));

router.post("/boards/:id/join", pinLimiter, route(async (req: Request<{ id: string }>, res) =>
  res.json(await join(req, "boards", req.params.id))));

router.get("/:kind/:id/state", route(async (req: Request<{ kind: string; id: string }>, res) => {
  const scope = await scopeFor(prisma, req.params.kind, req.params.id);
  playerAccess(scope);
  const entry = await findEntry(prisma, scope.scope, tokenHash(req));
  return res.json(roundView(scope, entry));
}));

router.post("/:kind/:id/action", submissionLimiter, route(async (req: Request<{ kind: string; id: string }>, res) => {
  const { requestId, action, index, text } = req.body;
  if (!validToken(requestId) || !["photo", "remove", "typed", "manual", "reset"].includes(action))
    return reject(400, "Invalid action.");
  const token = tokenHash(req);
  const result = await prisma.$transaction(async (db) => {
    const scope = await scopeFor(db, req.params.kind, req.params.id, "share");
    playerAccess(scope);
    const entry = await findEntry(db, scope.scope, token, true);
    const previous = await db.checkedAction.findUnique({ where: { entryId_requestId: { entryId: entry.id, requestId } } });
    if (previous) return { ...roundView(scope, entry), outcome: previous.outcome };
    if (scope.status !== "playing")
      return reject(409, scope.status === "ended" ? "Session ended." : "Wait for your teacher to start.");
    const { gridSize, challengesJson } = scope.game;
    const challenges = challengesOf(challengesJson);
    const tiles = tilesOf(entry);
    const now = new Date();
    let outcome = "saved";
    let nextTiles = tiles;
    if (action === "reset") nextTiles = {};
    else {
      if (!Number.isInteger(index) || index < 0 || index >= challenges.length || (gridSize === 5 && index === 12))
        return reject(400, "Invalid tile.");
      const tile = challenges[index];
      const mode = tile.mode || "photo";
      if (mode !== (action === "remove" ? "photo" : action)) return reject(400, "Choose the action for this tile.");
      if (action === "remove") delete tiles[index];
      else if (tiles[index]?.state === "done" || tiles[index]?.state === "pending") {
        outcome = tiles[index].state === "pending" ? "pending" : "saved";
        await db.checkedAction.create({ data: { entryId: entry.id, requestId, tile: index, outcome, at: now } });
        return { ...roundView(scope, entry), outcome };
      }
      else if (action === "photo") tiles[index] = { state: "done" };
      else {
        if (typeof text !== "string" || text.length > 160 || text.includes("\0") || (action === "typed" && !text.trim()))
          return reject(400, "Enter a short answer of up to 160 characters.");
        if (action === "manual") {
          tiles[index] = { state: "pending", requestId, ...(text.trim() ? { text } : {}) };
          outcome = "pending";
        } else {
          const recent = await db.checkedAction.findMany({
            where: { entryId: entry.id, tile: index, outcome: "miss", at: { gt: new Date(now.getTime() - 60000) } },
            orderBy: { at: "asc" }, take: 5,
          });
          if (recent.length === 5) {
            const retryAfter = Math.max(1, Math.ceil((recent[0].at.getTime() + 60000 - now.getTime()) / 1000));
            return { ...roundView(scope, entry), outcome: "cooldown", retryAfter };
          }
          if (tile.aliases?.includes(normalizeAnswer(text))) tiles[index] = { state: "done", text };
          else outcome = "miss";
        }
      }
    }
    await db.checkedAction.create({ data: { entryId: entry.id, requestId, tile: action === "reset" ? null : index, outcome, at: now } });
    const updated = await db.checkedEntry.update({
      where: { id: entry.id },
      data: updatedEntry(entry, challenges, gridSize, nextTiles, now),
    });
    return { ...roundView(scope, updated), outcome };
  });
  return res.status(result.outcome === "cooldown" ? 429 : 200).json(result);
}));

router.get("/rounds/:id/lobby", hostLimiter, authenticateString, route(async (req: AuthenticatedRequest<{ id: string }>, res) => {
  const scope = await scopeFor(prisma, "rounds", req.params.id);
  ownGame(scope, req);
  const players = await prisma.checkedEntry.findMany({
    where: { scope: scope.scope, activeAt: { gt: activeSince() } },
    select: { id: true, nickname: true },
    orderBy: { id: "asc" },
  });
  return res.json({ name: scope.game.name, pin: scope.round!.pin, status: scope.status, players });
}));

router.post("/rounds/:id/control", hostLimiter, trustedOrigin, authenticateString, route(async (req: AuthenticatedRequest<{ id: string }>, res) => {
  const { action } = req.body;
  if (action !== "start" && action !== "end") return reject(400, "Invalid session action.");
  const result = await prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT id FROM live_rounds WHERE id = ${req.params.id} FOR UPDATE`;
    const scope = await scopeFor(db, "rounds", req.params.id);
    ownGame(scope, req);
    if (scope.status === "ended" || (action === "start" && scope.status === "playing"))
      return scope.status;
    const round = await db.liveRound.update({
      where: { id: req.params.id },
      data: action === "start" ? { startedAt: new Date() } : { endedAt: new Date() },
    });
    return roundStatus(round);
  });
  return res.json({ status: result });
}));

router.get("/:kind/:id/results", hostLimiter, authenticateString, route(async (req: AuthenticatedRequest<{ kind: string; id: string }>, res) => {
  const scope = await scopeFor(prisma, req.params.kind, req.params.id);
  ownGame(scope, req);
  const entries = await prisma.checkedEntry.findMany({
    where: { scope: scope.scope, activeAt: { gt: activeSince() } },
    orderBy: [{ completedAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  });
  const challenges = challengesOf(scope.game.challengesJson);
  return res.json({
    status: scope.status,
    clearVersion: resultsVersion(entries),
    players: entries.map((entry) => ({
      id: entry.id, nickname: entry.nickname, completedAt: entry.completedAt, line: entry.win,
      pending: scope.status === "playing" ? Object.entries(tilesOf(entry)).flatMap(([i, tile]) => tile.state === "pending" ? [{
        index: Number(i), prompt: challenges[Number(i)].text, requestId: tile.requestId, text: tile.text,
      }] : []) : [],
    })),
  });
}));

router.post("/:kind/:id/results/clear", hostLimiter, trustedOrigin, authenticateString, route(async (req: AuthenticatedRequest<{ kind: string; id: string }>, res) => {
  const { version } = req.body;
  if (!validResultsVersion(version)) return reject(400, "Open Results before clearing.");
  await prisma.$transaction(async (db) => {
    const scope = await scopeFor(db, req.params.kind, req.params.id, "update");
    ownGame(scope, req);
    if (scope.round && scope.status !== "ended") return reject(409, "End this live session before clearing its results.");
    const entries = await db.checkedEntry.findMany({
      where: { scope: scope.scope, activeAt: { gt: activeSince() } },
      select: { id: true },
    });
    if (entries.length && resultsVersion(entries) !== version)
      return reject(409, "Results changed. Refresh Results before clearing.");
    await db.checkedEntry.deleteMany({ where: { scope: scope.scope } });
  });
  return res.json({ ok: true });
}));

router.post("/:kind/:id/review", hostLimiter, trustedOrigin, authenticateString, route(async (req: AuthenticatedRequest<{ kind: string; id: string }>, res) => {
  const { entryId, index, requestId, decision } = req.body;
  if (typeof entryId !== "string" || !Number.isInteger(index) || !validToken(requestId) || !["approve", "return"].includes(decision))
    return reject(400, "Invalid review.");
  await prisma.$transaction(async (db) => {
    const scope = await scopeFor(db, req.params.kind, req.params.id, "share");
    ownGame(scope, req);
    if (scope.status !== "playing") return reject(409, "Session is closed for review.");
    await db.$queryRaw`SELECT id FROM checked_entries WHERE id = ${entryId} AND scope = ${scope.scope} FOR UPDATE`;
    const entry = await db.checkedEntry.findFirst({ where: { id: entryId, scope: scope.scope, activeAt: { gt: activeSince() } } });
    if (!entry) return reject(404, "Player entry unavailable.");
    const tiles = tilesOf(entry);
    const tile = tiles[index];
    if (!tile || tile.requestId !== requestId) return reject(409, "That request is no longer pending.");
    if ((decision === "approve" && tile.state === "done") || (decision === "return" && tile.state === "returned")) return;
    if (tile.state !== "pending") return reject(409, "That request is no longer pending.");
    tiles[index] = decision === "approve" ? { ...tile, state: "done" } : { state: "returned", requestId };
    await db.checkedEntry.update({
      where: { id: entry.id },
      data: {
        ...updatedEntry(entry, challengesOf(scope.game.challengesJson), scope.game.gridSize, tiles, new Date()),
        activeAt: entry.activeAt,
      },
    });
  });
  return res.json({ ok: true });
}));

router.get("/purge", route(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(req.get("authorization") || "");
  const expected = Buffer.from("Bearer " + secret);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return reject(401, "Unauthorised.");
  const result = await prisma.checkedEntry.deleteMany({ where: { activeAt: { lte: activeSince() } } });
  return res.json({ removed: result.count });
}));

export default router;
