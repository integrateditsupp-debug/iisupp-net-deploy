// STAGE 7 — prove-before-prod gate. Every executor is injected (a stateful fake), so good-fix /
// bad-fix / induced-damage / blocked-side-effect / failed-snapshot / sandbox-reject all run with no
// spawning. The three goal guarantees are asserted explicitly: a bad fix is caught in validation and
// NEVER reaches prod (apply uncalled); a good fix applies + verifies; an induced failure rolls back.
import assert from "node:assert/strict";
import { validateThenApply, validateBatch, VERDICT } from "../src/shared/sandbox-validate.mjs";

// A spying executor set with sensible green defaults; each call is recorded so we can assert order
// and prove that prod (apply) was/was not reached.
function rig(overrides = {}) {
  const calls = [];
  const track = (name, fn) => (...a) => { calls.push(name); return fn(...a); };
  const ex = {
    dryRun: track("dryRun", overrides.dryRun || (async () => ({ ok: true, wouldApply: true }))),
    sideEffectScan: track("sideEffectScan", overrides.sideEffectScan || (async () => ({ ok: true, blocked: false, findings: [] }))),
    snapshot: track("snapshot", overrides.snapshot || (async () => ({ ok: true, token: "rp-1" }))),
    apply: track("apply", overrides.apply || (async () => ({ ok: true }))),
    readback: track("readback", overrides.readback || (async () => ({ ok: true, healthy: true, damaged: false }))),
    rollback: track("rollback", overrides.rollback || (async () => ({ ok: true, recovered: true })))
  };
  if (overrides.sandbox) ex.sandbox = track("sandbox", overrides.sandbox);
  return { ex, calls };
}

// ── GUARANTEE 1 — a bad fix is caught in validation and NEVER reaches prod ────────────────────
// 1a — preflight (logic) rejection: dryRun says it would not apply.
{
  const { ex, calls } = rig({ dryRun: async () => ({ ok: true, wouldApply: false, reason: "missing precondition" }) });
  const r = await validateThenApply({ id: "fix-bad-logic" }, ex);
  assert.equal(r.verdict, VERDICT.REJECTED_PREFLIGHT);
  assert.equal(r.applied, false);
  assert.equal(r.prodTouched, false, "prod must be untouched on preflight reject");
  assert.ok(!calls.includes("apply"), "apply() must never be called for a preflight-rejected fix");
  assert.equal(r.validation, "logic-validated");
  assert.match(r.userMessage, /left (your system )?unchanged|unchanged/i);
}
// 1b — side-effect scan blocks a destructive out-of-scope command.
{
  const { ex, calls } = rig({ sideEffectScan: async () => ({ ok: true, blocked: true, findings: ["writes outside declared scope: format-volume"] }) });
  const r = await validateThenApply({ id: "fix-bad-sideeffect" }, ex);
  assert.equal(r.verdict, VERDICT.REJECTED_SIDE_EFFECT);
  assert.equal(r.prodTouched, false);
  assert.ok(!calls.includes("apply"), "apply() must not run when the side-effect scan blocks");
}
// 1c — a throwing dryRun is treated as a rejection (fail-closed), prod untouched.
{
  const { ex, calls } = rig({ dryRun: async () => { throw new Error("preflight blew up"); } });
  const r = await validateThenApply({ id: "fix-throws" }, ex);
  assert.equal(r.verdict, VERDICT.REJECTED_PREFLIGHT);
  assert.ok(!calls.includes("apply"));
}

// ── GUARANTEE 2 — a good fix applies + verifies ───────────────────────────────────────────────
{
  const { ex, calls } = rig();
  const r = await validateThenApply({ id: "fix-good", requiresSnapshot: true }, ex);
  assert.equal(r.verdict, VERDICT.APPLIED);
  assert.equal(r.applied, true);
  assert.equal(r.prodTouched, true);
  assert.equal(r.rolledBack, false);
  assert.equal(r.userMessage, "Resolved.");
  // Full pipeline order, gates before apply, readback after.
  assert.deepEqual(calls, ["dryRun", "sideEffectScan", "snapshot", "apply", "readback"]);
  assert.equal(r.validation, "logic-validated", "no sandbox ran → honest logic-validated label");
}

