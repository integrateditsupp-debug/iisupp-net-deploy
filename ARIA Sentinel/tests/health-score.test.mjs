// Health Score test — the 0-100 number on the tray tooltip + admin Overview.
// Pure function, fixed clock. Asserts: weights sum to 100; a perfect state scores 100; a fully
// broken state scores 0; each factor moves the score in the right direction; tamper zeroes audit;
// idle/unknown inputs read as healthy (no fresh-install penalty); clamping + tooltip formatting.
import assert from "node:assert/strict";
import {
  computeHealthScore,
  healthLabel,
  healthTooltip,
  HEALTH_WEIGHTS
} from "../src/shared/health-score.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");
const score = (state) => computeHealthScore(state, { nowMs: NOW }).score;

// 1) Weights are a real distribution summing to 100.
assert.equal(Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0), 100);

// 2) A perfectly healthy endpoint scores 100.
const perfect = {
  heartbeats: { healthy: 7, total: 7 },
  recipeOutcomes: { success: 40, failure: 0 },
  serviceNow: { queued: 2, failed: 0 },
  kb: { ageDays: 1 },
  audit: { entries: 500, valid: 500, tampered: false }
};
assert.equal(score(perfect), 100, "perfect state = 100");
assert.equal(computeHealthScore(perfect, { nowMs: NOW }).label, "Healthy");

// 3) A fully broken endpoint scores 0.
const broken = {
  heartbeats: { healthy: 0, total: 7 },
  recipeOutcomes: { success: 0, failure: 25 },
  serviceNow: { queued: 200, failed: 50 },
  kb: { ageDays: 400 },
  audit: { entries: 100, valid: 0, tampered: true }
};
assert.equal(score(broken), 0, "broken state = 0");
assert.equal(healthLabel(score(broken)), "Critical");

// 4) An empty state reads as healthy — a fresh install must not look broken.
assert.equal(score({}), 100, "no data = neutral healthy, not 0");

// 5) Each factor degrades the score independently and by no more than its weight.
for (const [factor, mutate] of Object.entries({
  watcherHeartbeats: (s) => { s.heartbeats = { healthy: 0, total: 7 }; },
  recipeSuccess30d: (s) => { s.recipeOutcomes = { success: 0, failure: 10 }; },
  serviceNowQueue: (s) => { s.serviceNow = { queued: 500, failed: 99 }; },
  kbFreshness: (s) => { s.kb = { ageDays: 400 }; },
  auditIntegrity: (s) => { s.audit = { entries: 10, valid: 10, tampered: true }; }
})) {
  const s = JSON.parse(JSON.stringify(perfect));
  mutate(s);
  const dropped = score(s);
  assert.equal(dropped, 100 - HEALTH_WEIGHTS[factor], `zeroing ${factor} drops exactly its weight`);
}

// 6) Heartbeats accept a timestamped array; a watcher silent > 5 min is counted down.
const hbArray = score({
  ...perfect,
  heartbeats: [
    { lastBeatMs: NOW - 1000 },
    { lastBeatMs: NOW - 1000 },
    { lastBeatMs: NOW - 10 * 60 * 1000 } // stale → 2 of 3 alive
  ]
});
const expectedHb = Math.round(100 - HEALTH_WEIGHTS.watcherHeartbeats * (1 - 2 / 3));
assert.equal(hbArray, expectedHb, "stale heartbeat lowers the watcher factor proportionally");

// 7) KB freshness derived from a timestamp matches the ageDays path.
const byTs = score({ ...perfect, kb: { updatedMs: NOW - 1 * 24 * 60 * 60 * 1000 } });
assert.equal(byTs, 100, "kb updated yesterday is fully fresh");

// 8) Tooltip + label formatting.
assert.equal(healthTooltip(94, 12), "ARIA Sentinel · Health 94/100 · 12 fixes this week");
assert.equal(healthTooltip(94, 1), "ARIA Sentinel · Health 94/100 · 1 fix this week");
assert.equal(healthTooltip(94, 0), "ARIA Sentinel · Health 94/100");
assert.equal(healthTooltip(88), "ARIA Sentinel · Health 88/100");
assert.equal(healthLabel(75), "Watch");
assert.equal(healthLabel(55), "Degraded");

// 9) Score is always clamped to [0,100] even with absurd inputs.
const wild = score({ recipeOutcomes: { success: 1e9, failure: -5 }, serviceNow: { queued: -100 } });
assert.ok(wild >= 0 && wild <= 100, "score stays within 0..100");

console.log("Health-score test passed (5 factors, weights sum 100, perfect=100, broken=0).");
