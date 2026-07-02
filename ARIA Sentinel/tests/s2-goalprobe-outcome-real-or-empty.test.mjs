// STAGE 3 S2 (packet slice 2, audit F2) — goalProbes verify the USER'S OUTCOME, not service state:
// network-recovery succeeds only when a real DNS lookup returns records; print-recovery only when the
// queue is drained + error-free (and its description ADMITS it is not a printed page — honest cut).
// Steps can all succeed and the plan still escalates if the outcome probe fails (real-or-empty).
// Also proves the S2 quality flag stopEarlyOnGoal: the smallest effective hammer wins — when the DNS
// flush alone fixes resolution, the winsock reset is SKIPPED and journaled as skipped.
// Pure + injectable: nothing real spawns.
import assert from "node:assert/strict";
import { executePlan, evaluateProbe } from "../src/main/plan-executor.mjs";
import { PLAYBOOKS, getPlaybook, validateAllPlaybooks } from "../src/main/resolution-playbooks.mjs";

const NOW = 1_770_000_000_000;

// Fleet-style injectable PowerShell: models DNS cache, winsock reset, print queue, services, outcome probes.
function fleetRun(state, calls) {
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    let m;
    if (/flushdns/i.test(c)) { state.dnsCount = 0; if (state.flushFixesResolve) state.resolveCount = 3; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-DnsClientCache/i.test(c)) return { stdout: String(state.dnsCount ?? 50), stderr: "", exitCode: 0 };
    if (/winsock/i.test(c)) { state.winsockRan = true; if (state.resetFixesResolve) state.resolveCount = 3; return { stdout: "reset", stderr: "", exitCode: 0 }; }
    if (/Get-NetAdapter/i.test(c)) return { stdout: String(state.adapters ?? 1), stderr: "", exitCode: 0 };
    if (/Resolve-DnsName/i.test(c)) return { stdout: String(state.resolveCount ?? 0), stderr: "", exitCode: (state.resolveCount ?? 0) > 0 ? 0 : 1 };
    if (/Test-NetConnection/i.test(c)) return { stdout: (state.tcp443 ?? true) ? "True" : "False", stderr: "", exitCode: 0 };
    if (/JobStatus/i.test(c)) return { stdout: String(state.errorJobs ?? 0), stderr: "", exitCode: 0 }; // goal probe: stuck/errored jobs
    if (/Remove-PrintJob/i.test(c)) { state.jobs = 0; state.errorJobs = 0; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-PrintJob/i.test(c)) return { stdout: String(state.jobs ?? 0), stderr: "", exitCode: 0 };
    if ((m = c.match(/^Restart-Service (\w+)/i))) { state[m[1]] = "Running"; return { stdout: "Running", stderr: "", exitCode: 0 }; }
    if ((m = c.match(/^Start-Service (\w+)/i))) { state[m[1]] = "Running"; return { stdout: "", stderr: "", exitCode: 0 }; }
    if ((m = c.match(/Get-Service (\w+)/i))) return { stdout: String(state[m[1]] || "Running") + "\r\n", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}
const ctx = (state, calls, extra = {}) => ({
  mode: "confirmed", now: () => NOW, run: fleetRun(state, calls),
  confirmPlan: async () => true, countdownGate: async () => true, history: [],
  ...extra
});

// 0 — schema: every upgraded playbook still validates against live bindings; new interprets are legal.
{
  const v = validateAllPlaybooks();
  for (const [id, r] of Object.entries(v)) assert.deepEqual(r.errors, [], `${id} validates`);
  assert.equal(PLAYBOOKS["network-recovery"].steps.length, 2, "network-recovery is now a true multi-step plan");
  assert.deepEqual(PLAYBOOKS["network-recovery"].steps.map((s) => s.recipeId), ["flush-dns", "reset-network-stack"]);
  assert.deepEqual(PLAYBOOKS["print-recovery"].steps.map((s) => s.recipeId), ["clear-print-queue", "restart-print-spooler"]);
  assert.match(PLAYBOOKS["network-recovery"].goalProbe.command, /Resolve-DnsName/, "network goal = real DNS lookup");
  assert.equal(PLAYBOOKS["network-recovery"].goalProbe.interpret, "count-positive");
  assert.equal(PLAYBOOKS["network-recovery"].riskEnvelope.touchesSystemState, true, "winsock reset honestly declares system state");
  assert.equal(PLAYBOOKS["print-recovery"].goalProbe.interpret, "count-zero");
  assert.match(PLAYBOOKS["print-recovery"].goalProbe.description, /NOT prove a page physically printed/i, "print goal admits the honest cut");
  assert.match(PLAYBOOKS["audio-recovery"].goalProbe.command, /Win32_SoundDevice/, "audio goal = device-level");
}

// 1 — evaluateProbe new interprets are real-or-empty: empty/garbage NEVER passes.
assert.equal(evaluateProbe({ interpret: "count-zero" }, "0"), true);
assert.equal(evaluateProbe({ interpret: "count-zero" }, "3"), false);
assert.equal(evaluateProbe({ interpret: "count-zero" }, ""), false, "no evidence ≠ zero");
assert.equal(evaluateProbe({ interpret: "count-zero" }, "banana"), false);
assert.equal(evaluateProbe({ interpret: "boolean-true" }, "True"), true);
assert.equal(evaluateProbe({ interpret: "boolean-true" }, "WARNING: x\r\nTrue"), true, "last line wins");
assert.equal(evaluateProbe({ interpret: "boolean-true" }, "False"), false);
assert.equal(evaluateProbe({ interpret: "boolean-true" }, ""), false);
assert.equal(evaluateProbe({ interpret: "boolean-true" }, "truthy"), false);

// 2 — THE F2 CORE: every step succeeds (service state fine) but the user's problem is NOT gone
// (DNS still doesn't resolve) → the plan escalates. Step completion never declares success.
{
  const state = { dnsCount: 50, resolveCount: 0, tcp443: true };
  const res = await executePlan(getPlaybook("network-recovery"), ctx(state));
  assert.equal(res.outcome, "escalated", "steps green + outcome red = escalated, never resolved");
  const esc = res.journal.find((e) => e.event === "PLAN.ESCALATED");
  assert.ok(esc && esc.extra && esc.extra.code === "GOAL_PROBE_FAILED");
  assert.equal(state.winsockRan, true, "both steps really ran before the honest escalation");
  assert.equal(res.journal.some((e) => e.event === "PLAN.RESOLVED"), false);
}

// 3 — outcome probe passes only after the deep fix → resolved with real evidence.
{
  const state = { dnsCount: 50, resolveCount: 0, resetFixesResolve: true };
  const res = await executePlan(getPlaybook("network-recovery"), ctx(state));
  assert.equal(res.outcome, "resolved");
  assert.equal(res.evidence, "3", "evidence is the probe's real output");
  assert.ok(res.journal.some((e) => e.event === "PLAN.RESOLVED" && !e.extra.earlyExit));
}

// 4 — stopEarlyOnGoal: the flush alone fixes resolution → the winsock reset is SKIPPED and the
// journal says so. Smallest effective hammer, honestly recorded.
{
  const state = { dnsCount: 50, resolveCount: 0, flushFixesResolve: true };
  const calls = [];
  const res = await executePlan(getPlaybook("network-recovery"), ctx(state, calls));
  assert.equal(res.outcome, "resolved");
  assert.equal(calls.some((c) => /winsock/i.test(c)), false, "bigger hammer never ran");
  const early = res.journal.find((e) => e.event === "PLAN.RESOLVED");
  assert.ok(early && early.extra.earlyExit === true && early.extra.stepsSkipped === 1);
}

// 5 — NO-OP-NEUTRAL is never a fix: queue already empty + spooler already Running → goal passes but
// nothing changed → "already-healthy", explicitly NOT an ARIA fix.
{
  const state = { jobs: 0, errorJobs: 0, Spooler: "Running" };
  const res = await executePlan(getPlaybook("print-recovery"), ctx(state));
  assert.equal(res.outcome, "already-healthy");
  const done = res.journal.find((e) => e.event === "PLAN.RESOLVED");
  assert.ok(done && done.extra.noChange === true, "journal records no-change honesty");
}

// 6 — real print fix: stuck queue drained + spooler restarted → resolved on the outcome probe.
{
  const state = { jobs: 4, errorJobs: 2, Spooler: "Stopped" };
  const res = await executePlan(getPlaybook("print-recovery"), ctx(state));
  assert.equal(res.outcome, "resolved");
}

// 7 — dry-run on a multi-step playbook never claims success and never spawns remediation.
{
  const state = { dnsCount: 50, resolveCount: 3 };
  const calls = [];
  const res = await executePlan(getPlaybook("network-recovery"), ctx(state, calls, { dryRunCheckbox: true }));
  assert.equal(res.outcome, "dry-run");
  assert.equal(calls.some((c) => /winsock|flushdns/i.test(c)), false, "no remediation spawned in dry-run");
  assert.equal(res.journal.some((e) => e.event === "PLAN.RESOLVED"), false);
}

// 8 — kill-switch mid-plan on the real multi-step playbook: aborts before the next step, rollback
// path engages (one-way flush journals its honest no-rollback), nothing resolves.
{
  const state = { dnsCount: 50, resolveCount: 0 };
  let kill = false;
  const run = fleetRun(state); const wrapped = async (c) => { const r = await run(c); if (/flushdns/i.test(c)) kill = true; return r; };
  const res = await executePlan(getPlaybook("network-recovery"), { ...ctx(state), run: wrapped, isKilled: () => kill });
  assert.equal(res.outcome, "aborted");
  const ab = res.journal.find((e) => e.event === "PLAN.ABORTED");
  assert.ok(ab && ab.extra.code === "KILL_SWITCH");
  assert.equal(state.winsockRan, undefined, "the bigger hammer never ran after the kill");
}

console.log("s2-goalprobe-outcome-real-or-empty test passed (outcome ≠ service state · early-exit smallest hammer · no-op never a fix · dry-run + kill honest on multi-step).");
