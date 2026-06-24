// Netlify function: self-hosted electron-updater feed. GET ?license=&version=&platform=&arch=
// Returns latest.yml for the license (honors version_pin rollback + staged rollout + disabled).
// PROJECT-LOCAL until Ahmad reviews + ships. Reads versions + license from Netlify Blobs.
import { getStore } from "@netlify/blobs";
import { pickVersionForLicense, buildLatestYml, inRollout } from "../../src/shared/update-manifest.mjs";

export async function handler(event) {
  const q = (event && event.queryStringParameters) || {};
  const license = String(q.license || "");
  let versions = [];
  let licenseRec = {};
  try {
    const versionsStore = getStore("versions");
    const licenses = getStore("licenses");
    versions = (await versionsStore.get("index", { type: "json" })) || [];
    licenseRec = (license && (await licenses.get(license, { type: "json" }))) || {};
  } catch {
    versions = [];
  }
  // Staged rollout: only serve the very latest if this license is inside the active rollout %.
  const rolloutPct = Number(licenseRec.rollout_override ?? q.rollout ?? 100);
  let chosen = pickVersionForLicense({ versions, license: licenseRec });
  if (chosen && !licenseRec.version_pin && !inRollout(license, rolloutPct)) {
    // Not in this rollout wave → hold on the previous non-disabled version (no forced upgrade).
    const older = versions.filter((v) => !v.disabled && v.version !== chosen.version)
      .sort((a, b) => (a.version < b.version ? 1 : -1));
    chosen = older[0] || chosen;
  }
  if (!chosen) return { statusCode: 204, body: "" };
  return { statusCode: 200, headers: { "content-type": "text/yaml" }, body: buildLatestYml(chosen) };
}

export const config = { path: "/.netlify/functions/aria-sentinel-update-manifest" };
