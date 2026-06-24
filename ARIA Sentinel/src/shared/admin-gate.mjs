// admin-gate — RUN 15 §5 two-layer admin gate. Build-time: IS_ADMIN_BUILD env decides whether the
// admin surface is compiled in at all. Runtime: an HMAC-signed admin session (24h) must be valid.
// Customer builds set neither → the admin console is unreachable.
import crypto from "node:crypto";

export const ADMIN_SESSION_MS = 24 * 60 * 60 * 1000;

export function isAdminBuild(env = {}) {
  return env.IS_ADMIN_BUILD === "1" || env.IS_ADMIN_BUILD === "true";
}

export function signAdminSession(username, expiresAt, secret) {
  const payload = `${String(username || "")}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", String(secret || "")).update(payload).digest("hex");
  return { username: String(username || ""), expiresAt, sig };
}

export function validateAdminSession(session, secret, now = Date.now()) {
  if (!session || !session.username || !session.sig) return { valid: false, reason: "no-session" };
  const expected = signAdminSession(session.username, session.expiresAt, secret).sig;
  const a = Buffer.from(String(session.sig), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: "bad-signature" };
  if (now > Number(session.expiresAt)) return { valid: false, reason: "expired" };
  return { valid: true, reason: "ok", username: session.username };
}

// The full gate: admin features are available only when the build allows AND a session validates.
export function adminAvailable({ env = {}, session = null, secret = "", now = Date.now() } = {}) {
  if (!isAdminBuild(env)) return { available: false, reason: "not-admin-build" };
  const v = validateAdminSession(session, secret, now);
  return { available: v.valid, reason: v.valid ? "ok" : v.reason };
}
