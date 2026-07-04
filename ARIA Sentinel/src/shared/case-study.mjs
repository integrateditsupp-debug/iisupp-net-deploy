import { pilotStatus } from "./pilot-state.mjs";

function parseStart(pilot = {}) {
  const t = Date.parse(String(pilot.started_at || pilot.startedAt || ""));
  return Number.isFinite(t) ? t : null;
}

export function caseStudyReadiness({ pilot = null, metrics = {} } = {}) {
  if (!pilot) return { ready: false, reason: "no-pilot" };
  if (pilot.case_study_consent !== true && pilot.caseStudyConsent !== true) {
    return { ready: false, reason: "consent-required" };
  }
  if (!(Number(metrics.fixes) > 0 || Number(metrics.resolved) > 0)) {
    return { ready: false, reason: "proof-required" };
  }
  return { ready: true, reason: "ready" };
}

export function conversionMoment({ pilot = null, metrics = {}, now = Date.now() } = {}) {
  const started = parseStart(pilot || {});
  if (started == null) return { show: false, reason: "no-pilot" };
  const ageDays = Math.floor((now - started) / (24 * 60 * 60 * 1000));
  const status = pilotStatus({ startedAt: started, now });
  const proof = {
    fixes: Number(metrics.fixes) || 0,
    hours_saved: metrics.hours_saved == null ? null : Number(metrics.hours_saved),
    deflectionPct: metrics.deflectionPct == null ? null : metrics.deflectionPct
  };
  const hasProof = proof.fixes > 0 || proof.deflectionPct != null;
  const inWindow = ageDays >= 10 || status.state === "expiring" || status.state === "expired";
  if (!hasProof || !inWindow) return { show: false, reason: hasProof ? "not-time" : "no-proof", proof };
  return {
    show: true,
    state: status.state,
    proof,
    cta: { label: "Review pilot proof", path: "case-study" }
  };
}

export function buildCaseStudy({ pilot = null, metrics = {}, vertical = "" } = {}) {
  const readiness = caseStudyReadiness({ pilot, metrics });
  if (!readiness.ready) return { ready: false, reason: readiness.reason, publishable: false, sections: [] };
  return {
    ready: true,
    publishable: false,
    title: "ARIA Sentinel Pilot Proof",
    vertical: String(vertical || pilot?.vertical || "SMB operations").slice(0, 80),
    consent: true,
    proof: {
      fixes: Number(metrics.fixes) || 0,
      resolved: Number(metrics.resolved) || 0,
      hours_saved: metrics.hours_saved == null ? null : Number(metrics.hours_saved),
      deflectionPct: metrics.deflectionPct == null ? null : metrics.deflectionPct
    },
    sections: [
      "Pilot context",
      "Measured outcomes",
      "Operational value",
      "Next-step recommendation"
    ]
  };
}
