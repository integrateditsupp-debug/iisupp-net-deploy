// STAGE 3 S1 — the two absolute invariants at the plan layer:
//   🔒 R11 is check #1 at plan, step (supervisor), journal, and evidence layers — no trace persists.
//   Kill-switch supremacy — Ctrl+Alt+K funnels (isKilled + countdownManager.abortAll) abort the
//   plan and engage the rollbackPolicy. Also: consent is never assumed (no confirm channel → abort).
import assert from "node:assert/strict";
import { executePlan, runProbe } from "../src/main/plan-executor.mjs";
import { createCountdownManager } from "../src/main/action-countdown.mjs";
import { R11_SURFACE } from "../src/shared/path-guard.mjs";

const NOW = 1_760_000_000_000;

function fleetRun(state, calls) {
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    let m;
    if ((m = c.match(/^Restart-Service (\w+)/i))) { state[m[1]] = "Running"; if (state.onRestart) state.onRestart(m[1]); return { stdout: "Running", stderr: "", exitCode: 0 }; }
    if ((m = c.match(/^Start-Service (\w+)/i))) { state[m[1]] = "Running"; return { stdout: "", stderr: "", exitCode: 0 }; }
    if ((m = c.match(/Get-Service (\w+)/i))) return { stdout: String(state[m[1]] || "Running") + "\r\n", stderr: "", exitCode: 0 };
    if (/flushdns/i.test(c)) { state.dnsCount = 0; return { stdout: "", stderr: "", exitCode: 0 }; }
    if (/Get-DnsClientCache/i.test(c)) return { stdout: String(state.dnsCount ?? 50), stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

const twoStep = () => ({
  id: "invariant-plan",
  title: "audio then spooler",
  trigger: { kind: "user-request", detail: "test" },
  steps: [
    { recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "rollback-plan" },
    { recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "rollback-plan" }
  ],
  goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});
const baseCtx = (state, over = {}) => ({
  mode: "confirmed",
  confirmPlan: async () => true,
  countdownGate: async () => true,
  run: fleetRun(state),
  now: () => NOW,
  ...over
});

// 1 — 🔒 R11 at the PLAN layer: blocked before validation, before consent, before anything runs.
{
  const calls = [];
  const p = twoStep();
  p.title = "cleanup of C:\\Private pics and Vids\\downloads";
  let consentAsked = false;
  const r = await executePlan(p, baseCtx({ }, { run: fleetRun({}, calls), confirmPlan: async () => { consentAsked = true; return true; } }));
  assert.equal(r.outcome, "blocked");
  assert.equal(r.surfaced, R11_SURFACE);
  assert.equal(consentAsked, false, "R11 fires before the consent prompt");
  assert.equal(calls.length, 0, "nothing may spawn");
  assert.equal(r.journal[0].event, "PLAN.ABORTED");
  assert.equal(r.journal[0].extra.code, "R11_BLOCKED");
  // journal layer: the private path never persists anywhere in the journal.
  assert.equal(/private\s+pics\s+and\s+vids/i.test(JSON.stringify(r.journal)), false);
}

// 2 — 🔒 R11 at the STEP layer: a live-state supervisor R11 veto mid-plan → rollback + escalate.
{
  const calls = [];
  const state = { Audiosrv: "Stopped", Spooler: "Running" };
  let call = 0;
  const r = await executePlan(twoStep(), baseCtx(state, {
    run: fleetRun(state, calls),
    supervise: () => (++call === 2)
      ? { verdict: "veto", code: "R11_BLOCKED", reason: "Proposal references the off-limits private folder.", supervisorEvidence: {} }
      : { verdict: "approve", reason: "ok", supervisorEvidence: {} }
  }));
  assert.equal(r.outcome, "escalated");
  const veto = r.journal.find((e) => e.extra && e.extra.veto === true);
  assert.equal(veto.extra.code, "R11_BLOCKED");
  assert.ok(r.journal.some((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.planRollback), "completed step rolled back");
  assert.ok(!calls.some((c) => /^Restart-Service Spooler/i.test(c)), "vetoed step never ran");
}

// 3 — 🔒 R11 at the EVIDENCE layer: a blocked goalProbe command hard-stops with the R11 surface.
{
  const p = await runProbe({ command: "Get-ChildItem 'C:\\Private pics and Vids'", interpret: "count-positive", description: "d" }, async () => ({ stdout: "5", stderr: "", exitCode: 0 }));
  assert.deepEqual({ pass: p.pass, blocked: p.blocked, surfaced: p.surfaced }, { pass: false, blocked: true, surfaced: R11_SURFACE });
  // non-allowlisted probes are equally refused (defense in depth, no spawn).
  const q = await runProbe({ command: "Invoke-WebRequest http://x", interpret: "count-positive", description: "d" }, async () => ({ stdout: "5", stderr: "", exitCode: 0 }));
  assert.equal(q.blocked, true);
}

// 4 — kill-switch mid-plan: flips after step 1 applies → step 2 never starts, reverse rollback runs,
// PLAN.ABORTED(KILL_SWITCH) is journaled.
{
  const calls = [];
  let killFlag = false;
  const state = { Audiosrv: "Stopped", Spooler: "Running", onRestart: (svc) => { if (svc === "Audiosrv") killFlag = true; } };
  const r = await executePlan(twoStep(), baseCtx(state, { run: fleetRun(state, calls), isKilled: () => killFlag }));
  assert.equal(r.outcome, "aborted");
  const abort = r.journal[r.journal.length - 1];
  assert.equal(abort.event, "PLAN.ABORTED");
  assert.equal(abort.extra.code, "KILL_SWITCH");
  assert.equal(abort.extra.rolledBack, true);
  assert.ok(!calls.some((c) => /^Restart-Service Spooler/i.test(c)), "no step starts after the kill");
  assert.ok(r.journal.some((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.planRollback));
}

// 5 — kill-switch via the countdown abort funnel: abortAll() during the plan-start countdown
// (the Ctrl+Alt+K path) aborts the plan through the DEFAULT countdown gate + manager.
{
  const manager = createCountdownManager();
  const r = await executePlan(twoStep(), baseCtx({ Audiosrv: "Stopped", Spooler: "Running" }, {
    countdownGate: undefined, // use the real default gate + real createCountdown
    countdownManager: manager,
    setIntervalFn: () => { queueMicrotask(() => manager.abortAll()); return 1; },
    clearIntervalFn: () => {}
  }));
  assert.equal(r.outcome, "aborted");
  assert.equal(r.journal[r.journal.length - 1].extra.code, "COUNTDOWN_ABORT");
  assert.equal(manager.size(), 0, "aborted countdown is deregistered");
}

// 6 — consent is never assumed: no confirmPlan channel → abort with NO_CONFIRM_CHANNEL, nothing runs.
{
  const calls = [];
  const state = { Audiosrv: "Stopped" };
  const r = await executePlan(twoStep(), { mode: "confirmed", run: fleetRun(state, calls), countdownGate: async () => true, now: () => NOW });
  assert.equal(r.outcome, "aborted");
  assert.equal(r.journal[r.journal.length - 1].extra.code, "NO_CONFIRM_CHANNEL");
  assert.equal(calls.length, 0);
}

// 7 — user declines → aborted (USER_DECLINED), nothing runs.
{
  const calls = [];
  const r = await executePlan(twoStep(), baseCtx({ Audiosrv: "Stopped" }, { run: fleetRun({}, calls), confirmPlan: async () => false }));
  assert.equal(r.outcome, "aborted");
  assert.equal(r.journal[r.journal.length - 1].extra.code, "USER_DECLINED");
  assert.equal(calls.length, 0);
}

console.log("plan-r11-and-killswitch test passed (R11 at plan/step/journal/evidence · kill mid-plan + abortAll funnel · consent never assumed).");
