import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { AddressInfo } from "node:net";
if (
  !process.env.DATABASE_URL ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Tests require isolated local DATABASE_URL");
process.env.VERCEL = "1";
process.env.BINGO_APP_ORIGIN = "http://localhost:5173";
const tokens = new Map<string, { status: number; body?: unknown }>();
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input) === "https://id.string.sg/api/me") {
    const cookie = new Headers(init?.headers).get("cookie") || "";
    const fixture = tokens.get(cookie.split("=")[1]);
    return new Response(JSON.stringify(fixture?.body || {}), {
      status: fixture?.status || 401,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
};
let prisma: any, server: any, base: string;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
const a = "a".repeat(64),
  b = "b".repeat(64);
before(async () => {
  const mod = await import("../../backend/src/lib/prisma");
  prisma = mod.default;
  const app = (await import("../../backend/src/index")).default;
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await prisma.rateLimitBucket.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.game.deleteMany();
  await prisma.identityLinkAudit.deleteMany();
  await prisma.user.deleteMany();
  tokens.set(a, {
    status: 200,
    body: {
      member: {
        id: alice,
        email: "alice@example.com",
        name: "Alice",
        googleAccountId: "legacy-alice",
      },
    },
  });
  tokens.set(b, {
    status: 200,
    body: { member: { id: bob, email: null, name: "Bob" }, isAdmin: true },
  });
});
after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  await prisma?.$disconnect();
  globalThis.fetch = realFetch;
});
const headers = (token = a) => ({
  cookie: `string_session=${token}`,
  origin: "http://localhost:5173",
  "content-type": "application/json",
});
test("preserves legacy Google owner and logs deterministic identity link", async () => {
  const legacy = await prisma.user.create({
    data: {
      email: "alice@example.com",
      googleId: "legacy-alice",
      name: "Old Alice",
    },
  });
  const game = await prisma.game.create({
    data: {
      name: "Old game",
      creatorId: legacy.id,
      creatorEmail: legacy.email,
      challengesJson: [],
      gridSize: 3,
    },
  });
  const res = await fetch(base + "/api/auth/me", { headers: headers() });
  assert.equal(res.status, 200);
  const me: any = await res.json();
  assert.equal(me.id, legacy.id);
  assert.equal(me.isAdmin, false);
  assert.equal(me.stringMemberId, alice);
  assert.equal(
    (await prisma.game.findUnique({ where: { id: game.id } })).creatorId,
    legacy.id,
  );
  assert.equal(
    await prisma.identityLinkAudit.count({ where: { userId: legacy.id } }),
    1,
  );
});
test("phone-only String member can host without inheriting String ID admin", async () => {
  const res = await fetch(base + "/api/auth/me", { headers: headers(b) });
  assert.equal(res.status, 200);
  const me: any = await res.json();
  assert.equal(me.email, null);
  assert.equal(me.isAdmin, false);
});
test("cookie validation, upstream failure and Origin are distinct", async () => {
  assert.equal((await fetch(base + "/api/auth/me")).status, 401);
  tokens.set("c".repeat(64), { status: 503 });
  assert.equal(
    (await fetch(base + "/api/auth/me", { headers: headers("c".repeat(64)) }))
      .status,
    503,
  );
  assert.equal(
    (
      await fetch(base + "/api/games", {
        method: "POST",
        headers: { ...headers(), origin: "https://evil.example" },
        body: "{}",
      })
    ).status,
    403,
  );
});
test("3x3 create/play/edit preserves dimensions and denies another host", async () => {
  const challenges = Array.from({ length: 9 }, (_, i) => ({
    id: `q${i}`,
    text: `Prompt ${i + 1}`,
  }));
  const res = await fetch(base + "/api/games", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name: "Three", gridSize: 3, challenges }),
  });
  assert.equal(res.status, 201);
  const game: any = await res.json();
  const play: any = await (
    await fetch(base + `/api/games/${game.id}/play`)
  ).json();
  assert.equal(play.gridSize, 3);
  assert.equal(
    (
      await fetch(base + `/api/games/${game.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ challenges }),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(base + `/api/games/${game.id}`, {
        method: "DELETE",
        headers: headers(b),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + `/api/games/${game.id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: crypto.randomUUID(),
          playerName: "<img src=x onerror=alert(1)>",
        }),
      })
    ).status,
    200,
  );
  await prisma.game.update({
    where: { id: game.id },
    data: { isPublic: false },
  });
  assert.equal(
    (
      await fetch(base + `/api/games/${game.id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: crypto.randomUUID(),
          playerName: "Guest",
        }),
      })
    ).status,
    403,
  );
});
test("cookie filtering and email collisions do not silently reassign owners", async () => {
  assert.equal(
    (
      await fetch(base + "/api/auth/me", {
        headers: { cookie: `string_session=${a}; string_session=${b}` },
      })
    ).status,
    401,
  );
  const token = "e".repeat(64);
  tokens.set(token, {
    status: 200,
    body: {
      member: {
        id: "44444444-4444-4444-8444-444444444444",
        email: "alice@example.com",
        name: "Different member",
      },
    },
  });
  assert.equal(
    (await fetch(base + "/api/auth/me", { headers: headers(token) })).status,
    409,
  );
  assert.equal(
    (await prisma.user.findUnique({ where: { email: "alice@example.com" } }))
      .stringMemberId,
    alice,
  );
});
test("duplicate creation key returns one game; malformed progress and private writes fail", async () => {
  const key = crypto.randomUUID();
  const body = JSON.stringify({
    name: "Retry-safe",
    gridSize: 5,
    createKey: key,
    challenges: Array.from({ length: 25 }, (_, i) => ({
      id: `q${i}`,
      text: i === 12 ? "FREE" : `Prompt ${i}`,
    })),
  });
  const [r1, r2] = await Promise.all([
    fetch(base + "/api/games", { method: "POST", headers: headers(), body }),
    fetch(base + "/api/games", { method: "POST", headers: headers(), body }),
  ]);
  assert.ok([200, 201].includes(r1.status));
  assert.ok([200, 201].includes(r2.status));
  const g1: any = await r1.json(),
    g2: any = await r2.json();
  assert.equal(g1.id, g2.id);
  assert.equal(await prisma.game.count({ where: { clientCreateKey: key } }), 1);
  const sessionId = crypto.randomUUID();
  await fetch(base + `/api/games/${g1.id}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, playerName: "Player" }),
  });
  assert.equal(
    (
      await fetch(base + `/api/games/${g1.id}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          progressJson: [1000],
          isCompleted: true,
        }),
      })
    ).status,
    400,
  );
  await prisma.game.update({ where: { id: g1.id }, data: { isPublic: false } });
  assert.equal(
    (
      await fetch(base + `/api/games/${g1.id}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, progressJson: [0] }),
      })
    ).status,
    403,
  );
});

test('rate counters are atomic and shared across store instances',async()=>{
 const {PostgresRateLimitStore}=await import('../../backend/src/middleware/rate-limit');
 const a=new PostgresRateLimitStore('test-shared'),b=new PostgresRateLimitStore('test-shared');
 const counts=await Promise.all(Array.from({length:20},(_,i)=>(i%2?a:b).increment('test-client')));
 assert.deepEqual(counts.map(x=>x.totalHits).sort((x,y)=>x-y),Array.from({length:20},(_,i)=>i+1));
 assert.ok(counts.every(x=>x.resetTime.getTime()>Date.now()));await a.resetKey('test-client');
});
test('game creation is rate limited and sends Retry-After',async()=>{
 const {PostgresRateLimitStore}=await import('../../backend/src/middleware/rate-limit');const store=new PostgresRateLimitStore('create');await store.resetKey('127.0.0.1');
 for(let i=0;i<30;i++) assert.equal((await fetch(base+'/api/games',{method:'POST',headers:headers(),body:'{}'})).status,400);
 const blocked=await fetch(base+'/api/games',{method:'POST',headers:headers(),body:'{}'});assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);await store.resetKey('127.0.0.1');
});
