// RUN 21 §6 — every successful admin publish appends a record to the "update-events" log + the admin
// fleet UI reflects it.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildUpdateEvent, appendUpdateEvent } from "../src/shared/update-events.mjs";

// buildUpdateEvent shape (from the publish record + operator).
const ev = buildUpdateEvent({ version: "0.3.0", sha512: "ABC", size: 12345, release_notes: "notes", release_date: "2026-07-05T00:00:00Z", mandatory: true }, "ahmad");
assert.deepEqual(ev, {
  version: "0.3.0", sha512: "ABC", size: 12345, releaseNotes: "notes",
  publishedAt: "2026-07-05T00:00:00Z", publishedBy: "ahmad", mandatory: true
});
assert.equal(buildUpdateEvent({ version: "0.2.0", sha512: "x" }).mandatory, false, "defaults non-mandatory");

// appendUpdateEvent is newest-first and capped.
let log = [];
log = appendUpdateEvent(log, buildUpdateEvent({ version: "0.1.0", sha512: "a" }));
log = appendUpdateEvent(log, buildUpdateEvent({ version: "0.2.0", sha512: "b" }));
assert.equal(log[0].version, "0.2.0", "newest first");
assert.ok(appendUpdateEvent(Array(500).fill(ev), ev).length <= 200, "capped at 200");

// The publish handler captures the event into the update-events store.
const root = path.resolve(import.meta.dirname, "..");
const publish = fs.readFileSync(path.join(root, "netlify", "functions", "aria-sentinel-update-publish.js"), "utf8");
assert.match(publish, /buildUpdateEvent\(/, "publish builds the event");
assert.match(publish, /getStore\("update-events"\)/, "writes to the update-events store");
assert.match(publish, /appendUpdateEvent\(/, "appends to the rolling log");
assert.match(publish, /mandatory:\s*Boolean\(body\.mandatory\)/, "publish carries the mandatory flag");

// The admin console renders an "Update fleet" table.
const admin = fs.readFileSync(path.join(root, "admin-console", "index.html"), "utf8");
assert.match(admin, /Update fleet/, "admin has the Update fleet section");
assert.match(admin, /id="updateFleetRows"/, "fleet table container");

console.log("Admin-publish-captures-event test passed (event built + appended + stored · fleet UI present).");
