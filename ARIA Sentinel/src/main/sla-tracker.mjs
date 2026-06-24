// RUN 22 §3 — contractual SLA tracking. Pure + node-safe. Thresholds are tier-specific; breaches accrue
// service credits that are CALCULATED but NEVER auto-issued (admin sign-off required — revenue protection).
import crypto from "node:crypto";

// Per-tier contractual defaults (uptime · response · resolution · service-credit schedule).
export const TIER_SLA = {
  personal: { uptimeTarget: 99.0, response: { P1: 120, P2: 600, P3: 1800, P4: 7200 }, resolution: { P1: 15, P2: 60, P3: 240, P4: 1440 }, credit: { P1: 0, P2: 0, P3: 0 }, csm: false },
  pro: { uptimeTarget: 99.5, response: { P1: 60, P2: 300, P3: 900, P4: 3600 }, resolution: { P1: 15, P2: 60, P3: 240, P4: 1440 }, credit: { P1: 0, P2: 0, P3: 0 }, csm: false },
  smb: { uptimeTarget: 99.9, response: { P1: 30, P2: 120, P3: 600, P4: 3600 }, resolution: { P1: 15, P2: 60, P3: 240, P4: 1440 }, credit: { P1: 5, P2: 1, P3: 0.1 }, csm: false },
  midsize: { uptimeTarget: 99.95, response: { P1: 30, P2: 120, P3: 600, P4: 3600 }, resolution: { P1: 15, P2: 60, P3: 240, P4: 1440 }, credit: { P1: 10, P2: 2, P3: 0.2 }, csm: false },
  enterprise: { uptimeTarget: 99.99, response: { P1: 15, P2: 60, P3: 300, P4: 1800 }, resolution: { P1: 15, P2: 60, P3: 240, P4: 1440 }, credit: { P1: 15, P2: 3, P3: 0.3 }, csm: true }
};

export function tierSla(tier) { return TIER_SLA[tier] || TIER_SLA.personal; }

/** Uptime % over a window from downtime events ({startMs, durationMs}). */
export function uptimePct(downtime = [], windowMs = 30 * 24 * 60 * 60 * 1000) {
  const down = (downtime || []).reduce((s, d) => s + (Number(d.durationMs) || 0), 0);
  return Math.round(Math.max(0, (1 - down / windowMs)) * 10000) / 100;
}

/** % of detections that met the response-time threshold, per severity. detection.responseMs = detect latency. */
export function responseMet(detections = [], tier = "personal") {
  const t = tierSla(tier).response;
  const out = {};
  for (const sev of ["P1", "P2", "P3", "P4"]) {
    const xs = (detections || []).filter((d) => d.severity === sev);
    out[sev] = xs.length ? Math.round((xs.filter((d) => (Number(d.responseMs) || 0) / 1000 <= t[sev]).length / xs.length) * 1000) / 10 : 100;
  }
  return out;
}
/** % of detections resolved inside the resolution threshold, per severity. resolveMs in ms; threshold in minutes. */
export function resolutionMet(detections = [], tier = "personal") {
  const t = tierSla(tier).resolution;
  const out = {};
  for (const sev of ["P1", "P2", "P3", "P4"]) {
    const xs = (detections || []).filter((d) => d.severity === sev && d.resolved);
    out[sev] = xs.length ? Math.round((xs.filter((d) => (Number(d.resolveMs) || 0) / 60000 <= t[sev]).length / xs.length) * 1000) / 10 : 100;
  }
  return out;
}

export const BREACH_REASONS = ["timeout", "escalated", "user-deferred", "fullscreen-defer", "network-outage"];

/** Detections that breached either the response or resolution SLA for their severity. */
export function breaches(detections = [], tier = "personal") {
  const t = tierSla(tier);
  const out = [];
  for (const d of detections || []) {
    const sev = d.severity || "P4";
    const respBad = Number.isFinite(d.responseMs) && d.responseMs / 1000 > (t.response[sev] ?? Infinity);
    const resoBad = d.resolved && Number.isFinite(d.resolveMs) && d.resolveMs / 60000 > (t.resolution[sev] ?? Infinity);
    if (respBad || resoBad) out.push({ severity: sev, reason: d.breachReason && BREACH_REASONS.includes(d.breachReason) ? d.breachReason : "timeout", ts: d.ts });
  }
  return out;
}

/**
 * Service credits owed for a set of breaches (CALCULATED ONLY — never auto-issued).
 * @returns {{ owed:number, currency:string, breakdown:object, autoIssue:false }}
 */
export function serviceCredits(breachList = [], tier = "personal", monthlyFee = 0) {
  const sched = tierSla(tier).credit;
  const breakdown = { P1: 0, P2: 0, P3: 0 };
  let pctOwed = 0;
  for (const b of breachList || []) {
    const c = sched[b.severity] || 0;
    if (c) { breakdown[b.severity] += c; pctOwed += c; }
  }
  return {
    owed: Math.round(((Number(monthlyFee) || 0) * pctOwed / 100) * 100) / 100,
    pctOwed: Math.round(pctOwed * 100) / 100,
    currency: "USD",
    breakdown,
    autoIssue: false // credits are never auto-issued; admin sign-off required
  };
}

/** Single compliance-window number for contract review (P1..P4 weighted response+resolution + uptime). */
export function slaCompliance(detections = [], downtime = [], tier = "personal", windowMs) {
  const resp = responseMet(detections, tier);
  const reso = resolutionMet(detections, tier);
  const up = uptimePct(downtime, windowMs);
  const all = [...Object.values(resp), ...Object.values(reso), up];
  const composite = Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10;
  const floor = tierSla(tier).uptimeTarget;
  return { composite, uptime: up, response: resp, resolution: reso, met: composite >= floor, floor };
}

// HMAC-signed sla-state.json (same tamper-resistance as the update-state machine).
export function sealSlaState(state, key = "aria-sla") {
  const sig = crypto.createHmac("sha256", String(key)).update(JSON.stringify(state)).digest("hex");
  return JSON.stringify({ state, sig }, null, 2);
}
export function openSlaState(raw, key = "aria-sla") {
  try {
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    const expected = crypto.createHmac("sha256", String(key)).update(JSON.stringify(p.state)).digest("hex");
    const a = Buffer.from(String(p.sig || ""), "utf8"), b = Buffer.from(expected, "utf8");
    if (a.length === b.length && a.length && crypto.timingSafeEqual(a, b)) return p.state;
  } catch { /* fall through */ }
  return { downtime: [], detections: [], updatedAt: null };
}
