// RUN-C C3 — 5-minute onboarding activation + time-to-first-value (TTFV).
// Proves: TTFV is real-or-empty (Rule 14), the onboarding has NO dead step, value events are honest
// and idempotent, and the layer is fed by REAL app-config/value signals.
import assert from "node:assert/strict";
import {
  startJourney, recordMilestone, firstValueAt, timeToFirstValueMs, formatDuration,
  nextStep, activationStatus, deriveJourney, isKnownMilestone,
  ONBOARDING_MILESTONES, ONBOARDING_TARGET_MS, FIRST_VALUE_KINDS, ONBOARDING_SCHEMA
} from "../src/shared/onboarding-activation.mjs";
import { defaultAppConfig, completeSetup } from "../src/shared/app-config.mjs";

let n = 0; const t = () => { n++; };
const T0 = Date.parse("2026-06-30T12:00:00.000Z");

// 1 — fresh / empty: nothing is invented. TTFV null, label "—", but there is always a real first action.
{
  assert.equal(timeToFirstValueMs(null), null, "no journey → null TTFV (real-or-empty)");
  assert.equal(timeToFirstValueMs(undefined), null);
  assert.equal(formatDuration(null), "—", "null duration renders as em dash, never a fake number");
  const ns = nextStep(null);
  assert.ok(ns && ns.id === "start", "empty journey still offers a real first step (no dead end)");
  const st = activationStatus(null);
  assert.equal(st.started, false);
  assert.equal(st.reachedValue, false);
  assert.equal(st.activated, false);
  assert.equal(st.ttfvMs, null);
  assert.equal(st.ttfvLabel, "—");
  assert.equal(st.deadStep, false, "no dead step even from empty");
  t();
}

// 2 — happy path within 5 minutes: started→mode_picked→connect_done→first_value(kb)→report_viewed.
{
  let j = startJourney({ now: T0 });
  assert.equal(j.schema, ONBOARDING_SCHEMA);
  j = recordMilestone(j, "mode_picked",  { now: T0 + 10_000 });
  j = recordMilestone(j, "connect_done", { now: T0 + 20_000 });
  j = recordMilestone(j, "first_value",  { now: T0 + 60_000, kind: "kb_answer" });
  j = recordMilestone(j, "report_viewed",{ now: T0 + 90_000 });
  assert.equal(firstValueAt(j), new Date(T0 + 60_000).toISOString());
  assert.equal(timeToFirstValueMs(j), 60_000, "TTFV = first_value − started, real elapsed");
  const st = activationStatus(j, { now: T0 + 90_000 });
  assert.equal(st.reachedValue, true);
  assert.equal(st.activated, true, "reaching a real first value == activated");
  assert.equal(st.completed, true, "report viewed == journey complete");
  assert.equal(st.valueKind, "kb_answer");
  assert.equal(st.withinTarget, true, "60s ≤ 5-min target");
  assert.equal(st.ttfvLabel, "1m 0s");
  assert.equal(st.nextStepId, null, "complete → no further step");
  assert.equal(st.deadStep, false, "complete is not a dead step");
  t();
}

// 3 — the OTHER real value path: one safe fix activates identically.
{
  let j = startJourney({ now: T0 });
  j = recordMilestone(j, "first_value", { now: T0 + 120_000, kind: "safe_fix" });
  const st = activationStatus(j, { now: T0 + 120_000 });
  assert.equal(st.activated, true);
  assert.equal(st.valueKind, "safe_fix");
  assert.equal(st.ttfvMs, 120_000);
  assert.equal(st.withinTarget, true);
  t();
}

// 4 — the ≤5-minute target boundary is honest both ways.
{
  let onTime = startJourney({ now: T0 });
  onTime = recordMilestone(onTime, "first_value", { now: T0 + ONBOARDING_TARGET_MS, kind: "kb_answer" });
  assert.equal(activationStatus(onTime).withinTarget, true, "exactly 5 min counts as within target");

  let slow = startJourney({ now: T0 });
  slow = recordMilestone(slow, "first_value", { now: T0 + ONBOARDING_TARGET_MS + 1, kind: "kb_answer" });
  const st = activationStatus(slow);
  assert.equal(st.withinTarget, false, "over 5 min is NOT within target");
  assert.equal(st.activated, true, "but a slow activation is still a real activation — we measure, never hide");
  t();
}

// 5 — NO DEAD STEP invariant: every contiguous state offers a real next action; null only when complete.
{
  let j = startJourney({ now: T0 });
  const seq = [
    ["mode_picked",  "connect"],
    ["connect_done", "first_value"],
  ];
  // after start, the next step is to pick a mode
  assert.equal(nextStep(j).id, "pick_mode");
  assert.equal(activationStatus(j).deadStep, false);
  for (const [ms, expectNext] of seq) {
    j = recordMilestone(j, ms, { now: T0 + 5_000, kind: null });
    const ns = nextStep(j);
    assert.ok(ns && ns.id === expectNext, `after ${ms} → next is ${expectNext}`);
    assert.equal(activationStatus(j).deadStep, false, `no dead step after ${ms}`);
  }
  j = recordMilestone(j, "first_value", { now: T0 + 6_000, kind: "kb_answer" });
  assert.equal(nextStep(j).id, "view_report", "after first value → view the report");
  j = recordMilestone(j, "report_viewed", { now: T0 + 7_000 });
  assert.equal(nextStep(j), null, "completed journey has no next step");
  assert.equal(activationStatus(j).deadStep, false, "and that is not a dead step");
  t();
}

