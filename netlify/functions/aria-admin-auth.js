// Netlify function: admin login for the Sentinel admin console (§5 runtime gate). Validates against
// ARIA_ADMIN_USERNAME + ARIA_ADMIN_PASSWORD_HASH (bcrypt) env vars — NEVER hardcoded. On success
// returns an HMAC-signed 24h session the desktop stores. PROJECT-LOCAL until Ahmad ships.
import crypto from "node:crypto";
import { signAdminSession, ADMIN_SESSION_MS } from "../../src/shared/admin-gate.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

// bcrypt verify if the lib is present; otherwise refuse (never accept without a real hash check).
async function verifyPassword(password, hash) {
  if (!hash) return false;
  try {
    const bcrypt = await import("bcryptjs");
    return await bcrypt.compare(String(password || ""), String(hash));
  } catch {
    return false; // no bcrypt available → deny (do not fall back to plaintext)
  }
}

export async function handler(event) {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  const user = process.env.ARIA_ADMIN_USERNAME;
  const hash = process.env.ARIA_ADMIN_PASSWORD_HASH;
  const secret = process.env.ARIA_ADMIN_SESSION_SECRET || "";
  if (!user || !hash || !secret) return json(500, { error: "admin-auth-not-configured" });
  // Length-safe constant-time compare (timingSafeEqual THROWS on a length mismatch → uncaught 500 + a
  // username-length oracle; audit 2026-10-08 §2.1). bcryptjs is now a declared dependency so verifyPassword
  // can actually run (it silently returned false before → every login 401).
  const ub = Buffer.from(String(body.username || "")), eb = Buffer.from(String(user));
  const userOk = ub.length === eb.length && ub.length > 0 && crypto.timingSafeEqual(ub, eb);
  const passOk = await verifyPassword(body.password, hash);
  if (!userOk || !passOk) return json(401, { error: "invalid-credentials" });
  const expiresAt = Date.now() + ADMIN_SESSION_MS;
  return json(200, { ok: true, session: signAdminSession(user, expiresAt, secret) });
}

export const config = { path: "/.netlify/functions/aria-admin-auth" };
