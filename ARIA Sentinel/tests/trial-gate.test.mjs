// RUN 13 trial gate (§7) — PROD 2026-10-14 (audit M14 / R3): the trial is 30 DAYS from first launch, as the UI
// says in four places and the product design states; it was 12 hours in code ("Friday install → Monday 'ended'").
import assert from "node:assert/strict";
import { computeTrialStatus, isUnlocked, trialBadge, TRIAL_DURATION_MS, TRIAL_DAYS } from "../src/shared/license.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-19T22:00:00.000Z");
assert.equal(TRIAL_DAYS, 30, "the trial is 30 days");
assert.equal(TRIAL_DURATION_MS, 30 * DAY, "30 days in ms");

// not-started → active → expired.
const ns = computeTrialStatus(null, NOW);
assert.equal(ns.state, "not-started");
assert.equal(ns.endsAt, null); assert.equal(ns.daysLeft, null); assert.equal(ns.durationMs, TRIAL_DURATION_MS); assert.equal(ns.days, 30);
const started1dAgo = new Date(NOW - 1 * DAY).toISOString();
const active = computeTrialStatus(started1dAgo, NOW);
assert.equal(active.state, "active");
assert.equal(active.remainingMs, 29 * DAY, "29 days left after one day");
assert.equal(active.daysLeft, 29, "daysLeft is a true count");
assert.equal(active.endsAt, new Date(NOW - 1 * DAY + 30 * DAY).toISOString(), "endsAt = started + 30 days");
const started31dAgo = new Date(NOW - 31 * DAY).toISOString();
const expired = computeTrialStatus(started31dAgo, NOW);
assert.equal(expired.state, "expired");
assert.equal(expired.remainingMs, 0);
assert.equal(expired.daysLeft, 0);
assert.ok(Date.parse(expired.endsAt) < NOW, "an expired trial still reports when it ended");
// A 13-hour-old trial (the old 12 h expiry) is of course still active now.
assert.equal(computeTrialStatus(new Date(NOW - 13 * 60 * 60 * 1000).toISOString(), NOW).state, "active", "13 hours in: still 29+ days of trial");

// Exactly at 30 d → expired (boundary); a partial last day rounds UP to 1 day left.
assert.equal(computeTrialStatus(new Date(NOW - TRIAL_DURATION_MS).toISOString(), NOW).state, "expired");
assert.equal(computeTrialStatus(new Date(NOW - TRIAL_DURATION_MS + 3600_000).toISOString(), NOW).daysLeft, 1);

// Gate: license OR active trial unlocks; expired + no license = locked (the baseline tabs stay usable — tab-gating).
assert.equal(isUnlocked({ licenseValid: true, trialState: "expired" }), true, "valid license unlocks even after trial");
assert.equal(isUnlocked({ licenseValid: false, trialState: "active" }), true, "active trial unlocks");
assert.equal(isUnlocked({ licenseValid: false, trialState: "expired" }), false, "expired + no license = locked");
assert.equal(isUnlocked({ licenseValid: false, trialState: "not-started" }), false);

// Badge formatting: days + hours while a day or more remains; hours + minutes inside the last day.
assert.equal(trialBadge(29 * DAY + 4 * 60 * 60 * 1000), "Trial · 29d 4h left");
assert.equal(trialBadge(8 * 60 * 60 * 1000 + 12 * 60 * 1000), "Trial · 8h 12m left");
assert.equal(trialBadge(0), "Trial · 0h 0m left");

// main.mjs wiring (source-level; main needs Electron): started once at first launch, the record carries the end date,
// and the state the renderer gets (license.trialEndsAt / daysLeft, gate.trial.endsAt / daysLeft) comes from the same clock.
import fs from "node:fs";
import path from "node:path";
const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src/main/main.mjs"), "utf8");
assert.match(main, /if \(readTrial\(\) \|\| licenseStatus\(\)\.licensed\) return false;/, "write-once: an existing trial is never restarted");
assert.match(main, /days: TRIAL_DAYS, ends_at: new Date\(Date\.parse\(started\) \+ TRIAL_DAYS \* 86400000\)\.toISOString\(\)/, "the record carries the 30-day end date");
assert.match(main, /`\$\{TRIAL_DAYS\}-day trial started/, "the audit row says 30-day, not 12-hour");
assert.doesNotMatch(main, /12-hour trial started/, "the 12-hour copy is gone");
assert.match(main, /\.\.\.trialFields\(eff\.trialEndsAt \|\| null\)/, "license.trialEndsAt/daysLeft are TRUE (server entitlement, else the local trial)");
assert.match(main, /return \{ trialEndsAt: endsAt, daysLeft, trialDays: TRIAL_DAYS \};/, "daysLeft computed from the real end");
assert.match(main, /trial: \{ state: trial\.state, remainingMs: trial\.remainingMs, endsAt: trial\.endsAt, daysLeft: trial\.daysLeft, durationMs: trial\.durationMs/, "gate.trial carries endsAt/daysLeft/durationMs for the renderer");
assert.match(main, /ensureTrialStarted\(\);/, "the trial starts at first launch");

console.log("Trial-gate test passed (30d · not-started/active/expired · endsAt + daysLeft true · license-or-trial gate · badge · main writes once + state carries the real end).");
