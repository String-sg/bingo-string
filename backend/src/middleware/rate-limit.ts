import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import {
  rateLimit,
  ipKeyGenerator,
  type Store,
  type Options,
} from "express-rate-limit";
import prisma from "../lib/prisma";

// Atomic shared counters: serverless restarts and multiple instances do not reset limits.
// Only a hash of the subnet/IP key is persisted, never a session token or raw IP.
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60000;
  constructor(readonly prefix: string) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private key(key: string) {
    return createHash("sha256").update(`${this.prefix}:${key}`).digest("hex");
  }
  async increment(key: string) {
    try {
      const rows = await prisma.$queryRaw<{ hits: number; reset_at: Date }[]>`
        INSERT INTO rate_limit_buckets (key, hits, reset_at)
        VALUES (${this.key(key)}, 1, clock_timestamp() + ${this.windowMs} * interval '1 millisecond')
        ON CONFLICT (key) DO UPDATE SET
          hits = CASE WHEN rate_limit_buckets.reset_at <= clock_timestamp() THEN 1 ELSE rate_limit_buckets.hits + 1 END,
          reset_at = CASE WHEN rate_limit_buckets.reset_at <= clock_timestamp()
            THEN clock_timestamp() + ${this.windowMs} * interval '1 millisecond' ELSE rate_limit_buckets.reset_at END
        RETURNING hits, reset_at
      `;
      // Bounded opportunistic cleanup, with an index on reset_at.
      await prisma.$executeRaw`DELETE FROM rate_limit_buckets WHERE key IN (
        SELECT key FROM rate_limit_buckets WHERE reset_at < clock_timestamp() - interval '1 day' LIMIT 100
      )`;
      return { totalHits: rows[0].hits, resetTime: rows[0].reset_at };
    } catch {
      throw Object.assign(new Error("Request limit service unavailable"), {
        status: 503,
      });
    }
  }
  async decrement(key: string) {
    await prisma.rateLimitBucket.updateMany({
      where: { key: this.key(key), hits: { gt: 0 } },
      data: { hits: { decrement: 1 } },
    });
  }
  async resetKey(key: string) {
    await prisma.rateLimitBucket.deleteMany({ where: { key: this.key(key) } });
  }
}
function clientKey(req: Request) {
  // Vercel overwrites this header. Other hosts must not trust caller-supplied forwarding headers.
  const deployed = ["production", "preview"].includes(
    process.env.VERCEL_ENV || "",
  );
  const forwarded = deployed
    ? req.get("x-vercel-forwarded-for")?.split(",")[0].trim()
    : undefined;
  const address =
    forwarded && isIP(forwarded)
      ? forwarded
      : req.socket.remoteAddress || "unknown";
  return ipKeyGenerator(address, 56);
}
const options = {
  windowMs: 60000,
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  keyGenerator: clientKey,
  passOnStoreError: false,
  message: { error: "Too many host requests. Please wait a minute and retry." },
};
export const identityLimiter = rateLimit({
  ...options,
  limit: 300,
  store: new PostgresRateLimitStore("identity"),
});
export const hostLimiter = rateLimit({
  ...options,
  limit: 300,
  store: new PostgresRateLimitStore("host"),
});
export const createGameLimiter = rateLimit({
  ...options,
  limit: 30,
  store: new PostgresRateLimitStore("create"),
});
