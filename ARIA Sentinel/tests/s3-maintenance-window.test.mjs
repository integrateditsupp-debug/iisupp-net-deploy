// STAGE 3 S3 — MAINTENANCE WINDOWS. "It fixed it overnight" — honestly earned:
//   • a DISRUPTIVE plan running UNATTENDED queues to the user's window instead of interrupting them;
//   • an attended run, a user-initiated run, an opted-out plan, a dry-run, or NO window → no deferral is
//     invented (real-or-empty) and the plan proceeds under its normal gates;
//   • a window grants no autonomy and skips no gate — it only decides WHEN;
//   • 🔒 R11 first; an invalid window config is rejected, never coerced into a plausible default.
import assert from "node:assert/strict";
import {
  parseHhMm, validateWindow, isInWindow, nextWindowStart, windowLine, shouldDeferToWindow,
  WINDOW_DEFAULT_DURATION_MINS, MS_PER_MIN
} from "../src/main/maintenance-window.mjs";
import { executePlan } from "../src/main/plan-executor.mjs";
import { emptyPlanHistory, recordPlanOutcome, PLAN_UNATTENDED_MIN_SUCCESSES } from "../src/main/plan-autonomy-ladder.mjs";

// Deterministic clock: a fake "local time" so the test never depends on the runner's timezone.
const at = (hh, mm = 0) => hh * 60 * MS_PER_MIN + mm * MS_PER_MIN;          // ms since local midnight
const dateOf = (ts) => ({ getHours: () => Math.floor(ts / (60 * MS_PER_MIN)) % 24, getMinutes: () => Math.floor(ts / MS_PER_MIN) % 60 });
const WIN = { enabled: true, start: "02:00", durationMins: 120 };

// 1 — parsing + validation are strict. Garbage in → REJECTED, never a made-up window.
assert.equal(parseHhMm("02:00"), 120);
assert.equal(parseHhMm("23:59"), 1439);
assert.equal(parseHhMm("24:00"), null);
assert.equal(parseHhMm("2am"), null);
assert.equal(validateWindow({ start: "02:00" }).durationMins, WINDOW_DEFAULT_DURATION_MINS);
assert.equal(validateWindow({ start: "nope" }).ok, false);
assert.equal(validateWindow({ enabled: false, start: "02:00" }).ok, false);
assert.equal(validateWindow({ start: "02:00", durationMins: 0 }).ok, false);
assert.equal(validateWindow({ start: "02:00", durationMins: 13 * 60 }).ok, false);

// 2 — inside / outside, including a window that wraps past midnight.
assert.equal(isInWindow(WIN, at(2, 30), dateOf), true);
assert.equal(isInWindow(WIN, at(4, 0), dateOf), false, "the window is [start, start+duration)");
assert.equal(isInWindow(WIN, at(14, 0), dateOf), false);
const WRAP = { enabled: true, start: "23:00", durationMins: 240 };
assert.equal(isInWindow(WRAP, at(23, 30), dateOf), true);
assert.equal(isInWindow(WRAP, at(1, 30), dateOf), true);
assert.equal(isInWindow(WRAP, at(4, 0), dateOf), false);

// 3 — next opening, and an honest line (never a promise we cannot name).
assert.equal(nextWindowStart(WIN, at(2, 30), dateOf), at(2, 30), "already open → now");
assert.equal(nextWindowStart(WIN, at(22, 0), dateOf), at(22, 0) + 4 * 60 * MS_PER_MIN, "22:00 → 02:00 is 4h away");
assert.equal(nextWindowStart({ start: "bad" }, at(9), dateOf), null);
assert.ok(windowLine(WIN, at(22, 0), dateOf).includes("4h"));
assert.ok(windowLine({ enabled: false }, at(9), dateOf).includes("No maintenance window"));

// 4 — the deferral decision. Only a disruptive UNATTENDED plan waits.
const disruptive = { id: "network-recovery", riskEnvelope: { level: "medium", touchesSystemState: true }, steps: [{ recipeId: "reset-network-stack", risk: "medium" }] };
const gentle = { id: "audio-recovery", riskEnvelope: { level: "medium", touchesSystemState: false }, steps: [{ recipeId: "restart-audio-service", risk: "medium" }] };

