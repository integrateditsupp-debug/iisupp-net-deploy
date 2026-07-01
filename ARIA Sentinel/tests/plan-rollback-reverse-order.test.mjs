// STAGE 3 S1 — reverse-order plan rollback: when step N fails with onFail=rollback-plan, the
// completed steps roll back newest-first (N-1 … 0); service steps recover to Running, one-way
// steps (DNS flush) are journaled honestly as "no rollback applicable". Nothing spawns.
import assert from "node:assert/strict";
import { executePlan } from "../src/main/plan-executor.mjs";

const NOW = 1_760_000_000_000;

function fleetRun(state, calls) {
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    let m;
    if ((m = c.match(/^Restart-Service (\w+)/i))) { state[m[1]] = (state.afterRestart && state.afterRestart[m[1]]) || "Running"; return { stdout: state[m[1]], stderr: "", exitCode: 0 }; }
    if ((m = c.match(/^Start-Service (\w+)/i))) { state[m[1]] = (state.afterStart && state.afterStart[m[1]]) || "Running"; return { stdout: "", stderr: "", exitCode: 0 }; }
    if ((m = c.match(/Get-Service (\w+)/i))) return { stdout: String(state[m[1]] || "Running") + "\r\n", stderr: "", exitCode: 0 };
    if (/flushdns/i.test(c)) { state.dnsCount = 0; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-DnsClientCache/i.test(c)) return { stdout: String(state.dnsCount ?? 50), stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

const plan3 = () => ({
  id: "rollback-plan-test",
  title: "dns → audio → spooler",
  trigger: { kind: "user-request", detail: "test" },
  steps: [
    { recipeId: "flush-dns", risk: "low", expectedImpact: [], onFail: "escalate" },
    { recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "rollback-plan" },
    { recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "rollback-plan" }
  ],
  goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});

// 1 — step 3 (spooler) fails: dns + audio completed → rollback order MUST be [step 1, step 0].
{
  const calls = [];
  // Spooler restart leaves the service Stopped → tier-0 classifies FAIL; its own Start-Service
  // recovery also fails (afterStart keeps it Stopped) so the step is a hard fail.
  const state = { Audiosrv: "Stopped", Spooler: "Running", dnsCount: 50, afterRestart: { Spooler: "Stopped", Audiosrv: "Running" }, afterStart: { Spooler: "Stopped", Audiosrv: "Running" } };
  const r = await executePlan(plan3(), {
    mode: "confirmed",
    confirmPlan: async () => true,
    countdownGate: async () => true,
    run: fleetRun(state, calls),
    now: () => NOW
  });
  assert.equal(r.outcome, "escalated");
  const planRollbacks = r.journal.filter((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.planRollback);
  assert.deepEqual(planRollbacks.map((e) => e.stepIndex), [1, 0], "reverse order: newest completed step first");
  assert.match(planRollbacks[0].detail, /recovered AudioSrv/i);
  assert.match(planRollbacks[1].detail, /no rollback applicable/i, "one-way DNS flush is journaled honestly");
  // The tier-0 executor's OWN per-step rollback (Start-Service Spooler) ran before plan rollback.
  const spoolerStart = calls.findIndex((c) => /^Start-Service Spooler/i.test(c));
  const audioStart = calls.findIndex((c) => /^Start-Service Audiosrv/i.test(c));
  assert.ok(spoolerStart !== -1 && audioStart !== -1 && spoolerStart < audioStart, "step-level rollback precedes plan-level reverse rollback");
  const esc = r.journal[r.journal.length - 1];
  assert.equal(esc.event, "PLAN.ESCALATED");
  assert.equal(esc.extra.code, "STEP_FAILED_ROLLED_BACK");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.RESOLVED"));
}

// 2 — retry-once: a flaky step fails once, retries, succeeds → NO rollback, plan continues to resolve.
{
  const calls = [];
  let audioAttempts = 0;
  // afterStart keeps Audiosrv Stopped so the tier-0 internal recovery of attempt 0 does NOT mask
  // the retry: attempt 1 must genuinely take the service Stopped → Running ("success", not no-op).
  const state = { Audiosrv: "Stopped", Spooler: "Running", dnsCount: 50, afterStart: { Audiosrv: "Stopped" } };
  const base = fleetRun(state, calls);
  const run = async (cmd) => {
    if (/^Restart-Service Audiosrv/i.test(String(cmd))) {
      audioAttempts += 1;
      if (audioAttempts === 1) { state.Audiosrv = "Stopped"; return { stdout: "Stopped", stderr: "", exitCode: 1 }; }
    }
    return base(cmd);
  };
  const p = plan3();
  p.steps = [{ recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "retry-once" }];
  p.goalProbe = { command: "(Get-Service Audiosrv).Status", interpret: "service-running", description: "audio running" };
  const r = await executePlan(p, {
    mode: "confirmed",
    confirmPlan: async () => true,
    countdownGate: async () => true,
    run,
    now: () => NOW
  });
  assert.equal(audioAttempts, 2, "exactly one retry");
  assert.equal(r.outcome, "resolved");
  assert.ok(r.journal.some((e) => e.event === "PLAN.STEP.EXEC" && e.extra && e.extra.attempt === 1), "retry attempt journaled");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.planRollback));
}

// 3 — retry-once exhausted → escalate without a false success.
{
  const state = { Audiosrv: "Stopped", afterRestart: { Audiosrv: "Stopped" }, afterStart: { Audiosrv: "Stopped" } };
  const p = plan3();
  p.steps = [{ recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "retry-once" }];
  p.goalProbe = { command: "(Get-Service Audiosrv).Status", interpret: "service-running", description: "audio running" };
  const r = await executePlan(p, { mode: "confirmed", confirmPlan: async () => true, countdownGate: async () => true, run: fleetRun(state), now: () => NOW });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.journal[r.journal.length - 1].extra.code, "STEP_FAILED");
}

console.log("plan-rollback-reverse-order test passed (reverse [1,0] order · one-way honesty · retry-once success + exhaustion).");
