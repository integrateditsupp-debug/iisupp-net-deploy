// RUN 22 §7 — admin-side fleet aggregation across heartbeating licenses (pure, kept out of the Netlify
// handler so it's testable without @netlify/blobs). Used by the "Fleet Performance" + "Cohort SLA" views.
import { tierSla } from "../main/sla-tracker.mjs";

/** Roll up heartbeat records into fleet KPIs. record = { licenseId, version, healthScore, startupEnabled, receivedAt, tier }. */
export function aggregateFleet(records = [], now = Date.now()) {
  const recs = records || [];
  const versions = {};
  let healthSum = 0, healthN = 0, startupOff = 0, silent24h = 0;
  for (const r of recs) {
    if (r.version) versions[r.version] = (versions[r.version] || 0) + 1;
    if (Number.isFinite(r.healthScore)) { healthSum += r.healthScore; healthN += 1; }
    if (r.startupEnabled === false) startupOff += 1;
    const seen = Date.parse(r.receivedAt || 0);
    if (!seen || now - seen > 24 * 60 * 60 * 1000) silent24h += 1;
  }
  return {
    licenses: recs.length,
    versions,
    avgHealth: healthN ? Math.round((healthSum / healthN) * 10) / 10 : null,
    startupDisabled: startupOff,
    silent24h
  };
}

/** % of each tier-cohort meeting its SLA floor. records carry { tier, slaComposite }. */
export function cohortSla(records = []) {
  const tiers = ["personal", "pro", "smb", "midsize", "enterprise"];
  const out = {};
  for (const tier of tiers) {
    const xs = (records || []).filter((r) => r.tier === tier && Number.isFinite(r.slaComposite));
    const floor = tierSla(tier).uptimeTarget;
    const meeting = xs.filter((r) => r.slaComposite >= floor).length;
    out[tier] = { count: xs.length, meeting, pct: xs.length ? Math.round((meeting / xs.length) * 1000) / 10 : 100, floor };
  }
  return out;
}
