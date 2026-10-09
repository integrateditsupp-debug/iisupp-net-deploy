// admin-auth — pure admin-token gate for the publish / rollback / search endpoints. The token comes
// ONLY from the env (never hardcoded); a missing or mismatched header → 401.
// RUN-CU / CU4 (2026-10-08) — SENTINEL_ADMIN_TOKEN is accepted as an alias of ARIA_ADMIN_TOKEN (audit P1 #10:
// the four project-local functions read ARIA_ADMIN_TOKEN while CLAUDE.md, axis/, publish-manifest, ota-build
// and sentinel-licenses use SENTINEL_ADMIN_TOKEN — whichever was unset yielded a 401). Either name works;
// when BOTH are set, a presented token matching either is accepted (constant-time, per candidate). The return
// shape is UNCHANGED ({ ok, status, reason } — tests/admin-publish.test.mjs pins it); `adminTokenMatch` names
// which env var matched for callers that want to log it.
import crypto from "node:crypto";

export const ADMIN_TOKEN_ENV_NAMES = Object.freeze(["ARIA_ADMIN_TOKEN", "SENTINEL_ADMIN_TOKEN"]);

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
  const configured = ADMIN_TOKEN_ENV_NAMES.map((name) => ({ name, value: env[name] })).filter((c) => typeof c.value === "string" && c.value.length > 0);
  if (!configured.length) return { ok: false, status: 401, reason: "admin-token-not-configured" };
  const provided = headers["x-admin-token"] || headers["X-Admin-Token"] || "";
  if (!provided) return { ok: false, status: 401, reason: "missing-admin-token" };
  const match = configured.find((c) => timingEqual(provided, c.value));
  if (!match) return { ok: false, status: 401, reason: "bad-admin-token" };
  return { ok: true, status: 200, reason: "ok" };
}

/** Which configured env var the presented token matched ("ARIA_ADMIN_TOKEN" | "SENTINEL_ADMIN_TOKEN"), or null. */
export function adminTokenMatch(headers = {}, env = {}) {
  const provided = headers["x-admin-token"] || headers["X-Admin-Token"] || "";
  if (!provided) return null;
  for (const name of ADMIN_TOKEN_ENV_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.length > 0 && timingEqual(provided, value)) return name;
  }
  return null;
}
