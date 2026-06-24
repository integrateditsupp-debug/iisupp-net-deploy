// admin-auth — pure admin-token gate for the publish / rollback / search endpoints. The token comes
// ONLY from the ARIA_ADMIN_TOKEN env var (never hardcoded); a missing or mismatched header → 401.
import crypto from "node:crypto";

function timingEqual(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length || ba.length === 0) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

/**
 * @param {object} headers request headers (X-Admin-Token)
 * @param {object} env process.env (must hold ARIA_ADMIN_TOKEN)
 * @returns {{ok:boolean, status:number, reason:string}}
 */
export function requireAdminToken(headers = {}, env = {}) {
  const configured = env.ARIA_ADMIN_TOKEN;
  if (!configured) return { ok: false, status: 401, reason: "admin-token-not-configured" };
  const provided = headers["x-admin-token"] || headers["X-Admin-Token"] || "";
  if (!provided) return { ok: false, status: 401, reason: "missing-admin-token" };
  if (!timingEqual(provided, configured)) return { ok: false, status: 401, reason: "bad-admin-token" };
  return { ok: true, status: 200, reason: "ok" };
}
