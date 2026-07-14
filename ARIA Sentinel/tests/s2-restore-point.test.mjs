// STAGE 3 S2 — RESTORE POINTS (throttle-aware, honest degrade). Proves: a checkpoint is only attempted
// for plans that touch system state · Windows' 1-per-24h throttle and a disabled System Restore both
// DEGRADE HONESTLY to journal-only rollback (and the plan card SAYS so before the user confirms) · a
// checkpoint is only claimed when the restore-point list actually GREW (exit 0 is not proof) · the
// REVERT is never automatic — no agent path can execute Restore-Computer (it is on the deny list).
// Pure + injectable — nothing spawns.
import assert from "node:assert/strict";
import {
  planRestorePoint, createRestorePoint, rollbackPosture, checkpointDescription,
  RESTORE_THROTTLE_MS, RESTORE_POINT_PROBE
} from "../src/main/restore-point.mjs";
import { validateTier0Command } from "../src/main/tier-0-executor.mjs";
import { executePlan } from "../src/main/plan-executor.mjs";

const T0 = 1_760_000_000_000;
const sysPlan = (over = {}) => ({
  id: "network-recovery-test", title: "network recovery", trigger: { kind: "detector-cluster", detail: "net" },
  steps: [{ recipeId: "flush-dns", risk: "low", expectedImpact: [], onFail: "escalate" }],
  goalProbe: { command: "(Get-DnsClientCache | Measure-Object).Count", interpret: "count-positive", description: "dns cache repopulates" },
  riskEnvelope: { level: "medium", touchesSystemState: true }, rollbackPolicy: "reverse-order", ...over
});

// 1 — no system-state change → no restore point is even attempted (we don't checkpoint for nothing).
{
  const d = planRestorePoint({ plan: sysPlan({ riskEnvelope: { level: "low", touchesSystemState: false } }), now: T0 });
  assert.equal(d.decision, "not-needed");
  assert.equal(d.protected, false);
  assert.match(d.planCardLine, /rolled back individually/i);
}

// 2 — system-state plan, no recent checkpoint → create one, and say so up front.
{
  const d = planRestorePoint({ plan: sysPlan(), lastRestorePointAt: 0, now: T0 });
  assert.equal(d.decision, "create");
  assert.equal(d.protected, true);
  assert.match(d.planCardLine, /restore point before I touch anything/i);
}

// 3 — Windows' 24h throttle → journal-only, stated honestly BEFORE consent (never a silent downgrade).
{
  const d = planRestorePoint({ plan: sysPlan(), lastRestorePointAt: T0 - 3600000, now: T0 });
  assert.equal(d.decision, "journal-only");
  assert.equal(d.protected, false);
  assert.match(d.planCardLine, /one restore point every 24h/i);
  assert.match(d.planCardLine, /no system-wide undo/i);
  // just past the throttle → allowed again.
  assert.equal(planRestorePoint({ plan: sysPlan(), lastRestorePointAt: T0 - RESTORE_THROTTLE_MS - 1, now: T0 }).decision, "create");
}

// 4 — System Restore switched off → journal-only + honest explanation, never a fake checkpoint.
{
  const d = planRestorePoint({ plan: sysPlan(), systemRestoreEnabled: false, now: T0 });
  assert.equal(d.decision, "journal-only");
  assert.match(d.planCardLine, /System Restore is turned off/i);
}
// 4b — dry-run previews never create a checkpoint.
assert.equal(planRestorePoint({ plan: sysPlan(), dryRun: true, now: T0 }).decision, "not-needed");

