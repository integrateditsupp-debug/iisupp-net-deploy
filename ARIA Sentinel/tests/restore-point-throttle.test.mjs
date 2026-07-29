// STAGE 3 S2 — restore points, throttle-aware, with an HONEST degrade. Windows allows one automatic
// checkpoint per 24h by default and System Protection is often off; a safety net we merely CLAIM to
// have is worse than none. So when we cannot get a checkpoint we say "journal-only rollback" and the
// plan card carries that sentence. And we never revert a machine automatically — that stays a human
// one-click, always.
import assert from "node:assert/strict";
import { ensureRestorePoint, isThrottled, revertOffer, RESTORE_THROTTLE_MS, JOURNAL_ONLY_NOTE, RESTORE_DEGRADE_REASONS } from "../src/main/restore-point.mjs";

const H = 3600000;
const NOW = 1_000 * H;
const okRun = async (cmd) => (/Measure-Object/i.test(String(cmd)) ? { stdout: "4", stderr: "", exitCode: 0 } : { stdout: "", stderr: "", exitCode: 0 });
const failRun = async () => ({ stdout: "", stderr: "denied", exitCode: 1 });
const base = { now: () => NOW, run: okRun, planRunId: "print-recovery-run-1", touchesSystemState: true };

// 1 — the throttle boundary is exact and pure.
assert.equal(isThrottled(NOW - 1 * H, NOW), true);
assert.equal(isThrottled(NOW - 23.9 * H, NOW), true);
assert.equal(isThrottled(NOW - RESTORE_THROTTLE_MS, NOW), false, "exactly 24h old ⇒ no longer throttled");
assert.equal(isThrottled(null, NOW), false, "no known point ⇒ try");

// 2 — a fresh (<24h) restore point ⇒ degrade honestly to journal-only, with the reason named.
let calls = [];
let r = await ensureRestorePoint({ ...base, lastRestorePointAt: NOW - 2 * H, run: async (c) => { calls.push(String(c)); return okRun(c); } });
assert.equal(r.mode, "journal-only");
assert.equal(r.reason, "throttled-24h");
assert.equal(r.note, JOURNAL_ONLY_NOTE);
assert.match(r.note, /journal-only/i);
assert.equal(calls.length, 0, "throttled ⇒ we do not even attempt the checkpoint");

// 3 — System Protection disabled ⇒ degrade, named honestly.
r = await ensureRestorePoint({ ...base, systemProtectionEnabled: false });
assert.equal(r.mode, "journal-only");
assert.equal(r.reason, "srp-disabled");

// 4 — the checkpoint command fails ⇒ degrade (never a silent "we have a restore point").
r = await ensureRestorePoint({ ...base, lastRestorePointAt: NOW - 48 * H, run: failRun });
assert.equal(r.mode, "journal-only");
assert.equal(r.reason, "create-failed");
assert.ok(RESTORE_DEGRADE_REASONS.includes(r.reason));

// 5 — happy path: older than 24h + a working checkpoint ⇒ a real restore point, with evidence.
calls = [];
r = await ensureRestorePoint({ ...base, lastRestorePointAt: NOW - 30 * H, run: async (c) => { calls.push(String(c)); return okRun(c); } });
assert.equal(r.mode, "restore-point");
assert.equal(r.reason, "");
assert.equal(r.evidence, "4");
assert.ok(calls.some((c) => /Checkpoint-Computer/i.test(c)), "the checkpoint was actually created");

// 6 — a plan that does not touch system state gets no checkpoint AND no false claim.
r = await ensureRestorePoint({ ...base, touchesSystemState: false });
assert.equal(r.mode, "not-needed");

// 7 — 🔒 R11: an off-limits planRunId degrades to journal-only and surfaces the standard line.
r = await ensureRestorePoint({ ...base, lastRestorePointAt: NOW - 30 * H, planRunId: "C:\\Users\\a\\Private pics and Vids\\plan" });
assert.equal(r.mode, "journal-only");
assert.equal(r.reason, "blocked");
assert.equal(r.surfaced, "1 personal folder excluded");

// 8 — every decision is journaled for the plan card.
const events = [];
await ensureRestorePoint({ ...base, lastRestorePointAt: NOW - 2 * H, journal: (event, fields) => events.push({ event, fields }) });
assert.equal(events.length, 1);
assert.equal(events[0].event, "PLAN.STEP.PRE");
assert.equal(events[0].fields.extra.restorePoint, true);
assert.equal(events[0].fields.extra.mode, "journal-only");

// 9 — REVERT is never automatic: no command is ever handed to an automated path.
const offer = revertOffer({ mode: "restore-point" });
assert.equal(offer.offer, true);
assert.equal(offer.command, "", "we never hand a Restore-Computer command to an automated path");
assert.match(offer.text, /you can roll windows back to it yourself/i);
assert.equal(revertOffer({ mode: "journal-only", reason: "throttled-24h" }).offer, false);
assert.equal(revertOffer(null).offer, false);

console.log("restore-point-throttle test passed (24h throttle exact · honest journal-only degrade with named reason · R11 · every decision journaled · revert is never automatic).");
