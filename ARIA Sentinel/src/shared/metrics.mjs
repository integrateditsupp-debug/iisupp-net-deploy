// RUN 22 §2 — operational + AI performance metric computations. Pure + node-safe (no DOM, no Electron),
// computed from real event arrays (detections, recipe executions, diagnoses). Every aggregator is
// deterministic so the Performance tab + quarterly reports show the same numbers the tests assert.

export const L1_BASELINE_MINUTES = 47;   // human L1 ticket baseline (avg minutes per incident)
export const L1_COST_LOW = 50;           // $/incident floor for a human L1 touch
export const L1_COST_HIGH = 150;         // $/incident ceiling

export function mean(nums) {
  const xs = (nums || []).filter((n) => Number.isFinite(n));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
export function median(nums) {
  const xs = (nums || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
export function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

const toMin = (ms) => Math.round((Number(ms) || 0) / 600) / 100; // ms → minutes, 2dp

/** Mean Time To Detect — symptom → flag, in minutes. */
export function mttd(events = []) {
  return toMin(mean((events || []).map((e) => Number(e.detectMs)).filter(Number.isFinite)) );
}
/** Mean Time To Resolve — flag → fix, median minutes (the packet's MTTR). */
export function mttr(events = []) {
  return toMin(median((events || []).map((e) => Number(e.resolveMs)).filter(Number.isFinite)) );
}
/** Resolution time grouped by severity (median minutes per P1..P4). */
export function mttrBySeverity(events = []) {
  const out = {};
  for (const sev of ["P1", "P2", "P3", "P4"]) {
    out[sev] = toMin(median((events || []).filter((e) => e.severity === sev).map((e) => Number(e.resolveMs))));
  }
  return out;
}

/** First-touch resolution rate (resolved without escalation). */
export function firstTouchResolution(events = []) {
  const resolved = (events || []).filter((e) => e.resolved);
  return pct(resolved.filter((e) => !e.escalated).length, resolved.length);
}

/** Auto vs escalated split (for the donut). */
export function autoVsEscalated(events = []) {
  const auto = (events || []).filter((e) => e.resolved && !e.escalated).length;
  const escalated = (events || []).filter((e) => e.escalated).length;
  return { auto, escalated, autoPct: pct(auto, auto + escalated) };
}

/** Detections per day over the last `days` (oldest→newest), for the sparkline. */
export function detectionsPerDay(events = [], days = 14, now = Date.now()) {
  const buckets = new Array(days).fill(0);
  const dayMs = 24 * 60 * 60 * 1000;
  for (const e of events || []) {
    const t = typeof e.ts === "number" ? e.ts : Date.parse(e.ts);
    if (!t) continue;
    const idx = days - 1 - Math.floor((now - t) / dayMs);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

export function recipeSuccessRate(execs = []) {
  return pct((execs || []).filter((e) => e.outcome === "ok" || e.ok === true).length, (execs || []).length);
}
function tallyBy(execs, key) {
  const m = new Map();
  for (const e of execs || []) { const k = e[key] || "unknown"; m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
export function topUsedRecipes(execs = [], n = 5) {
  return [...tallyBy(execs, "recipeId").entries()].map(([recipeId, count]) => ({ recipeId, count }))
    .sort((a, b) => b.count - a.count).slice(0, n);
}
export function topFailingRecipes(execs = [], n = 5) {
  const total = tallyBy(execs, "recipeId");
  const fails = tallyBy((execs || []).filter((e) => !(e.outcome === "ok" || e.ok === true)), "recipeId");
  return [...fails.entries()].map(([recipeId, count]) => ({ recipeId, count, failureRate: pct(count, total.get(recipeId) || count) }))
    .sort((a, b) => b.failureRate - a.failureRate).slice(0, n);
}

// ── AI performance (the moat) ───────────────────────────────────────────────────────────────────────
/** Top-1 diagnosis accuracy, graded by user confirmation (correct === user accepted the top cause). */
export function diagnosisAccuracy(diags = []) {
  const graded = (diags || []).filter((d) => typeof d.correct === "boolean");
  return pct(graded.filter((d) => d.correct).length, graded.length);
}
export function userConfirmationRate(diags = []) {
  return pct((diags || []).filter((d) => d.accepted).length, (diags || []).length);
}
export function fuzzyTop3Accuracy(diags = []) {
  const graded = (diags || []).filter((d) => typeof d.inTop3 === "boolean");
  return pct(graded.filter((d) => d.inTop3).length, graded.length);
}
/**
 * Calibration: when ARIA says "X% confident", is it right X% of the time? Bucket by stated confidence,
 * compare bucket accuracy to its midpoint; score 100 = perfectly calibrated, lower = worse.
 */
export function calibrationScore(diags = []) {
  const graded = (diags || []).filter((d) => typeof d.correct === "boolean" && Number.isFinite(d.confidence));
  if (!graded.length) return 0;
  const buckets = {};
  for (const d of graded) {
    const b = Math.min(9, Math.floor((d.confidence > 1 ? d.confidence / 100 : d.confidence) * 10));
    (buckets[b] ||= { correct: 0, total: 0 });
    buckets[b].total += 1; if (d.correct) buckets[b].correct += 1;
  }
  let err = 0, n = 0;
  for (const b of Object.keys(buckets)) {
    const expected = (Number(b) + 0.5) / 10;
    const actual = buckets[b].correct / buckets[b].total;
    err += Math.abs(expected - actual) * buckets[b].total; n += buckets[b].total;
  }
  return Math.round((1 - err / n) * 100);
}
export function kbHitRate(queries = []) {
  return pct((queries || []).filter((q) => q.matchedKb).length, (queries || []).length);
}
export function anomalySurfacingCount(events = []) {
  return (events || []).filter((e) => e.anomaly).length;
}

// ── ROI (the number the CFO reads) ────────────────────────────────────────────────────────────────
export function timeSavedPerIncident(events = [], baselineMin = L1_BASELINE_MINUTES) {
  const handled = (events || []).filter((e) => e.resolved);
  return toMin(mean(handled.map((e) => Math.max(0, baselineMin * 60000 - (Number(e.resolveMs) || 0)))));
}
export function hoursSavedCumulative(events = [], baselineMin = L1_BASELINE_MINUTES) {
  const handled = (events || []).filter((e) => e.resolved);
  const savedMin = handled.reduce((sum, e) => sum + Math.max(0, baselineMin - (Number(e.resolveMs) || 0) / 60000), 0);
  return Math.round((savedMin / 60) * 100) / 100;
}
export function costPerIncident(events = [], baselineLow = L1_COST_LOW) {
  // ARIA's marginal cost per auto-resolved incident is ~$0 (local, no LLM); savings vs the L1 floor.
  const handled = (events || []).filter((e) => e.resolved && !e.escalated).length;
  return { ariaPerIncident: 0, l1Low: baselineLow, l1High: L1_COST_HIGH, autoResolved: handled, savedLow: handled * baselineLow };
}
