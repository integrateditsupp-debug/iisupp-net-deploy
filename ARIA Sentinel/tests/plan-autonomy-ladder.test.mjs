// STAGE 3 S1 — plan-level earned-autonomy ladder: the unattended predicate exists but
// S1_UNATTENDED_ENABLED is false, so unattended execution is structurally impossible — the
// executor refuses ctx.unattended even when every ladder condition holds. Nothing spawns.
import assert from "node:assert/strict";
import {
  S1_UNATTENDED_ENABLED, PLAN_UNATTENDED_MIN_SUCCESSES,
  emptyPlanHistory, recordPlanOutcome, planSupervisedSuccesses, canRunUnattended
} from "../src/main/plan-autonomy-ladder.mjs";
import { executePlan } from "../src/main/plan-executor.mjs";

const NOW = 1_760_000_000_000;
const plan = () => ({
  id: "audio-recovery",
  title: "Audio recovery",
  trigger: { kind: "detector-cluster", detail: "audio" },
  steps: [{ recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv", "AudioEndpointBuilder"], onFail: "escalate" }],
  goalProbe: { command: "(Get-Service Audiosrv).Status", interpret: "service-running", description: "audio service running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});

// 1 — the S1 flag is OFF. This line is the contract S3 must consciously flip after live review.
assert.equal(S1_UNATTENDED_ENABLED, false);
assert.equal(PLAN_UNATTENDED_MIN_SUCCESSES, 10);

// 2 — ledger math: +1 per supervised success, −1 per veto/abort (floored at 0), history capped.
let h = emptyPlanHistory();
for (let i = 0; i < 12; i++) h = recordPlanOutcome(h, "audio-recovery", "success", NOW + i);
assert.equal(planSupervisedSuccesses(h, "audio-recovery"), 12);
h = recordPlanOutcome(h, "audio-recovery", "veto", NOW + 20);
assert.equal(planSupervisedSuccesses(h, "audio-recovery"), 11);
let h2 = emptyPlanHistory();
h2 = recordPlanOutcome(h2, "p", "abort", NOW);
assert.equal(planSupervisedSuccesses(h2, "p"), 0, "floored at 0");
assert.equal(h.plans["audio-recovery"].runs.length <= 20, true);

// 🔒 R11 — a blocked plan id is never recorded.
const hr = recordPlanOutcome(emptyPlanHistory(), "fix C:\\Private pics and Vids", "success", NOW);
assert.deepEqual(hr.plans, {});

// 3 — every ladder condition individually blocks unattended (with an honest reason).
const fullVet = () => 50; // Tier ≤ 1 for every step
const args = { plan: plan(), planHistory: h, vettedCountOf: fullVet, mode: "autonomous" };

// S1 default: even a fully-earned plan is refused because the stage flag is off.
let d = canRunUnattended(args);
assert.equal(d.allowed, false);
assert.ok(d.reasons.some((r) => r.includes("S1")));

// With the (future-S3) flag on, all conditions held → allowed.
d = canRunUnattended({ ...args, unattendedEnabled: true });
assert.equal(d.allowed, true, d.reasons.join("; "));

// mode ≠ autonomous → refused.
d = canRunUnattended({ ...args, unattendedEnabled: true, mode: "confirmed" });
assert.equal(d.allowed, false);
assert.ok(d.reasons.some((r) => r.includes("Autonomous mode required")));

// a step below vetted Tier ≤ 1 (e.g. 3 successes → Tier 2) → refused.
d = canRunUnattended({ ...args, unattendedEnabled: true, vettedCountOf: () => 3 });
assert.equal(d.allowed, false);
assert.ok(d.reasons.some((r) => r.includes("Tier 2")));

// < 10 supervised plan successes → refused.
let h9 = emptyPlanHistory();
for (let i = 0; i < 9; i++) h9 = recordPlanOutcome(h9, "audio-recovery", "success", NOW + i);
d = canRunUnattended({ ...args, unattendedEnabled: true, planHistory: h9 });
assert.equal(d.allowed, false);
assert.ok(d.reasons.some((r) => r.includes("9/10")));

// 🔒 R11 plan → never, regardless of everything else.
d = canRunUnattended({ ...args, unattendedEnabled: true, plan: { ...plan(), title: "Private pics and Vids sweep" } });
assert.equal(d.allowed, false);
assert.ok(d.reasons.some((r) => r.includes("R11")));

// 4 — the EXECUTOR refuses unattended in S1 outright: no consent prompt, no steps, honest journal.
{
  const calls = [];
  const run = async (cmd) => { calls.push(String(cmd)); return { stdout: "Running", stderr: "", exitCode: 0 }; };
  const r = await executePlan(plan(), {
    mode: "autonomous",
    unattended: true,
    confirmPlan: async () => true, // even with a consent channel wired, unattended is refused
    countdownGate: async () => true,
    run,
    now: () => NOW
  });
  assert.equal(r.outcome, "aborted");
  const abort = r.journal[r.journal.length - 1];
  assert.equal(abort.event, "PLAN.ABORTED");
  assert.equal(abort.extra.code, "UNATTENDED_NOT_ENABLED");
  assert.equal(calls.length, 0, "no command may run on a refused unattended request");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.APPROVED"));
}

console.log("plan-autonomy-ladder test passed (S1 flag OFF · ledger math · every condition gates · executor refuses unattended).");
