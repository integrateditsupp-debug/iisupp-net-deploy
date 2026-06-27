// STAGE 7 × Tier-0 — validate a REAL recipe through the prove-before-prod gate before it can
// auto-apply. The PowerShell runner is injected (a stateful fake service), so the Windows-Update
// recipe is logic-validated, applied, read-back-verified, and rolled-back-on-failure with no spawn.
// This is the "validate the Windows-Update-stopped recipe before it auto-applies" deliverable.
import assert from "node:assert/strict";
import { runTier0WithStage7 } from "../src/shared/stage7-tier0.mjs";
import { VERDICT } from "../src/shared/sandbox-validate.mjs";

// Stateful fake: Restart-Service sets status; Get-Service reports it; Start-Service (rollback) recovers.
function svcRun({ start = "Stopped", afterRestart = "Running", restartExit = 0, afterRollback = "Running", calls } = {}) {
  let status = start;
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/^Restart-Service/i.test(c)) { status = afterRestart; return { stdout: status, stderr: "", exitCode: restartExit }; }
    if (/^Start-Service/i.test(c)) { status = afterRollback; return { stdout: status, stderr: "", exitCode: 0 }; }
    if (/Get-Service/i.test(c)) return { stdout: status + "\r\n", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

// 1 — Windows-Update service STOPPED → Stage 7 logic-validates, applies, verifies healthy. APPLIED.
{
  const calls = [];
  const { gate, applyResult } = await runTier0WithStage7("restart-windows-update", { run: svcRun({ start: "Stopped", afterRestart: "Running", calls }) });
  assert.equal(gate.verdict, VERDICT.APPLIED);
  assert.equal(gate.validation, "logic-validated");
  assert.equal(applyResult.outcome, "success");
  // Preflight dry-run ran BEFORE any real Restart-Service (prove-before-prod ordering).
  assert.ok(gate.stages.includes("preflight"));
  assert.ok(gate.events.find((e) => e.stage === "preflight" && e.status === "pass"));
}

// 2 — Already running → no-op-neutral, still a clean APPLIED (nothing harmful done).
{
  const { gate } = await runTier0WithStage7("restart-windows-update", { run: svcRun({ start: "Running", afterRestart: "Running" }) });
  assert.ok(gate.verdict === VERDICT.APPLIED || gate.verdict === VERDICT.APPLIED_UNVERIFIED);
}

// 3 — Restart leaves it STOPPED (induced failure) → readback sees damage → ROLLED_BACK; executeTier0
//     recovered the service via Start-Service, reported honestly.
{
  const calls = [];
  const { gate, applyResult } = await runTier0WithStage7("restart-windows-update", { run: svcRun({ start: "Stopped", afterRestart: "Stopped", afterRollback: "Running", calls }) });
  assert.equal(applyResult.outcome, "fail");
  assert.equal(gate.verdict, VERDICT.ROLLED_BACK);
  assert.ok(calls.some((c) => /^Start-Service/i.test(c)), "a failed fix must trigger a rollback Start-Service");
}

// 4 — UNBOUND / unknown recipe → preflight dry-run is not 'dry-run' → REJECTED, prod NEVER touched.
{
  const calls = [];
  const { gate, applyResult } = await runTier0WithStage7("totally-unknown-recipe", { run: svcRun({ calls }) });
  assert.equal(gate.verdict, VERDICT.REJECTED_PREFLIGHT);
  assert.equal(gate.prodTouched, false);
  assert.equal(applyResult, null, "an unbound recipe must never reach executeTier0's real apply");
  assert.ok(!calls.some((c) => /^Restart-Service/i.test(c)), "no Restart-Service may run for a rejected recipe");
}

// 5 — Dry-run preflight is read-only: in cases 1–3 the FIRST executor call is a Get-Service probe (PRE),
//     never a Restart before the gate cleared it.
{
  const calls = [];
  await runTier0WithStage7("restart-windows-update", { run: svcRun({ start: "Stopped", calls }) });
  const firstRestart = calls.findIndex((c) => /^Restart-Service/i.test(c));
  const firstGet = calls.findIndex((c) => /Get-Service/i.test(c));
  assert.ok(firstGet !== -1 && firstGet < firstRestart, "a read-only probe precedes any real restart");
}

console.log("stage7-tier0 recipe-validation test passed (Windows-Update logic-validated before apply; unbound rejected; failure rolled back).");
