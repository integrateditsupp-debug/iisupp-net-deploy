// RUN 9 — ROI calculator. Asserts math correctness + edge cases (0 fixes, very large, custom rate).
import assert from "node:assert/strict";
import { computeRoi, roiSummary, DEFAULT_HOURLY_RATE, DEFAULT_MINUTES_PER_FIX } from "../src/shared/roi.mjs";

// Defaults: 12 fixes × 20 min = 240 min = 4.0 hrs × $75 = $300.
const r = computeRoi({ fixes: 12 });
assert.equal(r.hourlyRate, DEFAULT_HOURLY_RATE);
assert.equal(r.minutesPerFix, DEFAULT_MINUTES_PER_FIX);
assert.equal(r.hoursSaved, 4.0);
assert.equal(r.dollarsSaved, 300);
assert.match(roiSummary(r), /12 issues/);
assert.match(roiSummary(r), /\$300/);

// Custom rate.
assert.equal(computeRoi({ fixes: 10, hourlyRate: 120, minutesPerFix: 30 }).dollarsSaved, Math.round((10 * 30 / 60) * 120)); // 5h × 120 = 600

// Edge: 0 fixes.
const zero = computeRoi({ fixes: 0 });
assert.equal(zero.hoursSaved, 0);
assert.equal(zero.dollarsSaved, 0);
assert.match(roiSummary(zero), /fixed 0 issues/);

// Edge: very large (no overflow / NaN).
const big = computeRoi({ fixes: 1_000_000 });
assert.ok(Number.isFinite(big.dollarsSaved) && big.dollarsSaved > 0);

// Edge: garbage input → safe defaults, never NaN.
const junk = computeRoi({ fixes: "abc", hourlyRate: -5, minutesPerFix: 0 });
assert.equal(junk.fixes, 0);
assert.equal(junk.hourlyRate, DEFAULT_HOURLY_RATE, "negative rate falls back to default... ");
assert.ok(Number.isFinite(junk.dollarsSaved));

// Singular grammar.
assert.match(roiSummary(computeRoi({ fixes: 1, minutesPerFix: 60 })), /fixed 1 issue,/);

console.log("ROI-calc test passed (math · custom rate · 0 fixes · very large · garbage-safe).");
