// health-score — one number (0-100) that tells an admin, at a glance, whether this endpoint's
// ARIA Sentinel is healthy. PURE + deterministic: it takes a plain state snapshot and returns a
// score, a label, and the per-factor breakdown. No Electron, no I/O, no clock — the caller passes
// `nowMs` so the function stays testable and replayable.
//
// Five weighted factors (weights sum to 100):
//   watcherHeartbeats   25  — are the detection watchers alive and reporting?
//   recipeSuccess30d    30  — of the fixes attempted in the last 30 days, how many succeeded?
//   serviceNowQueue     15  — is the outbound ITSM queue draining (not backed up / failing)?
//   kbFreshness         15  — how stale is the local knowledge bundle?
//   auditIntegrity      15  — is the append-only audit log intact (no tamper, no gaps)?
//
// Every factor is normalised to 0..1, multiplied by its weight, summed and rounded. Missing
// inputs degrade gracefully to a neutral-but-honest value rather than throwing.

export const HEALTH_WEIGHTS = Object.freeze({
  watcherHeartbeats: 25,
  recipeSuccess30d: 30,
  serviceNowQueue: 15,
  kbFreshness: 15,
  auditIntegrity: 15
});

// Tuning constants — kept named so the test (and a reviewer) can see the thresholds.
const EXPECTED_WATCHERS = 7;            // 7 Windows detectors ship today
const HEARTBEAT_STALE_MS = 5 * 60 * 1000; // a watcher silent > 5 min counts as down
const QUEUE_HEALTHY_MAX = 20;           // queued items at/under this = no penalty
const KB_FRESH_DAYS = 7;                // bundle younger than a week = perfectly fresh
const KB_STALE_DAYS = 37;               // by ~a month past fresh, freshness credit is gone
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function ratio(part, whole) {
  // No work attempted is healthy, not a divide-by-zero: an idle factor scores 1.
  if (!Number.isFinite(whole) || whole <= 0) return 1;
  return clamp01(Number(part) / whole);
}

function watcherHeartbeatsScore(state, nowMs) {
  const hb = state.heartbeats;
  if (!hb) return 1; // nothing reported yet (fresh install) — don't punish.
  // Accept either a summary {healthy,total} or an array of {lastBeatMs|lastBeatUtc}.
  if (Array.isArray(hb)) {
    const total = hb.length || EXPECTED_WATCHERS;
    const alive = hb.filter((w) => {
      const last = Number.isFinite(w.lastBeatMs) ? w.lastBeatMs : Date.parse(w.lastBeatUtc || "");
      return Number.isFinite(last) && nowMs - last <= HEARTBEAT_STALE_MS;
    }).length;
    return ratio(alive, total);
  }
  const total = Number.isFinite(hb.total) ? hb.total : EXPECTED_WATCHERS;
  return ratio(hb.healthy, total);
}

function recipeSuccessScore(state) {
  const r = state.recipeOutcomes || {};
  const success = Number(r.success) || 0;
  const failure = Number(r.failure) || 0;
  return ratio(success, success + failure);
}

function serviceNowQueueScore(state) {
  const q = state.serviceNow || {};
  const queued = Math.max(0, Number(q.queued) || 0);
  const failed = Math.max(0, Number(q.failed) || 0);
  // Backlog above the healthy max erodes the score linearly; each failed send is a hard hit.
  const backlogPenalty = Math.max(0, queued - QUEUE_HEALTHY_MAX) / QUEUE_HEALTHY_MAX;
  const failPenalty = failed * 0.15;
  return clamp01(1 - backlogPenalty - failPenalty);
}

function kbFreshnessScore(state, nowMs) {
  const kb = state.kb || {};
  let ageDays = kb.ageDays;
  if (!Number.isFinite(ageDays)) {
    const updated = Number.isFinite(kb.updatedMs) ? kb.updatedMs : Date.parse(kb.updatedUtc || "");
    if (!Number.isFinite(updated)) return 1; // unknown age on a fresh install — neutral-healthy.
    ageDays = (nowMs - updated) / DAY_MS;
  }
  if (ageDays <= KB_FRESH_DAYS) return 1;
  if (ageDays >= KB_STALE_DAYS) return 0;
  return clamp01(1 - (ageDays - KB_FRESH_DAYS) / (KB_STALE_DAYS - KB_FRESH_DAYS));
}

function auditIntegrityScore(state) {
  const a = state.audit || {};
  if (a.tampered === true) return 0; // any detected tamper zeroes this factor outright.
  const entries = Number(a.entries) || 0;
  if (entries <= 0) return 1; // nothing logged yet — intact by definition.
  const valid = Number.isFinite(a.valid) ? a.valid : entries;
  return ratio(valid, entries);
}

/**
 * Compute the 0-100 health score from a state snapshot.
 * @param {object} state  see factor readers above for the accepted shape
 * @param {object} [opts] { nowMs } — defaults to Date.now() only at the call site (kept out of
 *                         the pure core so tests pass a fixed clock)
 * @returns {{score:number,label:string,factors:object}}
 */
export function computeHealthScore(state = {}, opts = {}) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const normalized = {
    watcherHeartbeats: watcherHeartbeatsScore(state, nowMs),
    recipeSuccess30d: recipeSuccessScore(state),
    serviceNowQueue: serviceNowQueueScore(state),
    kbFreshness: kbFreshnessScore(state, nowMs),
    auditIntegrity: auditIntegrityScore(state)
  };
  let total = 0;
  const factors = {};
  for (const [key, weight] of Object.entries(HEALTH_WEIGHTS)) {
    const n = clamp01(normalized[key]);
    const points = n * weight;
    total += points;
    factors[key] = { normalized: Math.round(n * 100) / 100, weight, points: Math.round(points * 10) / 10 };
  }
  const score = Math.max(0, Math.min(100, Math.round(total)));
  return { score, label: healthLabel(score), factors };
}

export function healthLabel(score) {
  if (score >= 90) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 50) return "Degraded";
  return "Critical";
}

/**
 * Tray-tooltip line, e.g. "ARIA Sentinel · Health 94/100 · 12 fixes this week".
 * fixesThisWeek is optional; when absent the fixes clause is dropped.
 */
export function healthTooltip(score, fixesThisWeek) {
  const base = `ARIA Sentinel · Health ${score}/100`;
  if (Number.isFinite(fixesThisWeek) && fixesThisWeek > 0) {
    return `${base} · ${fixesThisWeek} fix${fixesThisWeek === 1 ? "" : "es"} this week`;
  }
  return base;
}