assert.equal(shouldDeferToWindow({ plan: disruptive, window: WIN, unattended: true, now: at(14), dateOf }).defer, true);
assert.equal(shouldDeferToWindow({ plan: disruptive, window: WIN, unattended: true, now: at(2, 30), dateOf }).defer, false, "window open → run");
assert.equal(shouldDeferToWindow({ plan: disruptive, window: WIN, unattended: false, now: at(14), dateOf }).defer, false, "the user is AT the keyboard — never make them wait");
assert.equal(shouldDeferToWindow({ plan: disruptive, window: WIN, unattended: true, userInitiated: true, now: at(14), dateOf }).defer, false, "'fix it now' always beats the window");
assert.equal(shouldDeferToWindow({ plan: { ...disruptive, deferToWindow: false }, window: WIN, unattended: true, now: at(14), dateOf }).defer, false, "the plan can opt out");
assert.equal(shouldDeferToWindow({ plan: gentle, window: WIN, unattended: true, now: at(14), dateOf }).defer, false, "a non-disruptive plan needs no window");
assert.equal(shouldDeferToWindow({ plan: disruptive, window: null, unattended: true, now: at(14), dateOf }).defer, false, "no window configured → no deferral is invented");
// 🔒 R11 — an off-limits plan is never queued (the executor's R11 path stops it first).
assert.equal(shouldDeferToWindow({ plan: { ...disruptive, title: "clean C:\\Private pics and Vids" }, window: WIN, unattended: true, now: at(14), dateOf }).defer, false);

// 5 — the EXECUTOR queues it: nothing runs, the journal says so, and the run is terminal (re-proposed later).
const earned = () => { let h = emptyPlanHistory(); for (let i = 0; i < PLAN_UNATTENDED_MIN_SUCCESSES; i++) h = recordPlanOutcome(h, "network-recovery", "success", 1); return h; };
const fullPlan = {
  id: "network-recovery",
  title: "Network recovery",
  trigger: { kind: "detector-cluster", detail: "network" },
  steps: [{ recipeId: "flush-dns", risk: "low", expectedImpact: ["DNS cache"], onFail: "retry-once" }],
  goalProbe: { command: "(Get-DnsClientCache | Measure-Object).Count", interpret: "count-positive", description: "DNS resolves" },
  riskEnvelope: { level: "medium", touchesSystemState: true },
  rollbackPolicy: "reverse-order"
};
{
  const calls = [];
  const r = await executePlan(fullPlan, {
    mode: "autonomous", unattended: true,
    planHistory: earned(), vettedCountOf: () => 50,
    maintenanceWindow: WIN, dateOf,
    countdownGate: async () => true,
    supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
    run: async (c) => { calls.push(c); return { stdout: "3", stderr: "", exitCode: 0 }; },
    now: () => at(14)
  });
  assert.equal(r.outcome, "queued");
  assert.equal(calls.length, 0, "a queued plan executes nothing");
  const q = r.journal[r.journal.length - 1];
  assert.equal(q.event, "PLAN.QUEUED");
  assert.equal(q.extra.code, "MAINTENANCE_WINDOW");
  assert.ok(q.extra.nextStart > at(14), "it names WHEN it will run");
  assert.ok(!r.journal.some((e) => e.event === "PLAN.APPROVED"), "queuing is not approval");
}

// 6 — inside the window the SAME plan runs, and every gate is still in place.
{
  const gates = [];
  const r = await executePlan(fullPlan, {
    mode: "autonomous", unattended: true,
    planHistory: earned(), vettedCountOf: () => 50,
    maintenanceWindow: WIN, dateOf,
    countdownGate: async (g) => { gates.push(g.phase); return true; },
    supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
    executeStep: async () => ({ outcome: "success", recipeId: "flush-dns-cache" }),
    run: async () => ({ stdout: "12", stderr: "", exitCode: 0 }),
    now: () => at(2, 30)
  });
  assert.equal(r.outcome, "resolved");
  assert.ok(gates.includes("plan-start"), "the countdown runs even at 02:30 — a window is not a free pass");
}

// 7 — a dry-run preview is never queued (there is nothing disruptive to defer).
{
  const r = await executePlan(fullPlan, {
    mode: "autonomous", unattended: true, dryRunCheckbox: true,
    planHistory: earned(), vettedCountOf: () => 50,
    maintenanceWindow: WIN, dateOf,
    countdownGate: async () => true,
    supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
    executeStep: async () => ({ outcome: "dry-run", recipeId: "flush-dns-cache" }),
    run: async () => ({ stdout: "0", stderr: "", exitCode: 0 }),
    now: () => at(14)
  });
  assert.equal(r.outcome, "dry-run");
}

console.log("s3-maintenance-window test passed (strict config · wrap-around · disruptive+unattended only · queued runs nothing and names when · window skips no gate · dry-run honest · R11 first).");
