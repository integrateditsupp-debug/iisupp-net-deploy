// RUN-CU / CU4 (2026-10-08) — compliance EVIDENCE, derived from real state (audit P0 #4).
//
// compliance-score.mjs ships every control as `met:true` by literal, so the Compliance tab and the quarterly
// PDF read 100% "strong" on every install — including "signed updates" on an unsigned build and "6-host
// allowlist" on a machine where the privacy verifier has never run. This module turns the controls that
// HAVE a real signal into measured verdicts and labels the rest honestly as capabilities (shipped, not
// measured). Pure + node-safe; main feeds it the live state, tests feed it fixtures.
//
// Evidence kinds:
//   measured     — a real local signal decided met/not-met right now (detail says which)
//   capability   — the feature is shipped and code-defined, but nothing measures it on this device
//   not-evidenced — the signal exists but is missing/stale/failed → NOT met (never a literal pass)
export const PRIVACY_CAPTURE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a capture older than 7 days is not current evidence

function ageMs(iso, now) { const t = Date.parse(iso || ""); return Number.isFinite(t) ? Math.max(0, now - t) : null; }

/**
 * The privacy verdict for the Compliance tab + PDF. Real-or-empty: no capture ever → pass:null, evidenced:false.
 * @param {object} capture  state.lastPrivacyCapture ({ pass, allHostsAllowed, allContentBlind, rows, total, ts })
 */
export function derivePrivacyVerdict(capture, now = Date.now()) {
  if (!capture || !capture.ts) {
    return { pass: null, allowlistOk: null, sanitization: null, ts: "", ageHours: null, evidenced: false, label: "not measured yet — run Live capture (10s) in Compliance & Privacy" };
  }
  const age = ageMs(capture.ts, now);
  const stale = age == null || age > PRIVACY_CAPTURE_MAX_AGE_MS;
  const total = Number(capture.total) || (Array.isArray(capture.rows) ? capture.rows.length : 0);
  const leaking = Number(capture.leakingPayloadCount) || 0;
  const sanitization = total > 0 ? Math.round(((total - leaking) / total) * 100) : (capture.pass ? 100 : null);
  const pass = capture.pass === true;
  return {
    pass,
    allowlistOk: capture.allHostsAllowed === true || (capture.disallowedHostCount === 0),
    sanitization,
    ts: String(capture.ts),
    ageHours: age == null ? null : Math.round(age / 3600000),
    evidenced: !stale,
    label: stale ? `last capture is ${Math.round((age || 0) / 86400000)}d old — re-run Live capture for current evidence` : (pass ? "measured: PASS" : "measured: REVIEW — see the capture rows")
  };
}

/**
 * Per-control evidence from live state. Returns { overrides, evidence } where overrides feeds
 * compositeScores() and evidence is { [controlId]: { kind, met, detail } } for the UI/PDF.
 * @param {object} s {
 *   auditIntegrity:{ok, reason}, auditSealKeyed:boolean, lastPrivacyCapture, signExecutable:boolean,
 *   watchersRunning:boolean, slaHasData:boolean, setupCompleted:boolean, lastRetentionCleanup:iso,
 *   allowlistTestOk:boolean|null, killed:boolean, externalAiCalls:boolean
 * }
 */
