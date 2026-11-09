import { Request, Response, NextFunction, CookieOptions } from "express";
import { OAuth2Client } from "google-auth-library";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import prisma from "../lib/prisma";
export interface AuthenticatedRequest<Params = Request["params"]> extends Request<Params> {
  user?: {
    id: string;
    stringMemberId: string | null;
    provider: "string" | "google";
    email: string | null;
    name: string;
    picture: string | null;
    isAdmin: boolean;
  };
}
const ID_ORIGIN = "https://id.string.sg";
export class AuthFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export const GOOGLE_SESSION_COOKIE = "bingo_google_session";
export const GOOGLE_PROVIDER_COOKIE = "bingo_auth_provider";
const googleClient = new OAuth2Client();
export function googleCookieOptions(): CookieOptions {
  return {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production" || ["production", "preview"].includes(process.env.VERCEL_ENV || ""),
  };
}
export function googleSessionToken(req: Request): string | null | undefined {
  const values = (req.headers.cookie || "").split(";").map(p => p.trim())
    .filter(p => p.startsWith(`${GOOGLE_SESSION_COOKIE}=`));
  if (!values.length) {
    // Retain the chosen provider after token expiry; never silently switch accounts.
    return (req.headers.cookie || "").split(";").some(p => p.trim() === `${GOOGLE_PROVIDER_COOKIE}=google`) ? null : undefined;
  }
  return values.length === 1 ? values[0].slice(GOOGLE_SESSION_COOKIE.length + 1) : null;
}
function isBingoAdmin(memberId: string | null) {
  return !!memberId && (process.env.BINGO_ADMIN_MEMBER_IDS || "").split(",").map(s => s.trim()).includes(memberId);
}
function googleUser(user: User) {
  return {
    id: user.id, stringMemberId: user.stringMemberId, provider: "google" as const,
    email: user.email, name: user.name, picture: user.picture, isAdmin: isBingoAdmin(user.stringMemberId),
  };
}
export function googleSessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
async function resolveGoogleSession(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new AuthFailure(401, "Sign in with String ID or Google");
  const session = await prisma.bingoHostSession.findUnique({
    where: { tokenHash: googleSessionHash(token) }, include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now())
    throw new AuthFailure(401, "Your Bingo session expired. Sign in with String ID or Google.");
  return googleUser(session.user);
}
export async function createGoogleSession(credential: unknown) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new AuthFailure(503, "Google sign-in is not configured");
  if (typeof credential !== "string" || credential.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential))
    throw new AuthFailure(401, "Google sign-in could not be verified. Please try again.");
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience });
    payload = ticket.getPayload();
  } catch {
    throw new AuthFailure(401, "Google sign-in could not be verified. Please try again.");
  }
  if (!payload || typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255 ||
      payload.email_verified !== true || typeof payload.email !== "string" || !payload.email.trim() || payload.email.length > 320 ||
      typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000))
    throw new AuthFailure(401, "Google sign-in could not be verified. Please try again.");
  const name = typeof payload.name === "string" ? payload.name.slice(0, 200) : "Google host";
  const picture = typeof payload.picture === "string" && /^https:\/\//.test(payload.picture) ? payload.picture : null;
  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) {
    try {
      user = await prisma.user.create({ data: {
        googleId: payload.sub, email: payload.email.trim().toLowerCase(), name, picture,
      } });
    } catch (cause) {
      if ((cause as { code?: string })?.code !== "P2002") throw cause;
      user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
      if (!user) throw new AuthFailure(409, "This email belongs to another account. Please request an ownership review.");
    }
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = Math.min(payload.exp, Math.floor(Date.now() / 1000) + 3600);
  await prisma.bingoHostSession.create({ data: {
    tokenHash: googleSessionHash(token), userId: user.id, expiresAt: new Date(expiresAt * 1000),
  } });
  await prisma.$executeRaw`DELETE FROM bingo_host_sessions WHERE token_hash IN (
    SELECT token_hash FROM bingo_host_sessions WHERE expires_at <= clock_timestamp() LIMIT 100
  )`;
  return { user: googleUser(user), token, expiresAt };
}
export function trustedOrigin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.BINGO_APP_ORIGIN || "https://bingo.string.sg";
  if (req.get("origin") !== expected)
    return res.status(403).json({ error: "Untrusted origin" });
  next();
}
export function sessionCookie(req: Request): string | null {
  const values = (req.headers.cookie || "")
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("string_session="));
  if (values.length !== 1) return null;
  const token = values[0].slice("string_session=".length);
  return /^[a-f0-9]{64}$/.test(token) ? `string_session=${token}` : null;
}
export async function resolveMember(req: Request) {
  const cookie = sessionCookie(req);
  if (!cookie) throw new AuthFailure(401, "Sign in with String ID");
  let response: globalThis.Response;
  try {
    response = await fetch(`${ID_ORIGIN}/api/me`, {
      headers: { cookie },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
  } catch {
    throw new AuthFailure(503, "String ID is temporarily unavailable");
  }
  if (response.status === 401)
    throw new AuthFailure(401, "Sign in with String ID");
  if (!response.ok)
    throw new AuthFailure(503, "String ID is temporarily unavailable");
  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new AuthFailure(503, "Invalid identity response");
  }
  const member = body.member;
  if (
    !member ||
    typeof member.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      member.id,
    ) ||
    (member.email != null &&
      (typeof member.email !== "string" || member.email.length > 320)) ||
    (member.googleAccountId != null &&
      (typeof member.googleAccountId !== "string" ||
        !member.googleAccountId ||
        member.googleAccountId.length > 255))
  )
    throw new AuthFailure(503, "Invalid identity response");
  const id = member.id,
    email =
      typeof member.email === "string"
        ? member.email.trim().toLowerCase()
        : null;
  const subject =
    typeof member.googleAccountId === "string" ? member.googleAccountId : null;
  const name =
    typeof member.name === "string"
      ? member.name.slice(0, 200)
      : "String member";
  const picture =
    typeof member.avatarUrl === "string" && /^https:\/\//.test(member.avatarUrl)
      ? member.avatarUrl
      : null;
  let user = await prisma.user.findUnique({ where: { stringMemberId: id } });
  if (!user) {
    try {
      user = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { stringMemberId: id },
        });
        if (existing) return existing;
        const legacy = subject
          ? await tx.user.findUnique({ where: { googleId: subject } })
          : null;
        if (legacy) {
          if (legacy.stringMemberId && legacy.stringMemberId !== id)
            throw new AuthFailure(409, "Identity is already linked");
          const linked = await tx.user.updateMany({
            where: { id: legacy.id, stringMemberId: null },
            data: { stringMemberId: id, name, picture },
          });
          if (!linked.count)
            throw new AuthFailure(409, "Identity link changed; please retry");
          await tx.identityLinkAudit.create({
            data: {
              userId: legacy.id,
              stringMemberId: id,
              method: "verified_google_subject",
            },
          });
          return (await tx.user.findUnique({ where: { id: legacy.id } }))!;
        }
        if (email && (await tx.user.findUnique({ where: { email } })))
          throw new AuthFailure(
            409,
            "Connect your original Google account in String ID or ask for an ownership review",
          );
        const created = await tx.user.create({
          data: { stringMemberId: id, email, name, picture, googleId: subject },
        });
        await tx.identityLinkAudit.create({
          data: {
            userId: created.id,
            stringMemberId: id,
            method: "new_string_member",
          },
        });
        return created;
      });
    } catch (cause) {
      if (cause instanceof AuthFailure) throw cause;
      // A concurrent first request may already have created this exact identity.
      user = await prisma.user.findUnique({ where: { stringMemberId: id } });
      if (!user)
        throw new AuthFailure(
          409,
          "Identity could not be linked; please retry or request an ownership review",
        );
    }
  }
  return {
    id: user.id,
    stringMemberId: id,
    provider: "string" as const,
    email: user.email,
    name,
    picture,
    isAdmin: isBingoAdmin(id),
  };
}
export async function authenticateHost(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res.set("Cache-Control", "no-store");
    const googleToken = googleSessionToken(req);
    // An explicitly chosen fallback keeps its identity until Bingo sign-out/expiry.
    req.user = googleToken !== undefined ? await resolveGoogleSession(googleToken) : await resolveMember(req);
    next();
  } catch (cause) {
    res
      .status(cause instanceof AuthFailure ? cause.status : 503)
      .json({
        error:
          cause instanceof AuthFailure
            ? cause.message
            : "Account service is temporarily unavailable",
      });
  }
}
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!sessionCookie(req) && googleSessionToken(req) === undefined) return next();
  return authenticateHost(req, res, next);
}