// 6 — Rule 14 honesty + idempotency: no fake value, no gaming the clock, no inventing milestones.
{
  // (a) a "value" with no valid kind is not value at all — refused.
  let j = startJourney({ now: T0 });
  j = recordMilestone(j, "first_value", { now: T0 + 1000 });              // missing kind
  j = recordMilestone(j, "first_value", { now: T0 + 1000, kind: "lol" }); // bogus kind
  assert.equal(firstValueAt(j), null, "no valid kind → no value recorded");
  assert.equal(timeToFirstValueMs(j), null, "→ TTFV stays null, not fabricated");
  assert.equal(activationStatus(j).activated, false);

  // (b) idempotent: the FIRST real value timestamp wins; a later record cannot move it (faster OR slower).
  let k = startJourney({ now: T0 });
  k = recordMilestone(k, "first_value", { now: T0 + 90_000, kind: "kb_answer" });
  k = recordMilestone(k, "first_value", { now: T0 + 5_000,  kind: "safe_fix" });  // try to look faster
  k = recordMilestone(k, "first_value", { now: T0 + 200_000, kind: "safe_fix" }); // try to look slower
  assert.equal(timeToFirstValueMs(k), 90_000, "first real value is locked — cannot be gamed");
  assert.equal(k.value_kind, "kb_answer", "and its kind is locked too");

  // (c) unknown milestone is a no-op; (d) you cannot record progress before a real start.
  assert.equal(isKnownMilestone("bogus"), false);
  let z = recordMilestone(null, "bogus", { now: T0 });
  assert.deepEqual(z.milestones, {}, "unknown milestone changes nothing");
  let y = recordMilestone(null, "mode_picked", { now: T0 });
  assert.equal(y.started_at, null, "no progress can anchor before a real start");
  assert.deepEqual(y.milestones, {});

  // (e) corrupt order (value before start) → null TTFV, never negative or invented.
  const corrupt = { schema: ONBOARDING_SCHEMA, started_at: new Date(T0 + 100_000).toISOString(),
                    milestones: { started: new Date(T0 + 100_000).toISOString(), first_value: new Date(T0).toISOString() } };
  assert.equal(timeToFirstValueMs(corrupt), null, "value-before-start is corrupt → null, not a negative");
  t();
}

// 7 — fed by REAL signals: app-config setup completion + a real value event + report → a real journey.
{
  const cfg = completeSetup(defaultAppConfig(), { mode: "confirmed" }); // real setup.completed === true
  const j = deriveJourney(
    { setupComplete: cfg.setup.completed, connectChoiceMade: true /* user skipped — skippable */,
      valueEvent: { kind: "kb_answer", at: T0 + 45_000 }, reportViewed: true, reportAt: T0 + 80_000 },
    { startedAt: T0 }
  );
  const st = activationStatus(j, { now: T0 + 80_000 });
  assert.equal(st.started, true);
  assert.equal(st.reachedValue, true, "derived from a REAL value event");
  assert.equal(st.completed, true);
  assert.equal(st.ttfvMs, 45_000, "TTFV derived from the real event timestamp");
  assert.equal(st.withinTarget, true);

  // real-or-empty end to end: no value event → no activation, null TTFV.
  const noValue = deriveJourney({ setupComplete: true, connectChoiceMade: true, valueEvent: null }, { startedAt: T0 });
  assert.equal(activationStatus(noValue).activated, false);
  assert.equal(timeToFirstValueMs(noValue), null);
  t();
}

// 8 — duration formatting never fabricates and reads cleanly.
{
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(-5), "—");
  assert.equal(formatDuration(500), "<1s");
  assert.equal(formatDuration(42_000), "42s");
  assert.equal(formatDuration(222_000), "3m 42s");
  assert.equal(formatDuration(300_000), "5m 0s");
  t();
}

// sanity: the ordered path and target are what the spec calls for.
assert.deepEqual(ONBOARDING_MILESTONES, ["started", "mode_picked", "connect_done", "first_value", "report_viewed"]);
assert.equal(ONBOARDING_TARGET_MS, 5 * 60 * 1000);
assert.deepEqual(FIRST_VALUE_KINDS, ["kb_answer", "safe_fix"]);

assert.equal(n, 8, "8 onboarding-activation test groups");
console.log(`onboarding-activation test passed (${n} groups · TTFV real-or-empty · ≤5-min target honest · NO dead step · value idempotent+honest · fed by real app-config/value signals).`);