export function deriveControlOverrides(s = {}, now = Date.now()) {
  const overrides = {};
  const evidence = {};
  const measured = (id, met, detail) => { overrides[id] = Boolean(met); evidence[id] = { kind: met ? "measured" : "not-evidenced", met: Boolean(met), detail }; };
  const capability = (id, detail) => { evidence[id] = { kind: "capability", met: true, detail }; };

  // Audit chain — measured by the startup verifier (+ the keyed seal file since 0.2.0).
  const auditOk = !(s.auditIntegrity && s.auditIntegrity.ok === false);
  const auditDetail = auditOk ? (s.auditSealKeyed ? "hash chain verified at launch (HMAC-keyed seal)" : "hash chain verified at launch (unkeyed seal — keyed seal pending first write)") : `tamper flagged: ${(s.auditIntegrity && s.auditIntegrity.reason) || "integrity check failed"}`;
  measured("CC4.1", auditOk, auditDetail);
  measured("164.312(b)", auditOk, auditDetail);
  measured("164.312(c)", auditOk, auditDetail);

  // Privacy verifier — measured by the last live capture (must exist, pass, and be ≤7d old).
  const pv = derivePrivacyVerdict(s.lastPrivacyCapture, now);
  const privacyMet = pv.pass === true && pv.evidenced;
  const privacyDetail = pv.evidenced ? (pv.pass ? `live capture PASS (${pv.ageHours}h ago)` : `live capture REVIEW (${pv.ageHours}h ago)`) : pv.label;
  measured("CC6.6", privacyMet && s.allowlistTestOk !== false, s.allowlistTestOk === false ? "allowlist test failed" : privacyDetail);
  measured("164.312(e)", privacyMet, privacyDetail);
  measured("P4.5", privacyMet, privacyDetail);
  measured("P4.8", privacyMet, privacyDetail);
  measured("Art32", privacyMet && pv.sanitization === 100, pv.sanitization == null ? privacyDetail : `sanitization ${pv.sanitization}% (${privacyDetail})`);

  // Change management — an unsigned build cannot claim signed updates.
  measured("CC8.1", s.signExecutable === true, s.signExecutable === true ? "installer is code-signed" : "installer is UNSIGNED (package.json signExecutable:false) — not met until signing is set up");

  // Anomaly detection — watchers actually running.
  measured("CC7.2", s.watchersRunning === true, s.watchersRunning === true ? "detection watchers running" : "detection watchers not running (stopped/paused)");

  // Availability — SLA tracking has data.
  measured("A1.2", s.slaHasData === true, s.slaHasData === true ? "SLA state has recorded intervals" : "no SLA intervals recorded yet");

  // Consent — the Setup wizard was completed (consent + contacts captured).
  measured("P4.3", s.setupCompleted === true, s.setupCompleted === true ? "setup wizard completed (consent + report opt-in recorded)" : "setup wizard not completed");

  // Erasure — retention cleanup ran within 48h.
  const rc = ageMs(s.lastRetentionCleanup, now);
  measured("Art17", rc != null && rc <= 48 * 3600000, rc == null ? "retention cleanup has not run yet" : `retention cleanup ran ${Math.round(rc / 3600000)}h ago`);

  // Risk management — the Tier-0 safety gate is live unless a kill switch has fixes off (then it is enforced, not disabled).
  measured("164.308(a)", true, s.killed ? "kill switch active — all fixes held (gate enforced)" : "Tier-0 gate: supervisor + policy + countdown/approval live");

  // Capabilities (shipped, code-defined, not measured on-device).
  capability("CC6.1", "admin console gated by license plan + env-only server token");
  capability("CC7.3", "escalation path: ticket ref + ServiceNow bridge + support contacts");
  capability("164.312(a)", "runs as the signed-in user; no elevation; per-user store");
  capability("P4.1", s.externalAiCalls ? "local-first; Anthropic fallback was used for a novel question this session" : "local-first; no external AI call this session");
  capability("P4.7", "R11 private-folder guard on every path");
  capability("Art15", "audit export (CSV/PDF/JSON) available");
  capability("Art25", "content-blind by design; local processing first");

  return { overrides, evidence, privacy: pv };
}

/** One-line summary for the PDF/tab: how many controls are measured-met vs not-evidenced vs capability. */
export function summarizeEvidence(evidence = {}) {
  const vals = Object.values(evidence || {});
  const count = (k) => vals.filter((e) => e && e.kind === k).length;
  return { measured: count("measured"), notEvidenced: count("not-evidenced"), capability: count("capability"), total: vals.length };
}
