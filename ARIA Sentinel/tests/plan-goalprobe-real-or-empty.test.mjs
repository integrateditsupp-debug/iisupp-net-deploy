// STAGE 3 S1 — goalProbe real-or-empty: success is declared ONLY by the goalProbe, never by step
// completion; NO-OP-NEUTRAL is never counted as a fix; dry-run never claims success; probe
// evidence is redacted at the source. Nothing spawns.
import assert from "node:assert/strict";
import { executePlan, runProbe, evaluateProbe } from "../src/main/plan-executor.mjs";

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

const audioPlan = (goalProbe) => ({
  id: "audio-goal-test",
  title: "Audio fix",
  trigger: { kind: "user-request", detail: "test" },
  steps: [{ recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "escalate" }],
  goalProbe: goalProbe || { command: "(Get-Service Audiosrv).Status", interpret: "service-running", description: "Windows Audio service is running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});
const ctx = (state, over = {}) => ({
  mode: "confirmed",
  confirmPlan: async () => true,
  countdownGate: async () => true,
  run: fleetRun(state),
  now: () => NOW,
  ...over
});

// 1 — steps ALL succeed but the goalProbe fails → escalated, never resolved. Step completion ≠ success.
{
  // Audio restart succeeds, but the goal is about the SPOOLER, which stays down.
  const p = audioPlan({ command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler running" });
  const r = await executePlan(p, ctx({ Audiosrv: "Stopped", Spooler: "Stopped" }));
  assert.equal(r.outcome, "escalated");
  assert.equal(r.journal[r.journal.length - 1].extra.code, "GOAL_PROBE_FAILED");
  assert.equal(r.evidence, "Stopped");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.RESOLVED"), "no PLAN.RESOLVED when the problem persists");
}

// 2 — real fix: step success (Stopped→Running) + goalProbe pass → resolved with probe evidence.
{
  const r = await executePlan(audioPlan(), ctx({ Audiosrv: "Stopped" }));
  assert.equal(r.outcome, "resolved");
  assert.equal(r.evidence, "Running");
  const res = r.journal[r.journal.length - 1];
  assert.equal(res.event, "PLAN.RESOLVED");
  assert.equal(res.extra.noChange, false);
}

// 3 — NO-OP-NEUTRAL: service already Running → probe passes but nothing changed → "already-healthy",
// explicitly NOT counted as an ARIA fix (noChange:true), outcome is never "resolved".
{
  const r = await executePlan(audioPlan(), ctx({ Audiosrv: "Running" }));
  assert.equal(r.outcome, "already-healthy");
  assert.notEqual(r.outcome, "resolved");
  const res = r.journal[r.journal.length - 1];
  assert.equal(res.event, "PLAN.RESOLVED");
  assert.equal(res.extra.noChange, true);
  assert.match(res.detail, /not counted as an ARIA fix/i);
}

// 4 — dry-run never claims success: no Restart-Service spawns, no PLAN.RESOLVED, outcome "dry-run".
{
  const calls = [];
  const state = { Audiosrv: "Stopped" };
  const r = await executePlan(audioPlan(), { ...ctx(state), run: fleetRun(state, calls), dryRunCheckbox: true });
  assert.equal(r.outcome, "dry-run");
  assert.ok(!calls.some((c) => /^Restart-Service/i.test(c)), "dry-run must not execute the remediation");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.RESOLVED"));
  assert.equal(r.journal[r.journal.length - 1].extra.code, "DRY_RUN");
}

// 5 — probe evidence is redacted at the source (R11) and capped at 200 chars.
{
  // The private path sits on its own line (redactPrivate swallows the whole tainted line).
  const run = async (cmd) => /Get-DnsClientCache/i.test(String(cmd))
    ? { stdout: "7\nsee C:\\Private pics and Vids\\cache " + "x".repeat(300), stderr: "", exitCode: 0 }
    : { stdout: "", stderr: "", exitCode: 0 };
  const p = await runProbe({ command: "(Get-DnsClientCache | Measure-Object).Count", interpret: "count-positive", description: "dns cache non-empty" }, run);
  assert.equal(p.pass, true);
  assert.equal(/private\s+pics\s+and\s+vids/i.test(p.output), false, "evidence must be redacted");
  assert.ok(p.output.length <= 200);
}

// 6 — pure interpreters: service-running takes the LAST line; count-positive needs a number > 0.
assert.equal(evaluateProbe({ interpret: "service-running" }, "Stopping\r\nRunning\r\n"), true);
assert.equal(evaluateProbe({ interpret: "service-running" }, "Stopped"), false);
assert.equal(evaluateProbe({ interpret: "count-positive" }, "42"), true);
assert.equal(evaluateProbe({ interpret: "count-positive" }, "0"), false);
assert.equal(evaluateProbe({ interpret: "count-positive" }, "no numbers here"), false);

// 7 — a probe exit code ≠ 0 can never pass (a broken probe is not evidence).
{
  const run = async () => ({ stdout: "Running", stderr: "boom", exitCode: 1 });
  const p = await runProbe({ command: "(Get-Service Audiosrv).Status", interpret: "service-running", description: "d" }, run);
  assert.equal(p.pass, false);
}

console.log("plan-goalprobe-real-or-empty test passed (probe ≠ step completion · no-op never a fix · dry-run honest · evidence redacted).");
