import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    stringMemberId: string;
    email: string | null;
    name: string;
    picture: string | null;
    isAdmin: boolean;
  };
}
const ID_ORIGIN = "https://id.string.sg";
class AuthFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
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
  const admins = (process.env.BINGO_ADMIN_MEMBER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: user.id,
    stringMemberId: id,
    email: user.email,
    name,
    picture,
    isAdmin: admins.includes(id),
  };
}
export async function authenticateString(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    res.set("Cache-Control", "no-store");
    req.user = await resolveMember(req);
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
  if (!sessionCookie(req)) return next();
  return authenticateString(req, res, next);
}