// 5 — creation is PROVEN, not assumed: exit 0 with an unchanged restore-point count = NOT created.
{
  const runNoGrow = async (cmd) => (String(cmd).includes("Get-ComputerRestorePoint")
    ? { stdout: "4", stderr: "", exitCode: 0 }
    : { stdout: "", stderr: "", exitCode: 0 });
  const r = await createRestorePoint({ planId: "network-recovery-test", run: runNoGrow, now: T0 });
  assert.equal(r.created, false, "exit 0 alone never proves a checkpoint");
  assert.equal(r.degraded, true);
  assert.equal(r.reason, "checkpoint-not-verified");
  assert.equal(r.revertOffer, null);
  assert.match(r.planCardLine, /journal-only rollback/i);
}
// 5b — the list actually grows → created, with a USER-CLICK revert offer (never automatic).
{
  let count = 4;
  const run = async (cmd) => {
    const c = String(cmd);
    if (c.includes("Get-ComputerRestorePoint")) return { stdout: String(count), stderr: "", exitCode: 0 };
    if (c.startsWith("Checkpoint-Computer")) { count += 1; return { stdout: "", stderr: "", exitCode: 0 }; }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const r = await createRestorePoint({ planId: "network-recovery-test", run, now: T0 });
  assert.equal(r.created, true);
  assert.equal(r.before, 4);
  assert.equal(r.after, 5);
  assert.equal(r.revertOffer.automatic, false, "a revert is OFFERED to the user — never fired by an agent");
  assert.equal(r.revertOffer.requiresUser, true);
  assert.match(r.revertOffer.userAction, /System Restore/i);
  assert.equal(rollbackPosture({ plan: sysPlan(), restorePoint: r }).protectedBySnapshot, true);
}
// 5c — a throwing runner degrades honestly instead of crashing the plan.
{
  const r = await createRestorePoint({ planId: "x", run: async () => { throw new Error("powershell gone"); }, now: T0 });
  assert.equal(r.created, false);
  assert.equal(r.degraded, true);
}

// 6 — SAFETY: the checkpoint command is allowlisted; the REVERT is denied at the executor boundary.
assert.equal(validateTier0Command(`Checkpoint-Computer -Description "${checkpointDescription("x")}" -RestorePointType MODIFY_SETTINGS`), true);
assert.equal(validateTier0Command(RESTORE_POINT_PROBE), true);
assert.equal(validateTier0Command("Restore-Computer -RestorePoint 5"), false, "an agent can NEVER revert the machine");
assert.equal(validateTier0Command("Disable-ComputerRestore -Drive C:\\"), false, "and can never turn System Restore off");
// 🔒 R11 — a blocked reference never spawns a checkpoint.
{
  const r = await createRestorePoint({ planId: "Private pics and Vids", run: async () => ({ stdout: "1", exitCode: 0 }), now: T0 });
  assert.equal(r.created, false);
  assert.equal(r.reason, "R11");
  assert.equal(r.surfaced, "1 personal folder excluded");
}

// 7 — EXECUTOR INTEGRATION: the honest degrade reaches the plan card AND the journal, and the plan
// still runs (a missing checkpoint is never a reason to abandon the user).
{
  const run = async (cmd) => {
    const c = String(cmd);
    if (/Get-DnsClientCache/i.test(c)) return { stdout: "12", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  let card = null;
  const r = await executePlan(sysPlan(), {
    mode: "confirmed", run, now: () => T0,
    lastRestorePointAt: T0 - 3600000,                 // inside Windows' 24h throttle
    confirmPlan: async (payload) => { card = payload; return true; },
    countdownGate: async () => true
  });
  assert.equal(card.restorePoint.decision, "journal-only");
  assert.match(card.restorePoint.planCardLine, /24h/);
  assert.match(card.rollback.line, /journal-only/i);
  const rp = r.journal.find((e) => e.extra && e.extra.restorePoint === true);
  assert.ok(rp, "the honest degrade is journaled");
  assert.equal(rp.extra.created, false);
  assert.equal(rp.extra.degraded, true);
  assert.equal(r.outcome, "resolved", "the plan still runs — it is just not snapshot-protected");
}
// 7b — when a checkpoint IS possible, the card promises it and the journal proves it was made.
{
  let count = 0;
  const run = async (cmd) => {
    const c = String(cmd);
    if (c.includes("Get-ComputerRestorePoint")) return { stdout: String(count), stderr: "", exitCode: 0 };
    if (c.startsWith("Checkpoint-Computer")) { count += 1; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-DnsClientCache/i.test(c)) return { stdout: "12", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const r = await executePlan(sysPlan(), {
    mode: "confirmed", run, now: () => T0, lastRestorePointAt: 0,
    confirmPlan: async () => true, countdownGate: async () => true
  });
  const rp = r.journal.find((e) => e.extra && e.extra.restorePoint === true);
  assert.equal(rp.extra.created, true);
  assert.equal(r.outcome, "resolved");
  assert.equal(r.restorePoint.created, true);
}

console.log("s2-restore-point test passed (system-state only · 24h throttle + disabled restore degrade honestly to journal-only · creation proven by a growing list, never by exit 0 · revert is a user click, Restore-Computer denied · R11 first).");
