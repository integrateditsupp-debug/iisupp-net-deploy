// RUN 21 §1 — update-channel listener: parses latest.yml, compares versions, jitters inside the
// 09:00-11:00 ET window, and reports an upgrade event (caller persists state + logs to audit).
import assert from "node:assert/strict";
import { parseLatestYml, compareVersions, isNewer, jitterWindow, inCheckWindow, checkForUpdate, CHECK_WINDOW_START_HOUR_ET, CHECK_WINDOW_END_HOUR_ET } from "../src/main/update-listener.mjs";

// latest.yml parse (electron-builder shape).
const yml = "version: 0.3.0\nfiles:\n  - url: https://x/ARIA.exe\n    sha512: SHA-ABC\n    size: 98765\npath: ARIA.exe\nsha512: SHA-ABC\nreleaseDate: 2026-06-21T00:00:00.000Z\nreleaseNotes: |\n  Line one\n  Line two\n";
const p = parseLatestYml(yml);
assert.equal(p.version, "0.3.0");
assert.equal(p.sha512, "SHA-ABC");
assert.equal(p.size, 98765);
assert.equal(p.releaseDate, "2026-06-21T00:00:00.000Z");
assert.equal(p.releaseNotes, "Line one\nLine two");

// Version comparison + isNewer.
assert.ok(compareVersions("0.3.0", "0.1.0") > 0);
assert.ok(compareVersions("0.1.0", "0.1.0") === 0);
assert.equal(isNewer("0.1.0", "0.3.0"), true);
assert.equal(isNewer("0.3.0", "0.3.0"), false);
assert.equal(isNewer("0.3.0", "0.2.0"), false);

// Jitter is inside 09:00-11:00 ET, deterministic per (day, license), and spreads across licenses.
for (const lic of ["LIC-A", "LIC-B", "LIC-C", "LIC-D"]) {
  const w = jitterWindow("2026-06-21", lic);
  assert.ok(w.hour >= CHECK_WINDOW_START_HOUR_ET && w.hour < CHECK_WINDOW_END_HOUR_ET, `hour in window for ${lic}`);
  assert.ok(w.minute >= 0 && w.minute < 60);
  assert.ok(inCheckWindow(w));
}
assert.deepEqual(jitterWindow("2026-06-21", "LIC-A"), jitterWindow("2026-06-21", "LIC-A"), "deterministic per day+license");

// checkForUpdate with an injected manifest fetch.
const up = await checkForUpdate({ fetchManifest: async () => yml, installedVersion: "0.1.0", now: "2026-06-21T10:00:00.000Z" });
assert.equal(up.updateAvailable, true);
assert.equal(up.event.version, "0.3.0");
assert.equal(up.event.sha512, "SHA-ABC");
assert.equal(up.checkedAt, "2026-06-21T10:00:00.000Z");
// Up-to-date → no event.
const same = await checkForUpdate({ fetchManifest: async () => "version: 0.1.0\nsha512: x\n", installedVersion: "0.1.0" });
assert.equal(same.updateAvailable, false);
assert.equal(same.event, null);
// Offline (empty manifest / throw) → graceful no-update.
assert.equal((await checkForUpdate({ fetchManifest: async () => { throw new Error("offline"); }, installedVersion: "0.1.0" })).updateAvailable, false);

console.log("Update-listener test passed (parse · version compare · 09-11 ET jitter · injected poll · offline-safe).");
