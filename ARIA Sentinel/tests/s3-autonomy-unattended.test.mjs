// STAGE 3 S3 — EARNED AUTONOMY, LIVE. The contract this battery locks:
//   • Unattended execution EXISTS now (S3_UNATTENDED_ENABLED), but it is EARNED — 10 supervised
//     successes, every step vetted Tier ≤1, Autonomous mode. Not earned → REFUSED, never downgraded.
//   • Autonomy removes the CLICK and nothing else: the plan-start countdown still runs, the supervisor
//     still re-approves every step, the kill-switch still aborts + rolls back, dry-run still wins.
//   • The plan-history ladder is LIVE: a supervised success = +1; a human stopping the plan = −1; an
//     unattended success never inflates the supervised count that granted it.
// Pure + injectable: nothing real is spawned.
import assert from "node:assert/strict";
import { executePlan } from "../src/main/plan-executor.mjs";
import {
  S1_UNATTENDED_ENABLED, S3_UNATTENDED_ENABLED, PLAN_UNATTENDED_MIN_SUCCESSES,
  emptyPlanHistory, recordPlanOutcome, planSupervisedSuccesses, canRunUnattendedS3, autonomyLine
} from "../src/main/plan-autonomy-ladder.mjs";

const NOW = 1_770_000_000_000;
const plan = () => ({
  id: "audio-recovery",
  title: "Audio recovery",
  trigger: { kind: "detector-cluster", detail: "audio" },
  steps: [{ recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv"], onFail: "escalate" }],
  goalProbe: { command: "(Get-Service Audiosrv).Status", interpret: "service-running", description: "audio service running" },
  riskEnvelope: { level: "medium", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
});
const earned = () => {
  let h = emptyPlanHistory();
  for (let i = 0; i < PLAN_UNATTENDED_MIN_SUCCESSES; i++) h = recordPlanOutcome(h, "audio-recovery", "success", NOW + i);
  return h;
};
const vetted = () => 50;                       // Tier ≤ 1 for every step
const okRun = async () => ({ stdout: "Running", stderr: "", exitCode: 0 });

// 1 — the S3 flip is conscious and explicit. The S1 line is PRESERVED (Rule 15) and still means S1.
assert.equal(S1_UNATTENDED_ENABLED, false, "the S1 contract line stays false");
assert.equal(S3_UNATTENDED_ENABLED, true, "S3 consciously enables earned unattended execution");
assert.equal(canRunUnattendedS3({ plan: plan(), planHistory: earned(), vettedCountOf: vetted, mode: "autonomous" }).allowed, true);
// An S1 caller can still pin the old behaviour.
assert.equal(canRunUnattendedS3({ plan: plan(), planHistory: earned(), vettedCountOf: vetted, mode: "autonomous", unattendedEnabled: false }).allowed, false);

// 2 — NOT EARNED → refused. No consent prompt, no countdown, no command, honest reasons.
{
  const calls = [];
  let confirmed = 0;
  const r = await executePlan(plan(), {
    mode: "autonomous", unattended: true,
    planHistory: emptyPlanHistory(), vettedCountOf: vetted,
    confirmPlan: async () => { confirmed += 1; return true; },
    countdownGate: async () => true,
    run: async (c) => { calls.push(c); return { stdout: "Running", stderr: "", exitCode: 0 }; },
    now: () => NOW
  });
  assert.equal(r.outcome, "aborted");
  const last = r.journal[r.journal.length - 1];
  assert.equal(last.extra.code, "UNATTENDED_NOT_ENABLED");
  assert.ok(last.extra.reasons.some((x) => x.includes("0/10")), "the reason names the missing successes");
  assert.equal(calls.length, 0, "a refused unattended plan runs nothing");
  assert.equal(confirmed, 0, "and never silently falls back to asking for a click");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.APPROVED"));
}

// 3 — EARNED → runs WITHOUT a click, but the countdown, supervisor and banner are all still there.
{
  const gates = [];
  const supervised = [];
  const banners = [];
  const r = await executePlan(plan(), {
    mode: "autonomous", unattended: true,
    planHistory: earned(), vettedCountOf: vetted,
    // NO confirmPlan wired at all — an earned plan must not need one.
    countdownGate: async (g) => { gates.push(g.phase); return true; },
    supervise: (proposal) => { supervised.push(proposal.recipeId); return { verdict: "approve", code: "OK", reason: "ok" }; },
    onBanner: (b) => banners.push(b),
    executeStep: async () => ({ outcome: "success", recipeId: "restart-audio" }),
    run: okRun,
    now: () => NOW
  });
  assert.equal(r.outcome, "resolved", "an earned plan resolves unattended");
  assert.deepEqual(gates, ["plan-start", "step"], "plan-start countdown ALWAYS + the medium-risk step countdown");
  assert.deepEqual(supervised, ["restart-audio-service"], "the supervisor still re-approves every step");
  assert.equal(banners.length, 1, "unattended ≠ silent — the live banner is raised before the countdown");
  assert.equal(banners[0].unattended, true);
  const approved = r.journal.find((e) => e.event === "PLAN.APPROVED");
  assert.equal(approved.extra.unattended, true);
}

// 4 — kill-switch still wins mid-plan (and the plan is rolled back), even when autonomy was earned.
{
  let killed = false;
  const r = await executePlan(
    { ...plan(), steps: [
      { recipeId: "restart-audio-service", risk: "low", expectedImpact: ["AudioSrv"], onFail: "escalate" },
      { recipeId: "restart-print-spooler", risk: "low", expectedImpact: ["Spooler"], onFail: "escalate" }
    ] },
    {
      mode: "autonomous", unattended: true,
      planHistory: earned(), vettedCountOf: vetted,
      countdownGate: async () => true,
      supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
      executeStep: async () => { killed = true; return { outcome: "success", recipeId: "restart-audio" }; },
      isKilled: () => killed,   // the kill-switch trips right after step 1
      run: okRun,
      now: () => NOW
    }
  );
  assert.equal(r.outcome, "aborted");
  assert.ok(r.journal.some((e) => e.event === "PLAN.ABORTED" && e.extra.code === "KILL_SWITCH"));
  assert.ok(r.journal.some((e) => e.event === "PLAN.STEP.ROLLBACK"), "kill mid-plan rolls the completed steps back");
}

// 5 — the dry-run checkbox still wins over earned autonomy: no live change, so no success is ever claimed.
{
  const r = await executePlan(plan(), {
    mode: "autonomous", unattended: true, dryRunCheckbox: true,
    planHistory: earned(), vettedCountOf: vetted,
    countdownGate: async () => true,
    supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
    executeStep: async () => ({ outcome: "dry-run", recipeId: "restart-audio" }),
    run: okRun,
    now: () => NOW
  });
  assert.equal(r.outcome, "dry-run");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.RESOLVED"), "a dry-run never claims a fix");
}

// 6 — the ladder is LIVE and honest: a SUPERVISED success earns +1; an UNATTENDED success earns nothing
//     (it must never inflate the supervised count that granted the autonomy); a human stop costs −1.
{
  let persisted = null;
  const supervisedRun = await executePlan(plan(), {
    mode: "confirmed",
    planHistory: emptyPlanHistory(), vettedCountOf: vetted,
    confirmPlan: async () => true,
    countdownGate: async () => true,
    supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
    executeStep: async () => ({ outcome: "success", recipeId: "restart-audio" }),
    persistPlanHistory: (h) => { persisted = h; },
    run: okRun, now: () => NOW
  });
  assert.equal(supervisedRun.outcome, "resolved");
  assert.equal(planSupervisedSuccesses(persisted, "audio-recovery"), 1, "a supervised, probe-verified success = +1");

  const h10 = earned();
  const unattendedRun = await executePlan(plan(), {
    mode: "autonomous", unattended: true,
    planHistory: h10, vettedCountOf: vetted,
    countdownGate: async () => true,
    supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
    executeStep: async () => ({ outcome: "success", recipeId: "restart-audio" }),
    run: okRun, now: () => NOW
  });
  assert.equal(unattendedRun.outcome, "resolved");
  assert.equal(unattendedRun.planHistory, undefined, "an unattended success never inflates the supervised count");
  assert.equal(planSupervisedSuccesses(h10, "audio-recovery"), PLAN_UNATTENDED_MIN_SUCCESSES);

  const stopped = await executePlan(plan(), {
    mode: "confirmed",
    planHistory: h10, vettedCountOf: vetted,
    confirmPlan: async () => true,
    countdownGate: async () => false,   // the user hits Stop during the countdown
    run: okRun, now: () => NOW
  });
  assert.equal(stopped.outcome, "aborted");
  assert.equal(planSupervisedSuccesses(stopped.planHistory, "audio-recovery"), PLAN_UNATTENDED_MIN_SUCCESSES - 1, "a human stop = −1");
}

// 7 — 🔒 R11: an off-limits plan can never earn autonomy, whatever its history says.
{
  const d = canRunUnattendedS3({ plan: { ...plan(), title: "Private pics and Vids sweep" }, planHistory: earned(), vettedCountOf: vetted, mode: "autonomous" });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => r.includes("R11")));
}

// 8 — the plan card never over-claims.
assert.ok(autonomyLine({ allowed: false, reasons: ["plan has 7/10 supervised successes"] }, plan(), emptyPlanHistory()).includes("needs your click"));
assert.ok(autonomyLine({ allowed: true, reasons: [] }, plan(), earned()).includes("earned autonomy"));

console.log("s3-autonomy-unattended test passed (earned or refused · click removed, no gate removed · countdown+supervisor+kill+dry-run intact · ladder live · R11 first).");
