import express from "express";
import { identityLimiter } from "../middleware/rate-limit";
import {
  authenticateString,
  AuthenticatedRequest,
  trustedOrigin,
  sessionCookie,
} from "../middleware/auth";
const router = express.Router();
router.get("/me", identityLimiter, authenticateString, (req: AuthenticatedRequest, res) =>
  res.set("Cache-Control", "no-store").json(req.user),
);
router.post("/logout", identityLimiter, trustedOrigin, async (req, res) => {
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
