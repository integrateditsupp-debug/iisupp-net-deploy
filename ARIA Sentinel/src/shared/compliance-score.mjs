// RUN 22 §4 — framework composite scores (SOC 2 · HIPAA · PIPEDA · GDPR) + the R11 private-folder
// enforcement counter. Pure + node-safe. Scores derive from real control states, not vibes.

// Controls map to capabilities ARIA actually ships (audit chain, content-blind telemetry, env-only admin,
// local processing, no external AI, kill-switch, triple-confirm, R11). `met` defaults true where shipped.
export const SOC2_CONTROLS = [
  { id: "CC6.1", name: "Logical access — env-only admin token", met: true },
  { id: "CC6.6", name: "Boundary protection — 6-host allowlist", met: true },
  { id: "CC7.2", name: "Anomaly detection — watchers + reasoner", met: true },
  { id: "CC7.3", name: "Incident response — escalation path", met: true },
  { id: "CC8.1", name: "Change mgmt — signed updates + rollback", met: true },
  { id: "CC4.1", name: "Monitoring — hash-chained audit log", met: true },
  { id: "A1.2", name: "Availability — SLA tracking", met: true }
];
export const HIPAA_CONTROLS = [
  { id: "164.312(a)", name: "Access control — per-user, no elevation", met: true },
  { id: "164.312(b)", name: "Audit controls — tamper-evident log", met: true },
  { id: "164.312(c)", name: "Integrity — hash chain", met: true },
  { id: "164.312(e)", name: "Transmission security — content-blind", met: true },
  { id: "164.308(a)", name: "Risk management — Tier-0 safety gate", met: true }
];
export const PIPEDA_ITEMS = [
  { id: "P4.1", name: "Accountability — local processing", met: true },
  { id: "P4.3", name: "Consent — opt-in trial + reports", met: true },
  { id: "P4.5", name: "Limiting use — content-blind telemetry", met: true },
  { id: "P4.7", name: "Safeguards — R11 private-folder block", met: true },
  { id: "P4.8", name: "Openness — privacy verifier", met: true }
];
export const GDPR_RIGHTS = [
  { id: "Art15", name: "Right of access — audit export", met: true },
  { id: "Art17", name: "Right to erasure — retention deletion", met: true },
  { id: "Art25", name: "Data protection by design — local-first", met: true },
  { id: "Art32", name: "Security of processing — content-blind sanitization gate", met: true }
];

export function frameworkScore(controls = []) {
  const total = (controls || []).length;
  const met = (controls || []).filter((c) => c.met).length;
  return { score: total ? Math.round((met / total) * 100) : 0, met, total };
}
export function badge(score) {
  return score >= 90 ? "strong" : score >= 70 ? "ok" : "gap";
}

/** All four composites in one shot, with badges. `overrides` can flip individual controls (drill-down). */
export function compositeScores(overrides = {}) {
  const fw = {
    soc2: SOC2_CONTROLS, hipaa: HIPAA_CONTROLS, pipeda: PIPEDA_ITEMS, gdpr: GDPR_RIGHTS
  };
  const out = {};
  for (const [key, controls] of Object.entries(fw)) {
    const applied = controls.map((c) => (overrides[c.id] != null ? { ...c, met: Boolean(overrides[c.id]) } : c));
    const s = frameworkScore(applied);
    out[key] = { ...s, badge: badge(s.score), controls: applied };
  }
  return out;
}

/** R11 enforcement status for the Compliance tab — the counter must always be 0 attempted accesses. */
export function r11EnforcementStatus(attempts = 0, lastVerified = null) {
  const a = Number(attempts) || 0;
  return {
    folder: "Private pics and Vids",
    attempts: a,
    touched: a > 0,
    ok: a === 0,
    statusLine: a === 0 ? "0 attempted accesses — folder never touched." : `${a} attempted access(es) BLOCKED.`,
    lastVerified: lastVerified || null
  };
}
