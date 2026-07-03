// RUN 21 §1 — update-channel listener. Polls the self-hosted manifest on launch / daily (jittered
// 09:00-11:00 ET) / wake / on-demand, parses latest.yml, and reports whether a newer build exists.
// Pure + node-safe: the actual fetch + timers live in main; this module decides + parses.

export const CHECK_WINDOW_START_HOUR_ET = 9;  // 09:00 ET
export const CHECK_WINDOW_END_HOUR_ET = 11;   // 11:00 ET

/** Tiny YAML reader for electron-builder's latest.yml (version / sha512 / size / releaseDate / notes). */
export function parseLatestYml(text) {
  const out = { version: null, sha512: null, size: 0, releaseDate: null, releaseNotes: "", path: null };
  const lines = String(text || "").split(/\r?\n/);
  let inNotes = false;
  const notes = [];
  for (const line of lines) {
    if (inNotes) {
      if (/^\s+/.test(line)) { notes.push(line.replace(/^\s{2}/, "")); continue; }
      inNotes = false;
    }
    let m;
    if ((m = line.match(/^version:\s*(.+)$/))) out.version = m[1].trim();
    else if ((m = line.match(/^path:\s*(.+)$/))) out.path = m[1].trim();
    else if ((m = line.match(/^sha512:\s*(.+)$/)) && !out.sha512) out.sha512 = m[1].trim();
    else if ((m = line.match(/^\s+sha512:\s*(.+)$/)) && !out.sha512) out.sha512 = m[1].trim();
    else if ((m = line.match(/^\s+size:\s*(\d+)/))) out.size = Number(m[1]);
    else if ((m = line.match(/^releaseDate:\s*(.+)$/))) out.releaseDate = m[1].trim();
    else if (/^releaseNotes:\s*\|/.test(line)) { inNotes = true; }
  }
  out.releaseNotes = notes.join("\n").trim();
  return out;
}

/** Compare dotted versions; >0 if a>b, <0 if a<b, 0 equal. Non-numeric segments compared as strings. */
export function compareVersions(a, b) {
  const pa = String(a || "0").split(".");
  const pb = String(b || "0").split(".");
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const na = Number(pa[i] || 0), nb = Number(pb[i] || 0);
    if (Number.isFinite(na) && Number.isFinite(nb)) { if (na !== nb) return na - nb; }
    else { const c = String(pa[i] || "").localeCompare(String(pb[i] || "")); if (c) return c; }
  }
  return 0;
}

export function isNewer(installed, candidate) {
  return Boolean(candidate) && compareVersions(candidate, installed) > 0;
}

/**
 * Deterministic daily check time inside the 09:00-11:00 ET window. Jitter is seeded by the day +
 * licenseId so the fleet spreads load but each device is stable within a day.
 * @returns {{ hour:number, minute:number }} in ET
 */
export function jitterWindow(dayKey, licenseId = "") {
  let seed = 0;
  for (const ch of `${dayKey}:${licenseId}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const span = (CHECK_WINDOW_END_HOUR_ET - CHECK_WINDOW_START_HOUR_ET) * 60; // minutes in window
  const offset = seed % span;
  return { hour: CHECK_WINDOW_START_HOUR_ET + Math.floor(offset / 60), minute: offset % 60 };
}

/** Is the chosen jittered time within the 09:00-11:00 ET window? (used by the test) */
export function inCheckWindow({ hour }) {
  return hour >= CHECK_WINDOW_START_HOUR_ET && hour < CHECK_WINDOW_END_HOUR_ET;
}

/**
 * Decide the result of a poll. `fetchManifest()` returns the latest.yml text (or "" when offline/204).
 * Returns the parsed event + whether it's an upgrade. Caller persists update-state + logs to audit.
 */
export async function checkForUpdate({ fetchManifest, installedVersion, now = new Date().toISOString(), channel = "stable" }) {
  let text = "";
  try { text = (await fetchManifest()) || ""; } catch { text = ""; }
  const parsed = text ? parseLatestYml(text) : null;
  const updateAvailable = Boolean(parsed && isNewer(installedVersion, parsed.version));
  const event = updateAvailable ? {
    version: parsed.version, releaseNotes: parsed.releaseNotes, size: parsed.size,
    sha512: parsed.sha512, channel, publishedAt: parsed.releaseDate
  } : null;
  // D3 — `manifest` tells the caller whether an update feed was actually reachable, so the UI can say the
  // HONEST thing: a reachable feed with no newer build → "up to date"; NO feed → "manual updates for now"
  // (never a false "you're on the latest version" when we simply couldn't check).
  return { ok: true, checkedAt: now, updateAvailable, event, current: installedVersion, manifest: Boolean(parsed) };
}
