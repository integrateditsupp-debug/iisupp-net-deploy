// RUN-E E1 — pilot activation → TTFV clock. The C2 activation moment starts the clock; the FIRST real
// resolved issue (audit-log RUN entry — the exact signal the D2 proof counts) stops it, once, forever.
// 🔒 Rule 14: no pilot / no real fix / fix-before-start => NO stamp, and the label is "--". A TTFV
// number can ONLY be derived from two real recorded timestamps. Never fabricated, never rewritten.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  firstFixAtFromAudit, stampTtfv, ttfvMinutes, ttfvLabel, buildPilotRecord
} from "../src/shared/pilot-state.mjs";

const START = Date.parse("2026-07-02T00:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60000;

// ── firstFixAtFromAudit: real-or-empty ─────────────────────────────────────────────────────────────
assert.equal(firstFixAtFromAudit(undefined, { startedAt: iso(START) }), null, "no log => null");
assert.equal(firstFixAtFromAudit([], { startedAt: iso(START) }), null, "empty log => null");
assert.equal(firstFixAtFromAudit([{ ts: iso(START + MIN), tag: "RUN" }], {}), null, "no pilot start => null (never guesses)");
assert.equal(firstFixAtFromAudit([{ ts: iso(START + MIN), tag: "PILOT" }, { ts: iso(START + 2 * MIN), tag: "SECURITY" }], { startedAt: iso(START) }), null, "non-RUN entries never count");
assert.equal(firstFixAtFromAudit([{ ts: iso(START - 5 * MIN), tag: "RUN" }], { startedAt: iso(START) }), null, "a fix BEFORE pilot start is not the pilot's first value");
assert.equal(firstFixAtFromAudit([{ ts: "not-a-date", tag: "RUN" }, { tag: "RUN" }], { startedAt: iso(START) }), null, "unparseable/missing ts skipped");

// Earliest qualifying RUN wins — input is newest-first like the real transparencyLog (order not assumed).
const newestFirstLog = [
  { ts: iso(START + 30 * MIN), tag: "RUN", text: "later fix" },
  { ts: iso(START + 4 * MIN), tag: "PILOT", text: "noise" },
  { ts: iso(START + 7 * MIN), tag: "RUN", text: "FIRST real fix" },
  { ts: iso(START - 60 * MIN), tag: "RUN", text: "pre-pilot fix (excluded)" }
];
assert.equal(firstFixAtFromAudit(newestFirstLog, { startedAt: iso(START) }), START + 7 * MIN, "earliest RUN at/after start wins");
assert.equal(firstFixAtFromAudit([{ ts: iso(START), tag: "RUN" }], { startedAt: iso(START) }), START, "fix exactly at start counts (0 min TTFV is real)");

// ── stampTtfv: pure, real-or-empty, write-once ─────────────────────────────────────────────────────
assert.deepEqual(stampTtfv(null, { firstFixAt: START + MIN }), { changed: false, record: null }, "no record => no stamp");
const rec = buildPilotRecord({ org: "Acme Clinic", size: "11-50", pains: ["printers"] }, { now: START, deviceId: "dev-1" }).record;
assert.equal(rec.schema, "pilot.v1", "additive: schema stays pilot.v1");
assert.deepEqual(stampTtfv(rec, { firstFixAt: null }), { changed: false, record: rec }, "no real fix => NO stamp (real-or-empty)");
assert.equal(stampTtfv(rec, { firstFixAt: START - MIN }).changed, false, "fix before start => NO stamp");

const stamped = stampTtfv(rec, { firstFixAt: START + 4.2 * MIN, now: START + 5 * MIN });
assert.equal(stamped.changed, true, "real fix after start => stamped");
assert.equal(stamped.record.ttfv.minutes, 4.2, "ttfvMinutes = real elapsed minutes (one decimal) — the ≤5-min E1 goal is measurable");
assert.equal(stamped.record.ttfv.first_fix_at, iso(START + 4.2 * MIN), "first_fix_at recorded exactly");
assert.equal(stamped.record.ttfv.stamped_at, iso(START + 5 * MIN), "stamped_at recorded");
assert.equal(stamped.record.org, "Acme Clinic", "original intake preserved");
assert.equal(rec.ttfv, undefined, "pure: input record not mutated");

// Write-once: a later (or even earlier-looking) re-stamp NEVER rewrites first value.
assert.equal(stampTtfv(stamped.record, { firstFixAt: START + MIN }).changed, false, "write-once: never overwritten");
assert.equal(stampTtfv(stamped.record, { firstFixAt: START + 999 * MIN }).changed, false, "write-once: later fix ignored");

// ── accessors: real-or-empty surface ───────────────────────────────────────────────────────────────
assert.equal(ttfvMinutes(null), null); assert.equal(ttfvMinutes(rec), null);
assert.equal(ttfvLabel(rec), "--", 'dashboard shows "--" until a REAL first value exists');
assert.equal(ttfvMinutes(stamped.record), 4.2);
assert.equal(ttfvLabel(stamped.record), "4.2 min");
assert.equal(ttfvMinutes({ ttfv: { minutes: -3 } }), null, "negative minutes can never surface");
assert.equal(ttfvLabel({ ttfv: { minutes: "fake" } }), "--", "non-numeric stamp surfaces as empty, never as a number");

// ── end-to-end (pure): activation → audit fix → stamp, exactly like main.mjs wires it ─────────────
const e2eFix = firstFixAtFromAudit(newestFirstLog, { startedAt: rec.started_at });
const e2e = stampTtfv(rec, { firstFixAt: e2eFix });
assert.equal(e2e.changed, true);
assert.equal(e2e.record.ttfv.minutes, 7, "activation → first real fix = 7.0 min, straight from the audit log");

// ── wiring locks (grep main.mjs — same style as c2/audit batteries) ────────────────────────────────
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.ok(main.includes("function maybeStampPilotTtfv()"), "main wires the TTFV stamper");
assert.ok(main.includes('if (tag === "RUN") { try { maybeStampPilotTtfv(); }'), "every real RUN fix triggers the stamp at log time");
assert.ok(main.includes("try { maybeStampPilotTtfv(); } catch { /* RUN-E E1"), "startup catch-up stamp wired (earlier-session fixes)");
assert.ok(main.includes("ttfvMinutes: ttfvMinutes(readPilot())"), "payload exposes real-or-empty ttfvMinutes");
assert.ok(main.includes("ttfv: ttfvLabel(readPilot())"), 'payload exposes the "--"-until-real label');
assert.ok(main.includes("function writePilot(record)"), "single local pilot.json writer helper");
assert.ok(!main.includes("ttfvMinutes: 0,") && !main.includes('ttfv: "0 min"'), "no hardcoded/fabricated TTFV anywhere");
const runAll = fs.readFileSync(path.join(root, "tests", "run-all.mjs"), "utf8");
assert.ok(runAll.indexOf("deploy-safety-denylist") < runAll.indexOf("e1-pilot-activation-ttfv"), "registered AFTER the denylist gate");

console.log("e1-pilot-activation-ttfv: all assertions passed (TTFV is real-or-empty, write-once, audit-log-driven)");
