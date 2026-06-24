// RUN 29-C — first-run onboarding state machine: fresh-show, step advance, complete/skip persistence, and
// the core invariant — once dismissed (completed OR skipped) it NEVER replays (until a version bump).
import assert from "node:assert/strict";
import {
  defaultAppConfig, normalizeAppConfig, shouldShowOnboarding, advanceOnboarding, completeOnboarding,
  skipOnboarding, ONBOARDING_TOTAL_STEPS, ONBOARDING_VERSION
} from "../src/shared/app-config.mjs";

let n = 0; const t = () => { n++; };

// 1 — a fresh install shows onboarding; the default state is clean.
const fresh = defaultAppConfig();
assert.equal(shouldShowOnboarding(fresh), true, "fresh install → show");
assert.equal(fresh.onboarding.completed, false);
assert.equal(fresh.onboarding.step, 0);
t();

// 2 — stepping through advances and auto-completes at the final step.
let c = fresh;
for (let i = 1; i < ONBOARDING_TOTAL_STEPS; i++) {
  c = advanceOnboarding(c);
  assert.equal(c.onboarding.step, i);
  assert.equal(c.onboarding.completed, false, `step ${i} not yet complete`);
  assert.equal(shouldShowOnboarding(c), true, "mid-walkthrough still shows");
}
c = advanceOnboarding(c); // final step → completed
assert.equal(c.onboarding.step, ONBOARDING_TOTAL_STEPS);
assert.equal(c.onboarding.completed, true, "reaching the last step completes onboarding");
t();

// 3 — completed → NEVER replays.
assert.equal(shouldShowOnboarding(c), false, "completed onboarding never replays");
assert.equal(shouldShowOnboarding(completeOnboarding(fresh)), false, "explicit complete never replays");
t();

// 4 — skip (power user) persists and NEVER replays.
const skipped = skipOnboarding(fresh);
assert.equal(skipped.onboarding.skipped, true);
assert.equal(shouldShowOnboarding(skipped), false, "skipped onboarding never replays");
t();

// 5 — a VERSION bump re-introduces the walkthrough exactly once (e.g. after a major UX change).
const oldDismissed = { onboarding: { completed: true, skipped: false, step: ONBOARDING_TOTAL_STEPS, version: ONBOARDING_VERSION - 1 } };
assert.equal(shouldShowOnboarding(oldDismissed, { version: ONBOARDING_VERSION }), true, "older version → show the new walkthrough once");
assert.equal(shouldShowOnboarding(completeOnboarding(oldDismissed)), false, "re-completing at the new version stops replays");
t();

// 6 — normalize is forward/backward safe: garbage/partial state never crashes and never accidentally shows
//     after dismissal; step is clamped.
assert.equal(shouldShowOnboarding(null), true, "no config → fresh → show");
assert.equal(shouldShowOnboarding({}), true, "empty config → show");
assert.equal(shouldShowOnboarding({ onboarding: { completed: true } }), false, "partial dismissed state respected");
assert.equal(normalizeAppConfig({ onboarding: { step: 99 } }).onboarding.step, ONBOARDING_TOTAL_STEPS, "step clamped to total");
assert.equal(normalizeAppConfig({ onboarding: { step: -5 } }).onboarding.step, 0, "step floored at 0");
// preserves unrelated config keys
assert.equal(normalizeAppConfig({ theme: "dark", onboarding: {} }).theme, "dark", "unrelated keys preserved");
t();

assert.equal(n, 6, "6 onboarding test groups");
console.log(`onboarding-flow test passed (${n} groups · fresh-show · step advance/complete · skip persists · never-replay invariant · version-bump re-show · normalize safety).`);
