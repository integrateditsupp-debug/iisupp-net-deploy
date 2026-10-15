// RUN 21 §6 — daily heartbeat endpoint (also the license keepalive + update advisory). POST a content-
// blind payload; returns the latest live version + mandatory flag. Logs to the "heartbeats" Blob store
// (per-license per-day key → natural ~30d retention by date prefix).
//
// SENTINEL-BACKEND 2026-10-14 (audit B1 / B10):
//   - the response is built by the APP's heartbeat-server module (src/shared/heartbeat-server.mjs now re-exports
//     it): { ok, valid, latestVersion, mandatoryUpdate, advisoryMessage, nextCheckIn, serverTime } plus the
//     stub's old `licenseActive` (Rule 15) and the fleet control plane's second channel: `killed` / `reason`
//     (ARIA Sentinel/src/shared/kill-switch.mjs parseControlPlaneKill reads exactly these) — from
//     ARIA_RECIPES_KILLED / ARIA_RECIPES_KILL_REASON, or a per-tenant `disabled` flag on the license record.
//   - a WRITE (the fleet record) requires the device credential `x-sentinel-key` = sha256(licenseKey) (same
//     model as notify / approval). The record is keyed by sha256(credential) — a one-way id, never key
//     material; the desktop's `licenseId` (first 16 chars of the raw key) is replaced by its own hash. Without
//     the header the endpoint still answers (kill directive + latest version) but stores nothing.
//   - Blobs through lib/sentinel-store.cjs (connectLambda before getStore); a down store never breaks the ping.
// The shipped desktop (main.mjs sendHeartbeat) does not yet send x-sentinel-key — add
// `"x-sentinel-key": licenseKeyHash()` to its headers and the fleet record starts flowing (lane F2/F3).
//
// SENTINEL REVIEW FIXES 2026-10-14 (P1-3, server half): the response carries `trialStartedAt` — the first time this
// server saw the X-Sentinel-Device hash (lib/sentinel-trial-anchor.cjs; written once, never overwritten, nothing
// but the timestamp stored). It works WITHOUT a license key (the local trial runs before one exists). Creating a
// NEW anchor is limited to 30 per IP per hour per warm instance (an existing anchor is always read); a store blip
// answers trialStartedAt:null — the ping itself never breaks.
import { heartbeatResponse, sanitizeHeartbeatRecord, heartbeatStoreKey, latestLiveVersion } from "../../src/shared/heartbeat-server.mjs";
import { openStore, getJson, putJson } from "./lib/sentinel-store.cjs";
import { STORES } from "./lib/sentinel-license-records.cjs";
import { authenticate, headerOf, sha256, hash16 } from "./lib/sentinel-approvals.cjs";
import { readTrialAnchor } from "./lib/sentinel-trial-anchor.cjs";
import rateLimit from "./_rate-limit.js";

const ANCHOR_CREATES_PER_IP_PER_HOUR = 30;

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

/** The global kill directive (ops flips ARIA_RECIPES_KILLED=1 without a deploy) — same source as aria-recipes. */
export function globalKillState(env = process.env) {
  const killed = env.ARIA_RECIPES_KILLED === "1";
  return { killed, reason: killed ? String(env.ARIA_RECIPES_KILL_REASON || "control plane disabled fixes").slice(0, 200) : "" };
}

export async function handler(event) {
  if ((event.httpMethod || "POST") !== "POST") return json(405, { error: "method-not-allowed" });
  if (Buffer.byteLength(String(event.body || ""), "utf8") > 16 * 1024) return json(413, { error: "body-too-large" });
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(400, { error: "bad-json" });

  // Device auth is required for the WRITE; a ping without it still gets the advisory + kill directive.
  let auth = null;
  const presented = headerOf(event, "x-sentinel-key");
  if (presented) {
    auth = await authenticate(event);
    if (!auth.ok) return json(auth.status || 401, { ok: false, error: auth.error });
    if (auth.kind !== "device") auth = null; // an admin token is not a device; nothing is recorded for it
  }

  let versions = [];
  try {
    const versionsStore = await openStore(STORES.VERSIONS, event);
    versions = (await getJson(versionsStore, "index")) || [];
    if (!Array.isArray(versions)) versions = [];
  } catch { versions = []; }

  const now = Date.now();
  const tenantId = auth ? sha256(presented) : null;
  const record = auth ? (auth.record || null) : null;
  const device = auth ? (auth.device || null) : null;

  // Log the (sanitized, allowlisted) heartbeat — never the raw payload, never key material.
  let recorded = false;
  if (auth) {
    try {
      const beats = await openStore(STORES.HEARTBEATS, event);
      const safe = sanitizeHeartbeatRecord(payload);
      safe.licenseId = payload.licenseId ? hash16(String(payload.licenseId)) : null;
      recorded = await putJson(beats, heartbeatStoreKey(tenantId, now), { ...safe, tenant: tenantId, plan: auth.plan || null, receivedAt: new Date(now).toISOString() });
    } catch { recorded = false; }
  }

  // P1-3 — server-anchored trial start for this device (keyless pings included).
  let anchor = { trialStartedAt: null, state: "no-device" };
  try {
    anchor = await readTrialAnchor(event, headerOf(event, "x-sentinel-device"), {
      now,
      mayCreate: () => rateLimit.checkRateLimit(event, { scope: "trial-anchor-create", limit: ANCHOR_CREATES_PER_IP_PER_HOUR, windowMs: 60 * 60 * 1000 }).ok
    });
  } catch { anchor = { trialStartedAt: null, state: "unavailable" }; }

  const latest = latestLiveVersion(versions);
  const base = heartbeatResponse({ licenseRecord: auth ? { licenseId: tenantId } : null, versions, mandatory: Boolean(latest && latest.mandatory), now });
  const global = globalKillState();
  const tenantDisabled = Boolean(record && record.disabled === true);
  const killed = global.killed || tenantDisabled;
  const reason = global.killed ? global.reason : (tenantDisabled ? "Customer policy disabled fixes." : "");
  return json(200, {
    ...base,
    licenseActive: base.valid,                 // the stub's field (Rule 15)
    plan: auth ? auth.plan || null : null,
    auth: auth ? "device" : "none",
    recorded,
    pinnedVersion: device && device.version_pin ? String(device.version_pin) : null,
    killed,
    reason,
    tenantDisabled,
    trialStartedAt: anchor.trialStartedAt || null,
    trialAnchor: anchor.state
  });
}

export const config = { path: "/.netlify/functions/aria-sentinel-heartbeat" };
