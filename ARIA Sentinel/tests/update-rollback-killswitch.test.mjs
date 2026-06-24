// RUN 21 §2 — pre-install snapshot + a 60-minute kill-switch (Ctrl+Alt+K) rollback window.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { snapshotName, canRollback, ROLLBACK_WINDOW_MS } from "../src/main/update-orchestrator.mjs";

assert.equal(ROLLBACK_WINDOW_MS, 60 * 60 * 1000, "60-minute rollback window");

// Snapshot name is deterministic + filename-safe (no colons).
const now = Date.parse("2026-07-05T17:30:00.000Z");
const name = snapshotName("0.3.0", now);
assert.match(name, /^v0\.3\.0-presnapshot-/, "snapshot names the version");
assert.doesNotMatch(name, /[:]/, "snapshot name is filesystem-safe");

// canRollback: true within 60 min of install, false after.
const installedAt = new Date(now).toISOString();
assert.equal(canRollback(installedAt, now + 10 * 60 * 1000), true, "rollback allowed at +10min");
assert.equal(canRollback(installedAt, now + 59 * 60 * 1000), true, "rollback allowed at +59min");
assert.equal(canRollback(installedAt, now + 61 * 60 * 1000), false, "rollback closed at +61min");
assert.equal(canRollback(null, now), false, "no install → nothing to roll back");

// main wires the kill-switch to revert a just-installed update + snapshots before install.
const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
const kill = main.match(/function activateKillSwitch\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(kill, "activateKillSwitch found");
assert.match(kill[0], /canRollback\(/, "kill-switch checks the rollback window");
assert.match(kill[0], /rollbackToVersion\(/, "kill-switch reverts the update");
assert.match(main, /function snapshotPreUpdate\(/, "pre-install snapshot exists");
assert.match(main, /snapshotPreUpdate\(state\.version\)/, "install snapshots before applying");
assert.match(main, /dist-backups/, "snapshot written to dist-backups/");

console.log("Update-rollback-killswitch test passed (snapshot before install · 60-min Ctrl+Alt+K revert window · wired in main).");