// ── GUARANTEE 3 — an induced failure rolls back ───────────────────────────────────────────────
// 3a — readback reports damage → rollback attempted + recovered.
{
  const { ex, calls } = rig({ readback: async () => ({ ok: false, healthy: false, damaged: true }) });
  const r = await validateThenApply({ id: "fix-damages" }, ex);
  assert.equal(r.verdict, VERDICT.ROLLED_BACK);
  assert.equal(r.applied, false, "a rolled-back fix is not 'applied' (system is back to baseline)");
  assert.equal(r.rolledBack, true);
  assert.ok(calls.includes("apply") && calls.includes("rollback"), "apply then rollback");
  assert.match(r.userMessage, /reverted|back to how it was|undid/i);
}
// 3b — apply itself errors AND leaves damage → rollback.
{
  const { ex } = rig({
    apply: async () => ({ ok: false, message: "command exited 1" }),
    readback: async () => ({ ok: false, healthy: false, damaged: true })
  });
  const r = await validateThenApply({ id: "fix-apply-error-damage" }, ex);
  assert.equal(r.verdict, VERDICT.ROLLED_BACK);
  assert.equal(r.rolledBack, true);
}
// 3c — rollback that cannot recover is reported honestly (manual), not as success.
{
  const { ex } = rig({
    readback: async () => ({ ok: false, damaged: true }),
    rollback: async () => ({ ok: false, recovered: false })
  });
  const r = await validateThenApply({ id: "fix-damage-norecover" }, ex);
  assert.equal(r.verdict, VERDICT.ROLLED_BACK);
  assert.equal(r.rolledBack, false, "rollback that did not recover must not be reported as recovered");
}

// ── SNAPSHOT GATE — a snapshot-required fix is blocked (not applied) if the restore point fails ─
{
  const { ex, calls } = rig({ snapshot: async () => ({ ok: false }) });
  const r = await validateThenApply({ id: "fix-needs-snap", requiresSnapshot: true }, ex);
  assert.equal(r.verdict, VERDICT.BLOCKED_NO_SNAPSHOT);
  assert.equal(r.prodTouched, false);
  assert.ok(!calls.includes("apply"), "no restore point + requiresSnapshot ⇒ never apply");
}
// A fix that does NOT require a snapshot still applies even if snapshot is skipped/unavailable.
{
  const { ex } = rig({ snapshot: async () => ({ ok: false }) });
  const r = await validateThenApply({ id: "fix-no-snap-needed" }, ex);
  assert.equal(r.verdict, VERDICT.APPLIED);
}

// ── HONEST LABELS — sandbox-validated only when a sandbox actually ran green ───────────────────
// 4a — sandbox mode + green sandbox → "sandbox-validated".
{
  const { ex } = rig({ sandbox: async () => ({ ran: true, ok: true }) });
  const r = await validateThenApply({ id: "fix-sb-pass" }, ex, { mode: "sandbox" });
  assert.equal(r.verdict, VERDICT.APPLIED);
  assert.equal(r.validation, "sandbox-validated");
}
// 4b — sandbox mode but sandbox fails → rejected, prod untouched.
{
  const { ex, calls } = rig({ sandbox: async () => ({ ran: true, ok: false, reason: "fix broke the VM" }) });
  const r = await validateThenApply({ id: "fix-sb-fail" }, ex, { mode: "sandbox" });
  assert.equal(r.verdict, VERDICT.REJECTED_SANDBOX);
  assert.equal(r.prodTouched, false);
  assert.ok(!calls.includes("apply"));
}
// 4c — sandbox mode but no sandbox available → degrade honestly to logic-validated (NOT a false claim).
{
  const { ex } = rig({ sandbox: async () => ({ ran: false }) });
  const r = await validateThenApply({ id: "fix-sb-unavail" }, ex, { mode: "sandbox" });
  assert.equal(r.verdict, VERDICT.APPLIED);
  assert.equal(r.validation, "logic-validated", "no real sandbox run ⇒ must not claim sandbox-validated");
}
// 4d — logic mode never claims sandbox even if a sandbox executor is present.
{
  const { ex, calls } = rig({ sandbox: async () => ({ ran: true, ok: true }) });
  const r = await validateThenApply({ id: "fix-logic-mode" }, ex, { mode: "logic" });
  assert.equal(r.validation, "logic-validated");
  assert.ok(!calls.includes("sandbox"), "logic mode must not invoke the sandbox executor");
}

// ── APPLIED-UNVERIFIED — applied, no damage, but the win could not be confirmed (honest) ───────
{
  const { ex } = rig({ readback: async () => ({ ok: true, healthy: false, damaged: false }) });
  const r = await validateThenApply({ id: "fix-unverified" }, ex);
  assert.equal(r.verdict, VERDICT.APPLIED_UNVERIFIED);
  assert.equal(r.applied, true);
  assert.match(r.userMessage, /couldn't fully confirm|keep watching/i);
}

// ── SILENCE — the user-facing message never leaks internal stage names / commands ──────────────
{
  const { ex } = rig();
  const r = await validateThenApply({ id: "fix-silent" }, ex);
  assert.ok(!/dryRun|sideEffect|snapshot|readback|rollback|powershell/i.test(r.userMessage), "user message must be silent about internals");
  // …but the full trace is still available for the audit log.
  assert.ok(r.events.length >= 4 && Array.isArray(r.stages));
}

// ── BATCH — pass-through helper runs every fix through the same gate ───────────────────────────
{
  const { ex } = rig();
  const out = await validateBatch([{ id: "a" }, { id: "b" }], ex);
  assert.equal(out.length, 2);
  assert.ok(out.every((r) => r.verdict === VERDICT.APPLIED));
}

console.log("sandbox-validate (Stage 7) test suite passed.");
