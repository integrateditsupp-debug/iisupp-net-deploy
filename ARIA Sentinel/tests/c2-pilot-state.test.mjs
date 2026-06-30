// RUN-C C2 — free-pilot mechanic (14-day SMB pilot). Pure state machine + non-nagging prompt + local
// intake. 🔒 Rule 14: a missing start is `inactive` with daysRemaining=null — never a fabricated number.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  pilotStatus, pilotBadge, pilotUpgradePrompt, validatePilotIntake, buildPilotRecord,
  PILOT_DAY_MS, PILOT_DEFAULT_DAYS, PILOT_EXPIRING_DAYS, PILOT_SIZES
} from "../src/shared/pilot-state.mjs";

const NOW = Date.parse("2026-07-01T00:00:00.000Z");
const ago = (d) => new Date(NOW - d * PILOT_DAY_MS).toISOString();

assert.equal(PILOT_DEFAULT_DAYS, 14, "pilot is 14 days");
assert.equal(PILOT_EXPIRING_DAYS, 3, "expiring window is 3 days");

// ── Real-or-empty: no start => inactive, daysRemaining NULL (never a fake countdown) ───────────────
for (const s of [pilotStatus({}), pilotStatus({ startedAt: null }), pilotStatus({ startedAt: "" }), pilotStatus({ startedAt: "not-a-date" })]) {
  assert.equal(s.state, "inactive");
  assert.equal(s.daysRemaining, null, "inactive shows NO number");
  assert.equal(s.startedAt, null);
  assert.equal(s.expiresAt, null);
}

// ── Boundary day 14: a just-started pilot has 14 days and is active ─────────────────────────────────
const fresh = pilotStatus({ startedAt: ago(0), now: NOW });
assert.equal(fresh.state, "active");
assert.equal(fresh.daysRemaining, 14, "fresh pilot = 14 days");
// expiresAt math: start + 14 days, exact.
assert.equal(fresh.expiresAt, new Date(NOW + PILOT_DEFAULT_DAYS * PILOT_DAY_MS).toISOString(), "expiresAt = start + 14d");
assert.equal(fresh.startedAt, new Date(NOW).toISOString());

// ── Active mid-pilot ────────────────────────────────────────────────────────────────────────────────
const mid = pilotStatus({ startedAt: ago(5), now: NOW });
assert.equal(mid.state, "active");
assert.equal(mid.daysRemaining, 9);

// ── Boundary day 3: exactly 3 days left => expiring (not active) ────────────────────────────────────
const at3 = pilotStatus({ startedAt: ago(11), now: NOW });
assert.equal(at3.daysRemaining, 3);
assert.equal(at3.state, "expiring", "3 days left = expiring");
// 4 days left is still active (3 is the threshold, not 4).
assert.equal(pilotStatus({ startedAt: ago(10), now: NOW }).state, "active", "4 days left = active");
// 1 day left => expiring, singular badge.
const at1 = pilotStatus({ startedAt: ago(13), now: NOW });
assert.equal(at1.state, "expiring");
assert.equal(pilotBadge(at1), "Pilot · 1 day left");

// ── Boundary day 0 + past: expired, daysRemaining 0 ────────────────────────────────────────────────
const at0 = pilotStatus({ startedAt: ago(14), now: NOW });
assert.equal(at0.state, "expired", "exactly 14 days elapsed = expired");
assert.equal(at0.daysRemaining, 0);
const past = pilotStatus({ startedAt: ago(20), now: NOW });
assert.equal(past.state, "expired");
assert.equal(past.daysRemaining, 0);

// ── Custom pilot length honored ─────────────────────────────────────────────────────────────────────
assert.equal(pilotStatus({ startedAt: ago(5), days: 7, now: NOW }).state, "expiring"); // 2 days left
assert.equal(pilotStatus({ startedAt: ago(1), days: 7, now: NOW }).state, "active");    // 6 days left

// ── Badges ───────────────────────────────────────────────────────────────────────────────────────────
assert.equal(pilotBadge(pilotStatus({})), "Free pilot");
assert.equal(pilotBadge(fresh), "Pilot · 14 days left");
assert.equal(pilotBadge(at0), "Pilot ended");

// ── Non-nagging prompt: only at expiring/expired, once per state, dismissible, never blocking ───────
assert.equal(pilotUpgradePrompt(pilotStatus({})), null, "inactive => no prompt");
assert.equal(pilotUpgradePrompt(mid), null, "active => no prompt");

