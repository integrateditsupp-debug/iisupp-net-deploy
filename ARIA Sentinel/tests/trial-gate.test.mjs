// RUN 13 — 12-hour trial gate (§7).
import assert from "node:assert/strict";
import { computeTrialStatus, isUnlocked, trialBadge, TRIAL_DURATION_MS } from "../src/shared/license.mjs";

const NOW = Date.parse("2026-06-19T22:00:00.000Z");
assert.equal(TRIAL_DURATION_MS, 12 * 60 * 60 * 1000, "trial is 12 hours");

// not-started → active → expired.
assert.equal(computeTrialStatus(null, NOW).state, "not-started");
const started1hAgo = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
const active = computeTrialStatus(started1hAgo, NOW);
assert.equal(active.state, "active");
assert.ok(active.remainingMs > 10 * 60 * 60 * 1000 && active.remainingMs <= 11 * 60 * 60 * 1000);
const started13hAgo = new Date(NOW - 13 * 60 * 60 * 1000).toISOString();
const expired = computeTrialStatus(started13hAgo, NOW);
assert.equal(expired.state, "expired");
assert.equal(expired.remainingMs, 0);

// Exactly at 12h → expired (boundary).
assert.equal(computeTrialStatus(new Date(NOW - TRIAL_DURATION_MS).toISOString(), NOW).state, "expired");

// Gate: license OR active trial unlocks; expired + no license = locked.
assert.equal(isUnlocked({ licenseValid: true, trialState: "expired" }), true, "valid license unlocks even after trial");
assert.equal(isUnlocked({ licenseValid: false, trialState: "active" }), true, "active trial unlocks");
assert.equal(isUnlocked({ licenseValid: false, trialState: "expired" }), false, "expired + no license = locked");
assert.equal(isUnlocked({ licenseValid: false, trialState: "not-started" }), false);

// Badge formatting.
assert.equal(trialBadge(8 * 60 * 60 * 1000 + 12 * 60 * 1000), "Trial · 8h 12m left");
assert.equal(trialBadge(0), "Trial · 0h 0m left");

console.log("Trial-gate test passed (12h · not-started/active/expired · license-or-trial gate · badge).");
