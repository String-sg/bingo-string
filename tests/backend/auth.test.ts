import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { TokenPayload } from "google-auth-library";
const backendRequire = createRequire(resolve(__dirname, "../../backend/package.json"));
const { OAuth2Client, LoginTicket } = backendRequire("google-auth-library") as typeof import("google-auth-library");
if (
  !process.env.DATABASE_URL ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Tests require isolated local DATABASE_URL");
process.env.VERCEL = "1";
process.env.BINGO_APP_ORIGIN = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "test-google-client";
const googleTokens = new Map<string, TokenPayload>();
const realGoogleVerify = OAuth2Client.prototype.verifyIdToken;
OAuth2Client.prototype.verifyIdToken = (async (options: any) => {
  assert.equal(options.audience, "test-google-client");
  const payload = googleTokens.get(options.idToken);
  if (!payload || payload.aud !== options.audience) throw new Error("Invalid Google credential");
  return new LoginTicket(undefined, payload);
}) as typeof realGoogleVerify;
const googlePayload = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
  iss: "https://accounts.google.com", aud: "test-google-client",
  sub: "legacy-alice", email: "alice@example.com", email_verified: true,
  name: "Google Alice", iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600, ...overrides,
});
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
  OAuth2Client.prototype.verifyIdToken = realGoogleVerify;
});
const headers = (token = a) => ({
  cookie: `string_session=${token}`,
  origin: "http://localhost:5173",
  "content-type": "application/json",
});
test("Express 5 preserves JSON 404s for root and nested unknown routes", async () => {
  for (const path of ["/", "/api/unknown/nested"]) {
    for (const method of ["GET", "POST"]) {
      const res = await fetch(base + path, { method });
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { error: "Route not found" });
    }
  }
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

test("empty and unparsed request bodies still reach route validation", async () => {
  for (const path of ["/api/games", "/api/default-sessions"]) {
    for (const body of [undefined, "unparsed text"]) {
      const res = await fetch(base + path, {
        method: "POST",
        headers: { ...headers(), "content-type": "text/plain" },
        body,
      });
      assert.equal(res.status, 400);
      assert.equal(typeof (await res.json()).error, "string");
    }
  }
});

test("Google signs in the original subject, preserves ownership and uses a bounded HttpOnly cookie", async () => {
  const credential = "header.alice.signature";
  googleTokens.set(credential, googlePayload({ email: "changed@example.com" }));
  const original = await prisma.user.findUnique({ where: { googleId: "legacy-alice" } });
  const games = await prisma.game.findMany({ where: { creatorId: original.id } });
  const previousEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  let response: Response;
  try {
    response = await fetch(base + "/api/auth/google", {
      method: "POST", headers: headers(), body: JSON.stringify({ credential }),
    });
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  }
  assert.equal(response!.status, 200);
  const me: any = await response!.json();
  assert.equal(me.id, original.id);
  assert.equal(me.provider, "google");
  assert.equal(me.email, original.email);
  assert.equal(me.isAdmin, false);
  assert.ok(!JSON.stringify(me).includes(credential));
  const cookie = response!.headers.getSetCookie()[0];
  assert.match(cookie, /^bingo_google_session=/);
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/); assert.doesNotMatch(cookie, /Domain=/);
  const maxAge = Number(cookie.match(/Max-Age=(\d+)/)?.[1]);
  assert.ok(maxAge > 0 && maxAge <= 3600);
  const cookieToken = cookie.split(";")[0].split("=")[1];
  assert.match(cookieToken, /^[a-f0-9]{64}$/);
  const sessions = await prisma.bingoHostSession.findMany({ where: { userId: original.id } });
  assert.equal(sessions.length, 1);
  assert.notEqual(sessions[0].tokenHash, cookieToken);
  assert.ok(!JSON.stringify(sessions).includes(credential));
  assert.deepEqual(await prisma.game.findMany({ where: { creatorId: original.id } }), games);
  const checked = await fetch(base + "/api/auth/me", {
    headers: { cookie: cookie.split(";")[0] + `; string_session=${b}` },
  });
  assert.equal(checked.status, 200);
  assert.equal((await checked.json() as any).id, original.id);
  await prisma.bingoHostSession.update({ where: { tokenHash: sessions[0].tokenHash }, data: { expiresAt: new Date(0) } });
  assert.equal((await fetch(base + "/api/auth/me", {
    headers: { cookie: cookie.split(";")[0] + `; string_session=${b}` },
  })).status, 401);
});