const pExpiring = pilotUpgradePrompt(at3, { dismissed: [] });
assert.ok(pExpiring && pExpiring.show === true);
assert.equal(pExpiring.blocking, false, "prompt NEVER blocks the app");
assert.equal(pExpiring.dismissible, true);
assert.equal(pExpiring.key, "pilot-expiring");
assert.ok(/plan/i.test(pExpiring.cta));
assert.equal(pilotUpgradePrompt(at3, { dismissed: ["expiring"] }), null, "shown once then suppressed");

const pExpired = pilotUpgradePrompt(at0, { dismissed: [] });
assert.equal(pExpired.key, "pilot-expired");
assert.equal(pExpired.blocking, false);
// dismissing 'expiring' does NOT suppress the later 'expired' prompt (distinct terminal states).
assert.ok(pilotUpgradePrompt(at0, { dismissed: ["expiring"] }), "expired still surfaces after expiring dismissed");
assert.equal(pilotUpgradePrompt(at0, { dismissed: ["expired"] }), null);
// object form of dismissed map also works.
assert.equal(pilotUpgradePrompt(at0, { dismissed: { expired: 1 } }), null);

// ── Intake validation (real-or-empty: org + known size + 1..3 pains) ───────────────────────────────
const good = validatePilotIntake({ org: "Acme Dental", size: "11-50", pains: ["VPN drops", "printer offline", "email sync"] });
assert.ok(good.ok);
assert.deepEqual(good.value.pains.length, 3);
assert.ok(PILOT_SIZES.includes(good.value.size));

assert.deepEqual(validatePilotIntake({ size: "11-50", pains: ["x"] }).errors.includes("org-required"), true);
assert.deepEqual(validatePilotIntake({ org: "A", size: "huge", pains: ["x"] }).errors.includes("size-invalid"), true);
assert.deepEqual(validatePilotIntake({ org: "A", size: "1-10", pains: [] }).errors.includes("pains-required"), true);
assert.deepEqual(validatePilotIntake({ org: "A", size: "1-10", pains: ["a", "b", "c", "d"] }).errors.includes("pains-max-3"), true);
// string + alias form for pains.
assert.deepEqual(validatePilotIntake({ org: "A", size: "500+", topPains: "vpn; printer" }).value.pains, ["vpn", "printer"]);
// 🔒 R11 path-scrub on org free text.
const scrubbed = validatePilotIntake({ org: "Acme C:\\Users\\ahmad\\secret Inc", size: "1-10", pains: ["x"] });
assert.ok(scrubbed.ok);
assert.ok(!/secret/.test(scrubbed.value.org), "filesystem path scrubbed from org");
assert.ok(/\[path\]/.test(scrubbed.value.org));

// ── buildPilotRecord: local JSON shape, real start, no external fields ──────────────────────────────
const built = buildPilotRecord({ org: "Acme", size: "51-200", pains: ["wifi"] }, { now: NOW, deviceId: "DESK-01" });
assert.ok(built.ok);
assert.equal(built.record.schema, "pilot.v1");
assert.equal(built.record.started_at, new Date(NOW).toISOString());
assert.equal(built.record.org, "Acme");
assert.deepEqual(built.record.pains, ["wifi"]);
assert.deepEqual(Object.keys(built.record).sort(), ["device_id", "org", "pains", "schema", "size", "started_at"]);
// status derived from a freshly built record is active with 14 days.
assert.equal(pilotStatus({ startedAt: built.record.started_at, now: NOW }).daysRemaining, 14);
assert.deepEqual(buildPilotRecord({ size: "1-10" }).ok, false, "invalid intake builds no record");
assert.equal(buildPilotRecord({ size: "1-10" }).record, null);

// ── Wiring proof: the mechanic is actually plumbed into main + preload (not a floating module) ──────
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
assert.match(main, /pilot\.json/, "main persists ~/.aria-sentinel/pilot.json");
assert.match(main, /from "\.\.\/shared\/pilot-state\.mjs"/, "main imports pilot-state");
assert.match(main, /sentinel:start-pilot/, "main exposes start-pilot IPC");
assert.match(main, /sentinel:dismiss-pilot-prompt/, "main exposes dismiss-pilot-prompt IPC");
assert.match(main, /pilot:\s*\{/, "gateStatus surfaces a pilot block");
assert.match(preload, /startPilot/, "preload bridges startPilot");
assert.match(preload, /sentinel:start-pilot/, "preload wires the start-pilot channel");

console.log("C2 pilot-state test passed (14d state machine · boundaries 14/3/0 · real-or-empty · once-per-state non-blocking prompt · intake+scrub · main/preload wired).");
