// Netlify function: self-hosted electron-updater feed. GET → latest.yml for this device (honors the
// version_pin rollback + the server-side staged rollout + disabled versions). Reads versions + the device's
// license record from Netlify Blobs.
//
// SENTINEL-BACKEND 2026-10-14 (audit B1 / B13 / B20):
//   - the device identifies itself with the header `x-sentinel-key` = sha256(licenseKey) — the same credential
//     every other Sentinel endpoint uses. The legacy `?license=<raw key>` query is still accepted (Rule 15:
//     the shipped desktop's buildFeedUrl sends it) but it is hashed on arrival and NEVER logged or stored.
//     The desktop should move to the header (electron-updater `requestHeaders`) so the raw key stops
//     travelling in a GET query string that proxies and access logs keep (lane F2).
//   - the rollout percentage is the SERVER's (the `rollout` blob the admin publishes) or the record's
//     `rollout_override`; a client-supplied `?rollout=` is ignored.
//   - the manifest is rendered by the APP's update-manifest module (src/shared/update-manifest.mjs re-exports
//     it), so a published record's `url` (download.iisupp.net / a release host) is honoured instead of always
//     pointing at iisupp.net/sentinel-binaries/<file>. No version or host is hard-coded here.
//   - Blobs through lib/sentinel-store.cjs (connectLambda before getStore). No feed → 204 (unchanged).
import { pickVersionForLicense, buildLatestYml, inRollout } from "../../src/shared/update-manifest.mjs";
import { openStore, getJson } from "./lib/sentinel-store.cjs";
import { STORES } from "./lib/sentinel-license-records.cjs";
import { headerOf, sha256, HEX64 } from "./lib/sentinel-approvals.cjs";

export async function handler(event) {
  const q = (event && event.queryStringParameters) || {};
  let credential = String(headerOf(event, "x-sentinel-key") || "").trim().toLowerCase();
  if (!HEX64.test(credential)) {
    const raw = String(q.license || "").trim();
    credential = /^[a-f0-9]{64}$/i.test(raw) ? sha256(raw) : "";
  }

  let versions = [];
  let licenseRec = {};
  let serverRollout = 100;
  try {
    const versionsStore = await openStore(STORES.VERSIONS, event);
    versions = (await getJson(versionsStore, "index")) || [];
    if (!Array.isArray(versions)) versions = [];
    const rollout = await getJson(versionsStore, "rollout");
    if (rollout && Number.isFinite(Number(rollout.percent))) serverRollout = Number(rollout.percent);
    if (credential) {
      const licenses = await openStore(STORES.DEVICES, event);
      licenseRec = (await getJson(licenses, credential)) || {};
    }
  } catch {
    versions = [];
  }
  // Staged rollout: only serve the very latest if this device is inside the active rollout %. The client's
  // own `?rollout=` is never consulted (audit B13).
  const rolloutPct = Number(licenseRec.rollout_override ?? serverRollout);
  let chosen = pickVersionForLicense({ versions, license: licenseRec });
  if (chosen && !licenseRec.version_pin && !inRollout(credential || "anonymous", rolloutPct)) {
    // Not in this rollout wave → hold on the previous non-disabled version (no forced upgrade).
    const older = versions.filter((v) => v && !v.disabled && v.version !== chosen.version)
      .sort((a, b) => (a.version < b.version ? 1 : -1));
    chosen = older[0] || chosen;
  }
  if (!chosen) return { statusCode: 204, headers: { "cache-control": "no-store" }, body: "" };
  return { statusCode: 200, headers: { "content-type": "text/yaml", "cache-control": "no-store" }, body: buildLatestYml(chosen) };
}

export const config = { path: "/.netlify/functions/aria-sentinel-update-manifest" };
