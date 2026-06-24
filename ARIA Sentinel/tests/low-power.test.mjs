// RUN 9 — low-power mode. Asserts the polling/animation profile changes when toggled.
import assert from "node:assert/strict";
import { pollingProfile, globeFrameMs, NORMAL_PROFILE, LOW_POWER_PROFILE } from "../src/shared/power-mode.mjs";

const normal = pollingProfile(false);
const low = pollingProfile(true);

assert.equal(normal.watcherIntervalMs, 5000, "normal watcher cadence");
assert.equal(low.watcherIntervalMs, 60000, "low-power drops watcher polling to 60s");
assert.ok(low.watcherIntervalMs > normal.watcherIntervalMs, "low-power polls less often");

assert.equal(normal.globeFps, 30);
assert.equal(low.globeFps, 15, "low-power drops the globe to 15fps");
assert.equal(globeFrameMs(false), Math.round(1000 / 30));
assert.equal(globeFrameMs(true), Math.round(1000 / 15));

assert.equal(normal.animations, true);
assert.equal(low.animations, false, "low-power disables animation");

// Profiles are stable constants (returned copies don't mutate the source).
const a = pollingProfile(true);
a.watcherIntervalMs = 1;
assert.equal(LOW_POWER_PROFILE.watcherIntervalMs, 60000, "source profile is frozen/immutable");
assert.equal(NORMAL_PROFILE.globeFps, 30);

console.log("Low-power test passed (60s polling · 15fps · animation off when toggled).");
