// update-manifest — pure logic behind the self-hosted update server. Decides which version a given
// license should receive (honoring a manual rollback pin), and renders the electron-updater latest.yml.
// No I/O; the Netlify function feeds it the versions list + the license record.
import { compareVersions } from "./whats-new.mjs";

/**
 * Choose the version to serve a license.
 * @param {object} args { versions:[{version,disabled,...}], license:{version_pin?} }
 * @returns {object|null} the chosen version record
 */
export function pickVersionForLicense({ versions = [], license = {} } = {}) {
  const list = Array.isArray(versions) ? versions.filter((v) => v && v.version) : [];
  if (!list.length) return null;
  // Manual rollback: a pinned version is served exactly (if it still exists), even if newer ones do.
  if (license && license.version_pin) {
    const pinned = list.find((v) => v.version === license.version_pin);
    if (pinned) return pinned;
  }
  // Otherwise the latest NON-disabled version.
  return list
    .filter((v) => !v.disabled)
    .sort((a, b) => compareVersions(b.version, a.version))[0] || null;
}

// Render an electron-updater "generic" latest.yml for a chosen version record.
export function buildLatestYml(v) {
  if (!v || !v.version) return "";
  const file = v.path || `ARIA-Sentinel-${v.version}-unsigned.exe`;
  const lines = [
    `version: ${v.version}`,
    "files:",
    `  - url: https://iisupp.net/sentinel-binaries/${file}`,
    `    sha512: ${v.sha512 || ""}`,
    `    size: ${Number(v.size) || 0}`,
    `path: ${file}`,
    `sha512: ${v.sha512 || ""}`,
    `releaseDate: ${v.release_date || ""}`
  ];
  if (v.release_notes) {
    lines.push("releaseNotes: |");
    for (const ln of String(v.release_notes).split(/\r?\n/)) lines.push(`  ${ln}`);
  }
  return lines.join("\n") + "\n";
}

// Staged rollout: is a license inside the current rollout percentage? Deterministic by license key
// (stable hash → bucket 0-99), so the same licenses get the new version as the % ramps.
export function inRollout(licenseKey, percent) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  let h = 0x811c9dc5;
  const s = String(licenseKey || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 100 < pct;
}
