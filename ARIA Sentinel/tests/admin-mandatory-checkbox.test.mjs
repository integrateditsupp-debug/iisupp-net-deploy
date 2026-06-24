// RUN 21 §6 — the admin "Mandatory" checkbox compresses the 3-strike window from 24h to 3h per strike.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { strikeHoursForEvent } from "../src/shared/update-events.mjs";
import { strikeWindowMs, MANDATORY_WINDOW_MS, STRIKE_WINDOW_MS } from "../src/shared/update-state.mjs";

// Mandatory → 3h per strike; normal → 24h.
assert.equal(strikeHoursForEvent({ mandatory: true }), 3);
assert.equal(strikeHoursForEvent({ mandatory: false }), 24);
assert.equal(strikeWindowMs(true), MANDATORY_WINDOW_MS);
assert.equal(strikeWindowMs(false), STRIKE_WINDOW_MS);
assert.equal(MANDATORY_WINDOW_MS, 3 * 60 * 60 * 1000, "3h");
assert.equal(STRIKE_WINDOW_MS, 24 * 60 * 60 * 1000, "24h");

// Admin console exposes the Mandatory checkbox and the publish flow sends it.
const root = path.resolve(import.meta.dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin-console", "index.html"), "utf8");
assert.match(admin, /id="publishMandatory"/, "Mandatory checkbox present");
assert.match(admin, /Mandatory/, "labelled Mandatory");
assert.match(admin, /mandatory\s*=\s*!!document\.getElementById\('publishMandatory'\)/, "publish reads the checkbox");
assert.match(admin, /mandatory\s*\}/, "publish posts the mandatory flag");

// The orchestrator actually honors the compressed window for a mandatory update.
const { detect, isNoticeDue } = await import("../src/main/update-orchestrator.mjs");
const now = Date.parse("2026-07-05T00:00:00Z");
const m = detect(null, "0.5.0", now, { mandatory: true });
assert.equal(isNoticeDue(m, now + 2 * 3600e3), false, "not due at 2h");
assert.equal(isNoticeDue(m, now + 3 * 3600e3 + 1000), true, "due at 3h (compressed)");

console.log("Admin-mandatory-checkbox test passed (checked → 24h→3h strike window; orchestrator honors it).");