test("Google rejects invalid/expired/unverified credentials and email-only owner collisions", async () => {
  const count = await prisma.user.count();
  googleTokens.set("header.wrong.signature", googlePayload({ aud: "wrong-client" }));
  googleTokens.set("header.expired.signature", googlePayload({ exp: Math.floor(Date.now()/1000)-1 }));
  googleTokens.set("header.unverified.signature", googlePayload({ email_verified: false }));
  for (const credential of ["not-a-token", "header.unknown.signature", "header.wrong.signature", "header.expired.signature", "header.unverified.signature"]) {
    assert.equal((await fetch(base + "/api/auth/google", {
      method: "POST", headers: headers(), body: JSON.stringify({ credential }),
    })).status, 401);
  }
  assert.equal((await fetch(base + "/api/auth/google", {
    method: "POST", headers: { ...headers(), origin: "https://evil.example" },
    body: JSON.stringify({ credential: "header.alice.signature" }),
  })).status, 403);
  googleTokens.set("header.collision.signature", googlePayload({ sub: "different-subject" }));
  assert.equal((await fetch(base + "/api/auth/google", {
    method: "POST", headers: headers(), body: JSON.stringify({ credential: "header.collision.signature" }),
  })).status, 409);
  assert.equal(await prisma.user.count(), count);
  assert.equal((await fetch(base + "/api/auth/me", {
    headers: { cookie: "bingo_google_session=header.alice.signature; bingo_google_session=header.wrong.signature" },
  })).status, 401);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    assert.equal((await fetch(base + "/api/auth/google", {
      method: "POST", headers: headers(), body: JSON.stringify({ credential: "header.alice.signature" }),
    })).status, 503);
  } finally { process.env.GOOGLE_CLIENT_ID = clientId; }
});

test("a new Google host is created once, cannot manage another host's game and signs out only of Bingo", async () => {
  const credential = "header.newhost.signature";
  googleTokens.set(credential, googlePayload({ sub: "new-google-subject", email: "new-google@example.com" }));
  const responses = await Promise.all(Array.from({ length: 2 }, () => fetch(base + "/api/auth/google", {
    method: "POST", headers: headers(), body: JSON.stringify({ credential }),
  })));
  assert.ok(responses.every(r => r.status === 200));
  const first: any = await responses[0].json(), second: any = await responses[1].json();
  assert.equal(first.id, second.id); assert.equal(first.stringMemberId, null);
  assert.equal(await prisma.user.count({ where: { googleId: "new-google-subject" } }), 1);
  const cookie = responses[0].headers.getSetCookie()[0].split(";")[0];
  const game = await prisma.game.findFirst({ where: { creatorId: { not: first.id } } });
  assert.equal((await fetch(base + `/api/games/${game.id}/results`, { headers: { cookie } })).status, 403);
  const logout = await fetch(base + "/api/auth/logout", {
    method: "POST", headers: { ...headers(), cookie: cookie + `; string_session=${a}` },
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.headers.getSetCookie().length, 2);
  assert.ok(logout.headers.getSetCookie().every(c => /^bingo_(google_session|auth_provider)=;/.test(c)));
  assert.match(logout.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
  assert.equal((await fetch(base + "/api/auth/me", { headers: { cookie } })).status, 401);
  const stringToken = "f".repeat(64);
  tokens.set(stringToken, { status: 200, body: { member: {
    id: "55555555-5555-4555-8555-555555555555", email: "new-google@example.com",
    name: "Linked host", googleAccountId: "new-google-subject",
  } } });
  const linked = await fetch(base + "/api/auth/me", { headers: headers(stringToken) });
  assert.equal((await linked.json() as any).id, first.id);
  assert.equal(await prisma.identityLinkAudit.count({ where: { userId: first.id, method: "verified_google_subject" } }), 1);
});

test("Google expiry never switches to a different String ID account; choosing String ID clears only Bingo cookies", async () => {
  const cookie = `bingo_auth_provider=google; string_session=${a}`;
  assert.equal((await fetch(base + "/api/auth/me", { headers: { cookie } })).status, 401);
  const rejected = await fetch(base + "/api/auth/google/clear", {
    method: "POST", headers: { ...headers(), origin: "https://evil.example", cookie },
  });
  assert.equal(rejected.status, 403); assert.equal(rejected.headers.getSetCookie().length, 0);
  const cleared = await fetch(base + "/api/auth/google/clear", { method: "POST", headers: { ...headers(), cookie } });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.headers.getSetCookie().length, 2);
  assert.ok(cleared.headers.getSetCookie().every(c => /^bingo_(google_session|auth_provider)=;/.test(c)));
  const original = await fetch(base + "/api/auth/me", { headers: headers() });
  assert.equal((await original.json() as any).provider, "string");
});
