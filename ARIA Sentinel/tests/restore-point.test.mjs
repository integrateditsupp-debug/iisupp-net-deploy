// STAGE 3 S2 — RESTORE POINT battery. A system-changing plan earns a Checkpoint-Computer before step 1,
// verified by OUTCOME (the restore-point sequence number must actually increase — exit-code-0 is NOT proof,
// because Windows silently no-ops inside the 24h throttle window). When we can't prove a new point exists we
// degrade HONESTLY to journal-only rollback and say so; we never fabricate a restore-point id (Rule 14).
// R11 is check #1, kill-switch aborts first, dry-run never claims a checkpoint, and REVERT is never
// automatic. Pure + injectable: an injected clock + fake runner; nothing is ever really spawned.
import assert from "node:assert/strict";
import {
  RESTORE_POINT_VERSION, CHECKPOINT_THROTTLE_MS, PROTECTION, RESTORE_STATUS, RESTORE_COMMANDS,
  CHECKPOINT_DESCRIPTION, planTouchesSystemState, isThrottled, sequenceOf, verifyCreated,
  planCardLine, buildRevertOffer, ensureRestorePoint
} from "../src/main/restore-point.mjs";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
// A fake runner: returns the given `list` stdout for the read command; records the create call. Nothing spawns.
function fakeRunner({ listBefore = "", listAfter = "" } = {}) {
  const calls = [];
  let createdOnce = false;
  const run = async (cmd) => {
    calls.push(cmd);
    if (cmd === RESTORE_COMMANDS.create) { createdOnce = true; return { stdout: "", stderr: "", exitCode: 0 }; }
    // list command: before the create call -> listBefore; after -> listAfter.
    return { stdout: createdOnce ? listAfter : listBefore, stderr: "", exitCode: 0 };
  };
  return { run, calls: () => calls };
}
const sysPlan = { id: "print-recovery", title: "Fix printing", riskEnvelope: { systemState: true }, steps: [] };

// 1 — constants + status vocabulary are the audited values.
assert.equal(RESTORE_POINT_VERSION, "restore-point-v1");
assert.equal(CHECKPOINT_THROTTLE_MS, 24 * HOUR, "Windows default = 1 restore point / 24h");
assert.deepEqual({ ...PROTECTION }, { RESTORE_POINT: "restore-point", JOURNAL_ONLY: "journal-only" });
assert.ok(RESTORE_STATUS.includes("created") && RESTORE_STATUS.includes("throttled-degraded") && RESTORE_STATUS.includes("unverified-degraded"));
assert.equal(CHECKPOINT_DESCRIPTION, "ARIA Sentinel Resolution Plan", "content-blind, id-free description");
assert.ok(!/print-recovery/.test(RESTORE_COMMANDS.create), "no plan id ever enters the checkpoint description");

// 2 — planTouchesSystemState: explicit flags win; scopes + irreversible/reboot steps qualify; unknown -> false.
assert.equal(planTouchesSystemState({ riskEnvelope: { systemState: true } }), true);
assert.equal(planTouchesSystemState({ riskEnvelope: { systemState: false, level: "system" } }), false, "explicit false wins over inference");
assert.equal(planTouchesSystemState({ riskEnvelope: { scopes: ["network-stack"] } }), true);
assert.equal(planTouchesSystemState({ riskEnvelope: { level: "high" } }), true);
assert.equal(planTouchesSystemState({ steps: [{ irreversible: true }] }), true);
assert.equal(planTouchesSystemState({ steps: [{ rebootRequired: true }] }), true);
assert.equal(planTouchesSystemState({ riskEnvelope: { scopes: ["app-restart"] }, steps: [{}] }), false, "app-only plan -> no checkpoint");
assert.equal(planTouchesSystemState({}), false, "unknown -> false");

// 3 — isThrottled: inside 24h -> true; at/after 24h -> false; unknown/never -> false; future clock -> false.
assert.equal(isThrottled(NOW - 1 * HOUR, NOW), true, "1h ago -> throttled");
assert.equal(isThrottled(NOW - 23 * HOUR, NOW), true, "23h ago -> still throttled");
assert.equal(isThrottled(NOW - 25 * HOUR, NOW), false, "25h ago -> free to checkpoint");
assert.equal(isThrottled(NOW - 24 * HOUR, NOW), false, "exactly 24h -> boundary is free");
assert.equal(isThrottled(0, NOW), false, "never checkpointed -> not throttled");
assert.equal(isThrottled(NaN, NOW), false);
assert.equal(isThrottled(NOW + HOUR, NOW), false, "future timestamp -> not throttled");

// 4 — sequenceOf + verifyCreated (OUTCOME verification, the anti-false-positive core).
assert.equal(sequenceOf("12\n13\n14"), 14, "highest sequence number");
assert.equal(sequenceOf(""), null, "no points -> null, never 0-as-success");
assert.equal(sequenceOf("   "), null);
assert.equal(verifyCreated(14, 15), true, "sequence increased -> created");
assert.equal(verifyCreated(14, 14), false, "unchanged (silent no-op) -> NOT created");
assert.equal(verifyCreated(14, null), false, "can't see a point -> not proven");
assert.equal(verifyCreated(null, 1), true, "none before, one now -> created");

