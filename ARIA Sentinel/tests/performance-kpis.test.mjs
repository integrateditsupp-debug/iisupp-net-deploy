// RUN 22 §2 — operational KPIs (MTTD / MTTR / first-touch / auto-vs-escalated / recipe success).
import assert from "node:assert/strict";
import { mttd, mttr, mttrBySeverity, firstTouchResolution, autoVsEscalated, recipeSuccessRate, topFailingRecipes, topUsedRecipes, detectionsPerDay } from "../src/shared/metrics.mjs";

const events = [
  { detectMs: 6000, resolveMs: 120000, severity: "P1", resolved: true, escalated: false },
  { detectMs: 12000, resolveMs: 600000, severity: "P2", resolved: true, escalated: true },
  { detectMs: 9000, resolveMs: 300000, severity: "P3", resolved: true, escalated: false },
  { detectMs: 3000, severity: "P4", resolved: false }
];

// MTTD = mean detect minutes; MTTR = median resolve minutes.
assert.equal(mttd(events), 0.13, "mean detect ≈ 7.5s → 0.13min");
assert.equal(mttr(events), 5, "median resolve of [2,10,5]min = 5min");
assert.equal(mttrBySeverity(events).P1, 2);

// First-touch resolution = resolved-without-escalation / resolved.
assert.equal(firstTouchResolution(events), 66.7, "2 of 3 resolved without escalation");

// Auto vs escalated.
const split = autoVsEscalated(events);
assert.equal(split.auto, 2);
assert.equal(split.escalated, 1);
assert.equal(split.autoPct, 66.7);

// Recipe success rate + top failing/used.
const execs = [
  { recipeId: "flush-dns", outcome: "ok" }, { recipeId: "flush-dns", outcome: "ok" },
  { recipeId: "spooler", outcome: "fail" }, { recipeId: "spooler", outcome: "ok" }, { recipeId: "spooler", outcome: "fail" }
];
assert.equal(recipeSuccessRate(execs), 60, "3 of 5 ok");
assert.equal(topUsedRecipes(execs, 1)[0].recipeId, "spooler");
const failing = topFailingRecipes(execs, 1)[0];
assert.equal(failing.recipeId, "spooler");
assert.equal(failing.failureRate, 66.7, "2 of 3 spooler runs failed");

// Detections-per-day sparkline buckets.
const now = Date.parse("2026-07-05T12:00:00Z");
const buckets = detectionsPerDay([{ ts: now }, { ts: now - 24 * 3600e3 }, { ts: now }], 7, now);
assert.equal(buckets.length, 7);
assert.equal(buckets[6], 2, "two detections today");

console.log("Performance-kpis test passed (MTTD/MTTR/FTR/auto-escalated/recipe-success computed correctly).");
