// RUN 21 §6 — daily heartbeat endpoint (also the license keepalive + update advisory). POST a content-
// blind payload; returns the latest live version + mandatory flag. Logs to the "heartbeats" Blob store
// (per-license per-day key → natural ~30d retention by date prefix). PROJECT-LOCAL until Ahmad ships.
import { getStore } from "@netlify/blobs";
import { heartbeatResponse, sanitizeHeartbeatRecord, heartbeatStoreKey, latestLiveVersion } from "../../src/shared/heartbeat-server.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export async function handler(event) {
  if ((event.httpMethod || "POST") !== "POST") return json(405, { error: "method-not-allowed" });
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }

  let versions = [];
  let licenseRecord = null;
  try {
    const versionsStore = getStore("versions");
    const licenses = getStore("licenses");
    versions = (await versionsStore.get("index", { type: "json" })) || [];
    if (payload.licenseId) licenseRecord = await licenses.get(String(payload.licenseId), { type: "json" });
  } catch { versions = []; }

  // Log the (sanitized, allowlisted) heartbeat — never the raw payload.
  try {
    const beats = getStore("heartbeats");
    const now = Date.now();
    await beats.setJSON(heartbeatStoreKey(payload.licenseId, now), { ...sanitizeHeartbeatRecord(payload), receivedAt: new Date(now).toISOString() });
  } catch { /* logging is best-effort */ }

  const latest = latestLiveVersion(versions);
  return json(200, heartbeatResponse({ licenseRecord, versions, mandatory: Boolean(latest && latest.mandatory), now: Date.now() }));
}

export const config = { path: "/.netlify/functions/aria-sentinel-heartbeat" };