// 5 — buildRevertOffer: verified -> one-click, NEVER auto; unverified -> unavailable (real-or-empty).
{
  const offer = buildRevertOffer({ created: true, sequenceNumber: 42 });
  assert.equal(offer.available, true);
  assert.equal(offer.auto, false, "revert is NEVER automatic");
  assert.equal(offer.oneClick, true);
  assert.equal(offer.sequenceNumber, 42);
  assert.ok(/Restore-Computer -RestorePoint 42/.test(offer.command));
  const none = buildRevertOffer({ created: false });
  assert.equal(none.available, false);
  assert.equal(none.auto, false);
  assert.equal(none.sequenceNumber, null);
}

// 6 — ensureRestorePoint end to end, verified creation.
{
  const { run, calls } = fakeRunner({ listBefore: "10\n11", listAfter: "10\n11\n12" });
  const r = await ensureRestorePoint({ plan: sysPlan, lastCheckpointTs: 0, now: NOW, run });
  assert.equal(r.status, "created");
  assert.equal(r.created, true);
  assert.equal(r.protection, PROTECTION.RESTORE_POINT);
  assert.equal(r.sequenceNumber, 12);
  assert.equal(r.degraded, false);
  assert.equal(r.revert.available, true);
  assert.equal(r.revert.auto, false, "even a real checkpoint is only ever reverted on a user click");
  assert.ok(calls().includes(RESTORE_COMMANDS.create), "it actually asked for the checkpoint");
  assert.ok(/one click/i.test(r.planCardLine));
}

// 7 — silent no-op (sequence unchanged) -> honest journal-only degrade, NO fabricated id.
{
  const { run } = fakeRunner({ listBefore: "10\n11", listAfter: "10\n11" });
  const r = await ensureRestorePoint({ plan: sysPlan, lastCheckpointTs: 0, now: NOW, run });
  assert.equal(r.status, "unverified-degraded");
  assert.equal(r.created, false);
  assert.equal(r.protection, PROTECTION.JOURNAL_ONLY);
  assert.equal(r.degraded, true);
  assert.equal(r.sequenceNumber, undefined, "no fabricated restore-point id");
  assert.equal(r.revert.available, false);
  assert.ok(/step-by-step rollback/i.test(r.planCardLine));
}

// 8 — throttled (inside 24h): degrade UP FRONT and do NOT even spawn.
{
  const { run, calls } = fakeRunner({ listBefore: "10", listAfter: "10\n11" });
  const r = await ensureRestorePoint({ plan: sysPlan, lastCheckpointTs: NOW - 2 * HOUR, now: NOW, run });
  assert.equal(r.status, "throttled-degraded");
  assert.equal(r.created, false);
  assert.equal(r.protection, PROTECTION.JOURNAL_ONLY);
  assert.equal(r.throttled, true);
  assert.equal(calls().length, 0, "throttled -> never spawns (Windows would silently no-op)");
  assert.ok(/24h/i.test(r.planCardLine));
}

// 9 — guard ordering: R11 blocked > kill-switch > not-required > dry-run > throttle.
{
  // R11: an off-limits plan id/title is blocked before ANY runner call.
  const blockedCalls = [];
  const blockRun = async (c) => { blockedCalls.push(c); return { stdout: "1", exitCode: 0 }; };
  const rB = await ensureRestorePoint({ plan: { id: "C:/Private pics and Vids/x", title: "t", riskEnvelope: { systemState: true } }, now: NOW, run: blockRun });
  assert.equal(rB.status, "blocked");
  assert.equal(rB.created, false);
  assert.equal(blockedCalls.length, 0, "R11 blocks before any spawn");
  assert.ok(rB.surfaced, "R11 surface reported");

  // kill-switch beats a valid system plan.
  const rK = await ensureRestorePoint({ plan: sysPlan, isKilled: true, now: NOW, run: async () => ({ stdout: "1", exitCode: 0 }) });
  assert.equal(rK.status, "aborted");
  assert.equal(rK.created, false);

  // not system-touching -> not-required (journal-only baseline), not a degrade.
  const rN = await ensureRestorePoint({ plan: { id: "zoom-restart", riskEnvelope: { scopes: ["app-restart"] } }, now: NOW });
  assert.equal(rN.status, "not-required");
  assert.equal(rN.degraded, false);
  assert.equal(rN.protection, PROTECTION.JOURNAL_ONLY);

  // dry-run wins over a real checkpoint attempt: never claims one.
  const dryCalls = [];
  const rD = await ensureRestorePoint({ plan: sysPlan, dryRun: true, now: NOW, run: async (c) => { dryCalls.push(c); return { stdout: "1", exitCode: 0 }; } });
  assert.equal(rD.status, "dry-run");
  assert.equal(rD.created, false);
  assert.equal(dryCalls.length, 0, "dry-run never spawns a checkpoint");
}

// 10 — no runner at all -> honest unverified-degrade, never a claimed checkpoint.
{
  const r = await ensureRestorePoint({ plan: sysPlan, lastCheckpointTs: 0, now: NOW });
  assert.equal(r.status, "unverified-degraded");
  assert.equal(r.created, false);
  assert.equal(r.protection, PROTECTION.JOURNAL_ONLY);
}

// 11 — planCardLine is always a non-empty honest string for every status (no blank UI).
for (const s of RESTORE_STATUS) {
  const line = planCardLine(s, { sequenceNumber: 7 });
  assert.ok(typeof line === "string" && line.length > 0, `plan-card line present for ${s}`);
}

console.log("restore-point test passed (outcome-verified creation · silent-no-op + throttle degrade to journal-only · no fabricated id · R11>kill>not-required>dry-run>throttle order · revert never automatic · content-blind).");
