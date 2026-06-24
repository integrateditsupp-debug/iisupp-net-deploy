// RUN 14 — user-side update history + rollback, and that a server pin downgrades the device.
import assert from "node:assert/strict";
import { recordInstall, rollbackTargets } from "../src/shared/auto-update.mjs";
import { pickVersionForLicense } from "../src/shared/update-manifest.mjs";

// History: newest first, deduped by version.
let hist = [];
hist = recordInstall(hist, { version: "0.1.0", installed: "2026-06-19T22:00:00Z", notes: "UI polish" });
hist = recordInstall(hist, { version: "0.1.1", installed: "2026-06-20T09:15:00Z", notes: "patch recipes" });
hist = recordInstall(hist, { version: "0.1.2", installed: "2026-06-20T14:22:00Z", notes: "admin fix" });
assert.equal(hist[0].version, "0.1.2", "newest first");
assert.equal(hist.length, 3);
// Re-installing a version doesn't duplicate it.
hist = recordInstall(hist, { version: "0.1.2", installed: "2026-06-20T15:00:00Z" });
assert.equal(hist.length, 3, "dedupe by version");

// Rollback targets = only versions older than current (0.1.2) → 0.1.1, 0.1.0.
const targets = rollbackTargets(hist, "0.1.2");
assert.deepEqual(targets.map((t) => t.version), ["0.1.1", "0.1.0"]);
assert.ok(!targets.some((t) => t.version === "0.1.2"), "current is not a rollback target");

// A server-side pin makes the device's next manifest poll serve the older version (auto-downgrade).
const versions = [
  { version: "0.1.0", disabled: false }, { version: "0.1.1", disabled: false }, { version: "0.1.2", disabled: false }
];
assert.equal(pickVersionForLicense({ versions, license: { version_pin: "0.1.1" } }).version, "0.1.1", "pinned rollback served");
// Without a pin the device returns to latest (rollback is reversible).
assert.equal(pickVersionForLicense({ versions, license: {} }).version, "0.1.2");

console.log("Update-rollback test passed (history newest-first+dedupe · rollback targets older-only · pin downgrades).");
