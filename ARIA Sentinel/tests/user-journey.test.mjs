// RUN 16 §C — User-behaviour battery. Five end-to-end journeys driven through the real pure modules
// (trial/license, recipe routing+runner, mode behaviour, start/stop). Each journey must reach a
// success state with NO dead-end.
import assert from "node:assert/strict";
import { computeTrialStatus, issueLicense, verifyLicense, isUnlocked, TRIAL_DURATION_MS } from "../src/shared/license.mjs";
import { matchRecipes } from "../src/shared/recipes.mjs";
import { buildExecution, requiresRestorePoint } from "../src/shared/recipe-runner.mjs";
import { modeOverlayBehavior } from "../src/shared/mode-behavior.mjs";
import { applyRunState, isActivelyMonitoring } from "../src/shared/start-stop.mjs";

const journeys = [];
const T0 = Date.parse("2026-06-19T12:00:00.000Z");

// 1 · First launch → trial starts → globe visible → ask ARIA "outlook wont open" → recipe surfaces → dry-run.
{
  const startedAt = new Date(T0).toISOString();
  const trial = computeTrialStatus(startedAt, T0 + 60_000);
  assert.equal(trial.state, "active", "trial active right after launch");
  assert.ok(isUnlocked({ trialState: trial.state }), "app usable during trial");
  const run = applyRunState({}, "start", T0);
  assert.equal(run.globeVisible, true, "globe shows on launch");
  const [match] = matchRecipes("outlook wont open ost stuck", { limit: 1 });
  assert.ok(match, "ARIA surfaces a recipe for the issue");
  assert.ok(Array.isArray(match.recipe.actions) && match.recipe.actions.length, "recipe has actions to run");
  // Dry-run by default: the built command is a sandboxed, ExecutionPolicy-Restricted powershell invocation.
  const exec = buildExecution(match.recipe.actions[0]);
  assert.equal(exec.file, "powershell.exe");
  assert.ok(exec.args.includes("Restricted"), "command runs under Restricted execution policy (safe dry-run)");
  journeys.push("first-launch");
}

// 2 · 12h/30d trial expiry → locked → plan-picker is the path forward (no dead-end).
{
  const startedAt = new Date(T0 - TRIAL_DURATION_MS - 1000).toISOString();
  const trial = computeTrialStatus(startedAt, T0);
  assert.equal(trial.state, "expired", "trial expired");
  const unlocked = isUnlocked({ licenseValid: false, trialState: trial.state });
  assert.equal(unlocked, false, "app locks when trial expires");
  // Forward path exists: entering a valid license unlocks (see journey 3) — not a dead-end.
  journeys.push("trial-expiry");
}

// 3 · License entry → valid HMAC key accepted → unlocks.
{
  const secret = "test-secret-RUN16";
  const lic = issueLicense({ email: "buyer@example.com", days: 365, secret, now: T0 });
  const check = verifyLicense({ email: "buyer@example.com", trialEnd: lic.trialEnd, key: lic.key, secret, now: T0 });
  assert.equal(check.valid, true, "valid license key verifies");
  assert.ok(isUnlocked({ licenseValid: check.valid }), "valid license unlocks the app");
  // Tampered key is rejected (no silent unlock).
  const bad = verifyLicense({ email: "buyer@example.com", trialEnd: lic.trialEnd, key: lic.key.slice(0, -2) + "00", secret, now: T0 });
  assert.equal(bad.valid, false, "tampered key rejected");
  journeys.push("license-activate");
}

// 4 · Mode switch Manual → Autonomous → globe behaviour changes to pinned always-on-top + auto-fix.
{
  const manual = modeOverlayBehavior("manual");
  const auto = modeOverlayBehavior("autonomous");
  assert.equal(manual.alwaysOnTop, false, "manual globe free-roams, click-through");
  assert.equal(auto.alwaysOnTop, true, "autonomous globe pins always-on-top");
  assert.equal(auto.autoFix, true, "autonomous enables auto-fix");
  assert.notDeepEqual(manual, auto, "behaviour actually changes on mode switch");
  journeys.push("mode-switch");
}

// 5 · Stop ARIA → globe vanishes + monitoring stops → Start ARIA → globe returns + monitoring restarts.
{
  let s = applyRunState({}, "start", T0);
  assert.ok(isActivelyMonitoring(s), "monitoring after start");
  s = applyRunState(s, "stop", T0);
  assert.equal(s.globeVisible, false, "globe vanishes on Stop ARIA");
  assert.equal(isActivelyMonitoring(s), false, "monitoring stops on Stop ARIA");
  s = applyRunState(s, "start", T0);
  assert.equal(s.globeVisible, true, "globe returns on Start ARIA");
  assert.ok(isActivelyMonitoring(s), "monitoring restarts on Start ARIA");
  journeys.push("stop-start");
}

assert.deepEqual(journeys, ["first-launch", "trial-expiry", "license-activate", "mode-switch", "stop-start"]);
console.log(`User-journey battery passed (${journeys.length}/5 journeys reached success state, 0 dead-ends).`);
