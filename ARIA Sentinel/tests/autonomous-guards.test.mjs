// RUN 6 — Autonomous safety guards: per-recipe cap, cooldown, fleet rate-limit. Plus the opt-in gate.
import assert from "node:assert/strict";
import {
  canEnableAutonomous,
  evaluateAutoFire,
  recordAutoFire,
  fleetRateLimited,
  autonomousPauseUntil,
  PER_RECIPE_CAP,
  COOLDOWN_MS,
  CAP_WINDOW_MS
} from "../src/shared/autonomous.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");

// Opt-in: only an explicit "I understand" enables Autonomous.
assert.equal(canEnableAutonomous({ understood: true }), true);
assert.equal(canEnableAutonomous({ understood: false }), false);
assert.equal(canEnableAutonomous({}), false, "cannot enable silently");

// Green recipe, clean history → allowed.
assert.equal(evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "autonomous", now: NOW, history: [] }).allow, true);

// Yellow never auto-fires.
const yellow = evaluateAutoFire({ recipeId: "teams-cache-v1", tier: "yellow", mode: "autonomous", now: NOW, history: [] });
assert.equal(yellow.allow, false);
assert.equal(yellow.fallback, "confirmed");

// Not in autonomous mode → never auto-fires.
assert.equal(evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "confirmed", now: NOW, history: [] }).allow, false);

// Cooldown: an auto-fire 5 min ago blocks the next.
const recent = [{ recipeId: "audio-no-output-v1", ts: NOW - 5 * 60 * 1000 }];
const cd = evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "autonomous", now: NOW, history: recent });
assert.equal(cd.allow, false);
assert.equal(cd.reason, "cooldown");

// Per-recipe cap: 3 fires of the same recipe in 24h (all just outside cooldown) → 4th blocked.
let history = [];
let t = NOW;
const fires = [];
for (let i = 0; i < 5; i++) {
  const d = evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "autonomous", now: t, history });
  fires.push(d.allow);
  if (d.allow) history = recordAutoFire(history, { recipeId: "dns-fail-v1", ts: t }, t);
  t += COOLDOWN_MS + 1000; // step past cooldown each time
}
const allowed = fires.filter(Boolean).length;
assert.equal(allowed, PER_RECIPE_CAP, `exactly ${PER_RECIPE_CAP} auto-fires allowed in the cap window`);
// The first blocked-by-cap decision falls back to Confirmed.
const capped = evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "autonomous", now: t, history });
assert.equal(capped.reason, "per-recipe-cap");
assert.equal(capped.fallback, "confirmed");

// recordAutoFire prunes entries older than the 24h window.
const old = [{ recipeId: "x", ts: NOW - CAP_WINDOW_MS - 1 }];
assert.equal(recordAutoFire(old, { recipeId: "y", ts: NOW }, NOW).length, 1, "stale history pruned");

// Fleet rate-limit: >5% of the fleet attempting in the window disables the recipe.
assert.equal(fleetRateLimited({ attempts: 6, total: 100 }), true);
assert.equal(fleetRateLimited({ attempts: 5, total: 100 }), false);
assert.equal(fleetRateLimited({ attempts: 0, total: 0 }), false);
const fl = evaluateAutoFire({ recipeId: "dns-fail-v1", tier: "green", mode: "autonomous", now: NOW, history: [], fleet: { attempts: 10, total: 100 } });
assert.equal(fl.allow, false);
assert.equal(fl.reason, "fleet-rate-limit");

// Pause choices.
assert.equal(autonomousPauseUntil("1h", NOW), NOW + 60 * 60 * 1000);
assert.equal(autonomousPauseUntil("24h", NOW), NOW + 24 * 60 * 60 * 1000);
assert.ok(autonomousPauseUntil("until", NOW) > NOW + 365 * 24 * 60 * 60 * 1000, "until-re-enable is effectively indefinite");

console.log(`Autonomous-guards test passed (opt-in gate · cap ${PER_RECIPE_CAP}/24h · cooldown · fleet rate-limit).`);
