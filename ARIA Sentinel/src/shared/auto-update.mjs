// auto-update — parse a GitHub-Releases-style update manifest and decide whether a newer build is
// available. Pure; reuses the version comparator. The desktop "Check for updates" button and the
// /aria-binary-update endpoint both call this.
import { compareVersions } from "./whats-new.mjs";

/**
 * Parse a releases listing (array of {tag_name|version, assets:[{name,browser_download_url}]} or a
 * single object) into { version, downloadUrl } for the latest Windows .exe. Returns null if none.
 */
export function parseUpdateManifest(raw) {
  const releases = Array.isArray(raw) ? raw : raw ? [raw] : [];
  let best = null;
  for (const r of releases) {
    if (!r || r.draft) continue;
    const version = String(r.version || r.tag_name || "").replace(/^v/i, "");
    if (!/^\d+\.\d+/.test(version)) continue;
    const asset = (r.assets || []).find((a) => /\.exe$/i.test(String(a.name || "")));
    const downloadUrl = asset ? asset.browser_download_url : r.html_url || null;
    if (!best || compareVersions(version, best.version) > 0) best = { version, downloadUrl };
  }
  return best;
}

/** Is `latest` newer than `current`? */
export function updateAvailable(currentVersion, latest) {
  if (!latest || !latest.version) return false;
  return compareVersions(String(currentVersion || "0"), latest.version) < 0;
}

// ===== RUN 14 — self-hosted update feed + install history + rollback =====
export const UPDATE_MANIFEST_PATH = "/.netlify/functions/aria-sentinel-update-manifest";

// electron-updater "generic" feed URL, scoped to the license so the server can pin/rollout per device.
export function buildFeedUrl(licenseKey, base = "https://iisupp.net") {
  const key = encodeURIComponent(String(licenseKey || ""));
  return `${base}${UPDATE_MANIFEST_PATH}?license=${key}`;
}

// Append an installed version to the update history (newest first, deduped by version). Pure.
export function recordInstall(history, entry, now) {
  const list = Array.isArray(history) ? history.filter((h) => h && h.version !== entry.version) : [];
  return [{ version: entry.version, installed: entry.installed || now || "", released: entry.released || "", notes: entry.notes || "" }, ...list];
}

// The set of older versions a device may roll back to (everything in history below the current one).
export function rollbackTargets(history, currentVersion) {
  return (Array.isArray(history) ? history : [])
    .filter((h) => h && compareVersions(h.version, currentVersion) < 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}
