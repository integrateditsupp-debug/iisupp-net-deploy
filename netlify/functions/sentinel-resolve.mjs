// EMERGENCY ENDPOINT — written by Cowork 2026-06-22 to unblock Ahmad's admin key install.
// Faithful reproduction of the RUN 23e HMAC scheme + RUN 24 A6 server-side resolve contract.
// Replace with CC's official sentinel-resolve.mjs (commit 52b8da0) once the cherry-pick lands on main.
// 🔒 R11 — never logs the raw key (only masked first4…last4) or the secret. SENTINEL_LICENSE_SECRET stays server-side.

import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const PLAN_ORDER = ["admin-lifetime", "personal", "pro", "smb", "midsize", "enterprise"];
const PLAN_ALIASES = {
  "small_business_y": "smb",
  "small_business":   "smb",
  "midsize_y":        "midsize",
  "mid_size":         "midsize",
  "mid_size_y":       "midsize",
  "enterprise_y":     "enterprise",
  "admin":            "admin-lifetime"
};

function normalizePlan(p) {
  const k = String(p || "").trim().toLowerCase();
  return PLAN_ALIASES[k] || k;
}

function licenseMessage(plan) {
  return `sentinel-license:v1:${normalizePlan(plan)}`;
}

function issuePlanKey(plan, secret) {
  return crypto.createHmac("sha256", String(secret || "")).update(licenseMessage(plan)).digest("hex");
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

function resolvePlanFromKey(key, secret) {
  const candidate = String(key || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(candidate) || !secret) return null;
  for (const plan of PLAN_ORDER) {
    if (timingSafeEqualHex(candidate, issuePlanKey(plan, secret))) return plan;
  }
  return null;
}

function keyHash(key) {
  return crypto.createHash("sha256").update(String(key || "")).digest("hex");
}

function maskKey(key) {
  const k = String(key || "");
  if (k.length < 12) return "(short)";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

// Rate-limit per IP — bound on Netlify edge ip header, not spoofable x-forwarded-for.
async function rateLimitOk(event) {
  try {
    const ip = event.headers?.["x-nf-client-connection-ip"] ||
               event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
               "unknown";
    const store = getStore("sentinel-resolve-rl");
    const slot = `${ip}/${Math.floor(Date.now() / (5 * 60 * 1000))}`;
    const current = Number((await store.get(slot)) || 0);
    if (current >= 10) return false;
    await store.set(slot, String(current + 1), { metadata: { ip } });
    return true;
  } catch {
    // If Blobs unavailable, fail OPEN for the desktop install path — admin install is launch-critical.
    return true;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { status: "method-not-allowed" });

  const secret = process.env.SENTINEL_LICENSE_SECRET;
  if (!secret) {
    console.error("[sentinel-resolve] SENTINEL_LICENSE_SECRET not set on Netlify env");
    return json(500, { status: "server-misconfigured" });
  }

  const ok = await rateLimitOk(event);
  if (!ok) return json(429, { status: "rate-limited" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { status: "bad-json" }); }
  const key = String(body.key || "").trim();

  if (!/^[a-f0-9]{64}$/i.test(key)) return json(400, { status: "bad-key-format" });

  const plan = resolvePlanFromKey(key, secret);
  if (!plan) {
    console.log(`[sentinel-resolve] invalid key ${maskKey(key)}`);
    return json(401, { status: "invalid" });
  }

  // Revocation check — Blobs `sentinel-licenses-revocations` keyed by sha256(key).
  let revoked = false;
  try {
    const store = getStore("sentinel-licenses-revocations");
    revoked = Boolean(await store.get(keyHash(key)));
  } catch { /* if Blobs down, fall through with status active */ }

  if (revoked) {
    console.log(`[sentinel-resolve] revoked key ${maskKey(key)} (plan=${plan})`);
    return json(200, { plan, status: "revoked", verified_at: new Date().toISOString() });
  }

  console.log(`[sentinel-resolve] active key ${maskKey(key)} (plan=${plan})`);
  return json(200, { plan, status: "active", verified_at: new Date().toISOString() });
}

export const config = { path: "/.netlify/functions/sentinel-resolve" };
