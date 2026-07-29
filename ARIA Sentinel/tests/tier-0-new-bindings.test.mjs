// STAGE 3 S2 (brain-audit F5) — the two bindings the reasoner already recommended but could not run:
// clear-print-queue and reset-network-stack. This suite locks the honesty rules that make them safe:
//   · a queue that was already empty is a NO-OP, never a "fix"
//   · a reboot-requiring stack reset can NEVER report success before the reboot ("reboot-pending")
//   · dry-run describes and never spawns the remediation command
//   · a one-way step says "no rollback applicable", it never implies a recovery it cannot perform
//   · the original 5 bindings still behave byte-identically
// Pure — nothing spawns; `run` is injected everywhere.
import assert from "node:assert/strict";
import { executeTier0, resolveExecutorId, validateTier0Command, TIER0_COMMANDS, TIER0_EXECUTOR_IDS, S2_EXEC_ALLOWED } from "../src/main/tier-0-executor.mjs";
import { isBlockedPath } from "../src/shared/path-guard.mjs";
import { recipes } from "../src/main/recipes/tier-0/catalog.mjs";

// 1 — both bindings exist, resolve, and are allowlisted (command AND probe).
for (const id of ["clear-print-queue", "reset-network-stack"]) {
  assert.equal(resolveExecutorId(id), id, `${id} resolves to a live binding`);
  assert.ok(validateTier0Command(TIER0_COMMANDS[id].command), `${id} command allowlisted`);
  assert.ok(validateTier0Command(TIER0_COMMANDS[id].probe), `${id} probe allowlisted`);
  assert.equal(isBlockedPath(TIER0_COMMANDS[id].command), false, `${id} command is R11-clean`);
  assert.equal(isBlockedPath(TIER0_COMMANDS[id].probe), false, `${id} probe is R11-clean`);
}
// clear-print-queue is also in the SIGNED catalog — the supervisor only approves ids it can see there.
assert.ok(recipes["clear-print-queue"], "clear-print-queue is a signed catalog recipe");
assert.equal(recipes["clear-print-queue"].requiresConfirm, true);
assert.equal(recipes["clear-print-queue"].deletesUserData, false, "spool jobs are not user documents");
assert.ok(S2_EXEC_ALLOWED.includes("Remove-PrintJob") && S2_EXEC_ALLOWED.includes("Checkpoint-Computer"));

// A command outside both allowlists is still rejected (the additive tokens widened nothing else).
assert.equal(validateTier0Command("Set-MpPreference -DisableRealtimeMonitoring $true"), false);
assert.equal(validateTier0Command("Format-Volume -DriveLetter C"), false);

// --- injected runners -------------------------------------------------------
function queueRun({ before, after, exit = 0, calls = null }) {
  let n = before;
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/Measure-Object/i.test(c)) return { stdout: String(n), stderr: "", exitCode: 0 };
    if (/Remove-PrintJob/i.test(c)) { if (exit === 0) n = after; return { stdout: "", stderr: "", exitCode: exit }; }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}
function netRun({ exit = 0, calls = null } = {}) {
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/Get-Service Dnscache/i.test(c)) return { stdout: "Running", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: exit };
  };
}

// 2 — clear-print-queue: 3 stuck jobs → 0 = a real fix.
let r = await executeTier0("clear-print-queue", { run: queueRun({ before: 3, after: 0 }) });
assert.equal(r.outcome, "success");
assert.equal(r.before, 3);
assert.equal(r.after, 0);

// 3 — already empty → NO-OP-NEUTRAL. An empty queue is not something we fixed.
r = await executeTier0("clear-print-queue", { run: queueRun({ before: 0, after: 0 }) });
assert.equal(r.outcome, "no-op-neutral");
assert.match(r.message, /No change needed/i);

// 4 — jobs still stuck afterwards → fail, and the rollback is HONEST about being one-way.
r = await executeTier0("clear-print-queue", { run: queueRun({ before: 3, after: 2 }) });
assert.equal(r.outcome, "fail");
const rb = r.events.find((e) => e.event === "TIER0.ROLLBACK");
assert.ok(rb, "a rollback event is emitted");
assert.match(rb.text, /one-way/i);
assert.equal(rb.recovered, false);
assert.doesNotMatch(rb.text, /recovered/i, "never implies a recovery it cannot perform");

// 5 — dry-run: describes, never spawns the remediation command, never claims success.
let calls = [];
r = await executeTier0("clear-print-queue", { dryRun: true, run: queueRun({ before: 3, after: 0, calls }) });
assert.equal(r.outcome, "dry-run");
assert.notEqual(r.outcome, "success");
assert.equal(calls.some((c) => /Remove-PrintJob/i.test(c)), false, "dry-run never runs the removal");

// 6 — reset-network-stack: exit 0 is REBOOT-PENDING, never success (Rule 14: nothing is fixed yet).
calls = [];
r = await executeTier0("reset-network-stack", { run: netRun({ calls }) });
assert.equal(r.outcome, "reboot-pending");
assert.notEqual(r.outcome, "success");
assert.equal(r.requiresReboot, true);
assert.match(r.message, /reboot is required/i);
assert.doesNotMatch(r.message, /recovered/i);
assert.ok(calls.some((c) => /netsh winsock reset/i.test(c)), "the reset actually ran");
assert.ok(r.events.some((e) => e.rebootPending === true), "reboot-pending is journaled at TIER0.POST");

// 7 — a failed reset is a plain failure (never reboot-pending).
r = await executeTier0("reset-network-stack", { run: netRun({ exit: 1 }) });
assert.equal(r.outcome, "fail");

// 8 — dry-run on the reboot-requiring binding also never claims anything.
calls = [];
r = await executeTier0("reset-network-stack", { dryRun: true, run: netRun({ calls }) });
assert.equal(r.outcome, "dry-run");
assert.equal(calls.some((c) => /winsock/i.test(c)), false);

// 9 — regression: the original 5 bindings are untouched in behaviour and id order.
assert.deepEqual(
  TIER0_EXECUTOR_IDS.filter((id) => !["clear-print-queue", "reset-network-stack"].includes(id)),
  ["restart-print-spooler", "restart-windows-update", "flush-dns-cache", "restart-bluetooth", "restart-audio"]
);
const svcRun = ({ start, afterRestart }) => {
  let st = start;
  return async (cmd) => {
    const c = String(cmd);
    if (/Restart-Service/i.test(c)) { st = afterRestart; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-Service/i.test(c)) return { stdout: st, stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
};
r = await executeTier0("restart-print-spooler", { run: svcRun({ start: "Stopped", afterRestart: "Running" }) });
assert.equal(r.outcome, "success");
r = await executeTier0("restart-audio", { run: svcRun({ start: "Running", afterRestart: "Running" }) });
assert.equal(r.outcome, "no-op-neutral");

console.log("tier-0-new-bindings test passed (F5 bindings live · empty queue is a no-op · reset is reboot-pending never success · dry-run spawns nothing · one-way rollback honest · original 5 unchanged).");
