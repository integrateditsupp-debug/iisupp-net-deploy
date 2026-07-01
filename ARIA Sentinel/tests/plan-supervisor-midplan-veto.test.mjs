// STAGE 3 S1 — mid-plan supervisor veto: every step is re-approved against CURRENT (live) state by
// the REAL superviseProposal; a veto mid-plan engages the rollbackPolicy and escalates honestly.
// The runner is a stateful fake — nothing spawns.
import assert from "node:assert/strict";
import { executePlan } from "../src/main/plan-executor.mjs";

const NOW = 1_760_000_000_000;

function fleetRun(state, calls) {
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    let m;
    if ((m = c.match(/^Restart-Service (\w+)/i))) { state[m[1]] = (state.afterRestart && state.afterRestart[m[1]]) || "Running"; return { stdout: state[m[1]], stderr: "", exitCode: 0 }; }
    if ((m = c.match(/^Start-Service (\w+)/i))) { state[m[1]] = "Running"; return { stdout: "", stderr: "", exitCode: 0 }; }
    if ((m = c.match(/Get-Service (\w+)/i))) return { stdout: String(state[m[1]] || "Running") + "\r\n", stderr: "", exitCode: 0 };
    if (/flushdns/i.test(c)) { state.dnsCount = 0; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-DnsClientCache/i.test(c)) return { stdout: String(state.dnsCount ?? 50), stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

const plan = () => ({
  id: "veto-plan",
  title: "Two service steps",
  trigger: { kind: "user-request", detail: "test" },
  steps: [
    { recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "rollback-plan" },
    { recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "rollback-plan" }
  ],
  goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});

// 1 — the REAL supervisor vetoes step 2 on its 5-minute cooldown (live recentAttempts say the
// spooler restart just ran 60s ago) → step 1 already applied → reverse rollback → escalated.
{
  const calls = [];
  const state = { Audiosrv: "Stopped", Spooler: "Running", dnsCount: 50 };
  const liveCalls = [];
  const r = await executePlan(plan(), {
    mode: "confirmed",
    confirmPlan: async () => true,
    countdownGate: async () => true,
    run: fleetRun(state, calls),
    now: () => NOW,
    liveContext: () => {
      liveCalls.push(1);
      return { mode: "confirmed", history: [], recentAttempts: [{ recipeId: "restart-print-spooler", ts: NOW - 60_000 }], now: NOW };
    }
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(liveCalls.length, 2, "supervisor consulted per step against live state");
  const veto = r.journal.find((e) => e.extra && e.extra.veto === true);
  assert.ok(veto, "veto is journaled");
  assert.equal(veto.extra.code, "COOLDOWN");
  assert.equal(veto.stepIndex, 1);
  // step 1 (audio) was applied, then rolled back in reverse when the veto hit.
  assert.ok(calls.some((c) => /^Restart-Service Audiosrv/i.test(c)), "step 1 executed");
  assert.ok(!calls.some((c) => /^Restart-Service Spooler/i.test(c)), "vetoed step NEVER executed");
  const rollback = r.journal.filter((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.planRollback);
  assert.equal(rollback.length, 1);
  assert.equal(rollback[0].stepIndex, 0);
  const esc = r.journal[r.journal.length - 1];
  assert.equal(esc.event, "PLAN.ESCALATED");
  assert.equal(esc.extra.code, "COOLDOWN");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.RESOLVED"), "a vetoed plan never claims success");
}

// 2 — an undeclared side-effect veto: step declares no impact but the recipe touches Spooler.
{
  const p = plan();
  p.steps = [{ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: [], onFail: "escalate" }];
  const r = await executePlan(p, {
    mode: "confirmed",
    confirmPlan: async () => true,
    countdownGate: async () => true,
    run: fleetRun({ Spooler: "Running" }),
    now: () => NOW
  });
  assert.equal(r.outcome, "escalated");
  assert.ok(r.journal.some((e) => e.extra && e.extra.code === "SIDE_EFFECT_UNDECLARED"));
}

// 3 — an unvetted recipe id mid-plan is vetoed by the supervisor's signed-catalog check.
{
  const p = plan();
  p.steps = [{ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "escalate" }];
  const r = await executePlan(p, {
    mode: "confirmed",
    confirmPlan: async () => true,
    countdownGate: async () => true,
    run: fleetRun({ Spooler: "Running" }),
    now: () => NOW,
    vettedCatalog: new Set(["flush-dns"]) // live catalog no longer trusts this recipe
  });
  assert.equal(r.outcome, "escalated");
  assert.ok(r.journal.some((e) => e.extra && e.extra.code === "UNVETTED_RECIPE"));
}

console.log("plan-supervisor-midplan-veto test passed (cooldown veto at step 2 + reverse rollback · side-effect veto · unvetted-recipe veto).");
