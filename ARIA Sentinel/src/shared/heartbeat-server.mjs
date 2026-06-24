// RUN 21 §6 — pure server-side logic for the heartbeat endpoint (kept out of the Netlify handler so it
// is testable without @netlify/blobs). Validates a license record, picks the latest live version, and
// builds the content-blind response + storage key.
import { HEARTBEAT_FIELDS } from "../main/heartbeat.mjs";

/** Latest non-disabled published version, newest first by version string. */
export function latestLiveVersion(versions = []) {
  const live = (versions || []).filter((v) => v && v.version && !v.disabled);
  live.sort((a, b) => (a.version < b.version ? 1 : a.version > b.version ? -1 : 0));
  return live[0] || null;
}

/** Coerce an inbound heartbeat to the allowlisted fields only (server never stores extras). */
export function sanitizeHeartbeatRecord(payload = {}) {
  const out = {};
  for (const k of HEARTBEAT_FIELDS) out[k] = k in payload ? payload[k] : null;
  return out;
}

/** Rolling key for the heartbeats store (per-license per-day → natural 30d retention by date prefix). */
export function heartbeatStoreKey(licenseId, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const id = String(licenseId || "unknown").replace(/[^a-z0-9-]/gi, "").slice(0, 64) || "unknown";
  return `${day}/${id}`;
}

/**
 * Build the heartbeat response.
 * @param licenseRecord the matched license blob (or null if not found)
 * @param versions the published-versions index
 * @param mandatory whether the latest version is flagged mandatory
 */
export function heartbeatResponse({ licenseRecord, versions = [], mandatory = false, now = Date.now() }) {
  const latest = latestLiveVersion(versions);
  const valid = Boolean(licenseRecord && (licenseRecord.license_key || licenseRecord.licenseId));
  return {
    ok: true,
    valid,
    latestVersion: latest ? latest.version : null,
    mandatoryUpdate: Boolean(mandatory),
    advisoryMessage: valid ? "" : "License not recognized — running in trial/grace mode.",
    nextCheckIn: 24 * 60 * 60, // seconds
    serverTime: new Date(now).toISOString()
  };
}
