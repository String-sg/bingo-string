import express from "express";
import prisma from "../lib/prisma";
import { identityLimiter } from "../middleware/rate-limit";
import {
  authenticateHost,
  AuthenticatedRequest,
  trustedOrigin,
  sessionCookie,
  createGoogleSession, googleSessionToken, googleSessionHash, googleCookieOptions, GOOGLE_SESSION_COOKIE, GOOGLE_PROVIDER_COOKIE, AuthFailure,
} from "../middleware/auth";
const router = express.Router();
router.get("/me", identityLimiter, authenticateHost, (req: AuthenticatedRequest, res) =>
  res.set("Cache-Control", "no-store").json(req.user),
);
router.post("/google", identityLimiter, trustedOrigin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { user, token, expiresAt } = await createGoogleSession(req.body?.credential);
    const maxAge = Math.min(3600, expiresAt - Math.floor(Date.now() / 1000)) * 1000;
    res.cookie(GOOGLE_SESSION_COOKIE, token, { ...googleCookieOptions(), maxAge });
    res.cookie(GOOGLE_PROVIDER_COOKIE, "google", googleCookieOptions());
    res.json(user);
  } catch (cause) {
    res.status(cause instanceof AuthFailure ? cause.status : 503).json({
      error: cause instanceof AuthFailure ? cause.message : "Account service is temporarily unavailable",
    });
  }
});
// Clearing only Bingo's fallback cookies must work even while its database is down.
router.post("/google/clear", trustedOrigin, (_req, res) => {
  res.clearCookie(GOOGLE_SESSION_COOKIE, googleCookieOptions());
  res.clearCookie(GOOGLE_PROVIDER_COOKIE, googleCookieOptions());
  res.set("Cache-Control", "no-store").json({ ok: true });
});
router.post("/logout", identityLimiter, trustedOrigin, async (req, res) => {
  const googleToken = googleSessionToken(req);
  if (googleToken !== undefined) {
    try {
      if (googleToken) await prisma.bingoHostSession.deleteMany({ where: { tokenHash: googleSessionHash(googleToken) } });
      res.clearCookie(GOOGLE_SESSION_COOKIE, googleCookieOptions());
      res.clearCookie(GOOGLE_PROVIDER_COOKIE, googleCookieOptions());
      return res.set("Cache-Control", "no-store").json({ ok: true });
    } catch {
      return res.status(503).json({ error: "Could not sign out of Bingo. Please retry." });
    }
  }
  const cookie = sessionCookie(req);
  if (!cookie) return res.status(401).json({ error: "No active session" });
  try {
    const upstream = await fetch("https://id.string.sg/api/logout", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: { cookie, origin: "https://id.string.sg" },
    });
    if (!upstream.ok)
      return res
        .status(503)
        .json({ error: "Could not sign out of String ID. Please retry." });
    const clear = upstream.headers
      .getSetCookie()
      .filter((c) => c.startsWith("string_session=;"));
    if (!clear.length)
      return res
        .status(503)
        .json({ error: "String ID did not confirm sign-out" });
    res.setHeader("Set-Cookie", clear);
    res.set("Cache-Control", "no-store").json({ ok: true });
  } catch {
    res
      .status(503)
      .json({ error: "Could not sign out of String ID. Please retry." });
  }
});
module.exports = router;
