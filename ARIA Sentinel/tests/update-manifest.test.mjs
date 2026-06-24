// RUN 14 — update manifest: per-license version selection, latest.yml render, staged rollout.
import assert from "node:assert/strict";
import { pickVersionForLicense, buildLatestYml, inRollout } from "../src/shared/update-manifest.mjs";

const versions = [
  { version: "0.1.0", disabled: false, sha512: "a", size: 100, release_date: "2026-06-19T18:00:00.000Z" },
  { version: "0.1.1", disabled: false, sha512: "b", size: 200, release_date: "2026-06-20T08:00:00.000Z", release_notes: "UI polish" },
  { version: "0.1.2", disabled: true, sha512: "c", size: 300, release_date: "2026-06-20T12:00:00.000Z" }
];

// Latest non-disabled (0.1.2 is disabled → 0.1.1).
assert.equal(pickVersionForLicense({ versions, license: {} }).version, "0.1.1");
// A pin is served exactly, even though a newer one exists.
assert.equal(pickVersionForLicense({ versions, license: { version_pin: "0.1.0" } }).version, "0.1.0");
// A pin to a non-existent version falls back to latest.
assert.equal(pickVersionForLicense({ versions, license: { version_pin: "9.9.9" } }).version, "0.1.1");
// Empty → null.
assert.equal(pickVersionForLicense({ versions: [], license: {} }), null);

// latest.yml render — no url field → Netlify fallback (back-compat).
const yml = buildLatestYml(versions[1]);
assert.match(yml, /version: 0\.1\.1/);
assert.match(yml, /url: https:\/\/iisupp\.net\/sentinel-binaries\/ARIA-Sentinel-0\.1\.1-unsigned\.exe/);
assert.match(yml, /sha512: b/);
assert.match(yml, /releaseNotes: \|/);

// RUN 23c — a record carrying a GitHub Releases url points the client there (binary host moves off Netlify).
const ghYml = buildLatestYml({ version: "0.1.3", sha512: "z", size: 99, url: "https://github.com/integrateditsupp-debug/iisupp-net-deploy/releases/download/sentinel-v0.1.3/ARIA-Sentinel-0.1.3-unsigned.exe" });
assert.match(ghYml, /url: https:\/\/github\.com\/integrateditsupp-debug\/iisupp-net-deploy\/releases\/download\/sentinel-v0\.1\.3\/ARIA-Sentinel-0\.1\.3-unsigned\.exe/);
assert.doesNotMatch(ghYml, /sentinel-binaries/, "GitHub url replaces the Netlify path");

// Staged rollout: 0% none, 100% all, deterministic per key.
assert.equal(inRollout("any", 0), false);
assert.equal(inRollout("any", 100), true);
assert.equal(inRollout("license-abc", 50), inRollout("license-abc", 50), "deterministic");
let inAt10 = 0;
for (let i = 0; i < 1000; i++) if (inRollout("lic-" + i, 10)) inAt10++;
assert.ok(inAt10 > 50 && inAt10 < 160, `~10% of the fleet in a 10% rollout (got ${inAt10}/1000)`);

console.log("Update-manifest test passed (pin + latest-non-disabled · latest.yml · staged rollout).");
