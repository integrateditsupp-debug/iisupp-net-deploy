// case-study — RUN-D D2: the pilot→paid capture engine. Pure, honest composition of a finished pilot's
// OWN real data (intake + ROI math + onboarding activation) into a one-page proof, plus the day-10–14
// conversion moment. Rule 14: real-or-empty — it never invents a number, a quote, or a customer, and
// NOTHING is publishable until consent is explicitly recorded (staged for Ahmad's one-click, never auto).
// No external send, no account creation, no paid API. Mirrors the case-study-templates/ permission gate.

import { computeRoi } from "./roi.mjs";
import { pilotStatus } from "./pilot-state.mjs";
import { timeToFirstValueMs } from "./onboarding-activation.mjs";

export const CASE_STUDY_SCHEMA = "case-study.v1";
export const VERTICALS = ["finance", "healthcare", "legal", "generic"];
// The real on-site funnel target RUN-C guaranteed works and that matches the 6 live Stripe prices.
// We reference the funnel PAGE, never a fabricated hosted-checkout URL.
export const PILOT_CHECKOUT_PATH = "/plans";
const DAY_MS = 24 * 60 * 60 * 1000;

// R11 path/PII scrub — mirrors pilot-state.scrubField so nothing local can leak into a shared proof.
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

// Every metric is a real non-negative number OR null. It NEVER defaults to a flattering value.
export function normalizeMetrics(m = {}) {
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
  return {
    fixes: num(m.fixes),
    conversations: num(m.conversations),
    resolvedNoEscalation: num(m.resolvedNoEscalation),
    avgFirstResponseSec: num(m.avgFirstResponseSec),
  };
}

// Deflection % = resolved-without-escalation ÷ conversations. Null unless BOTH are real (never a guess).
export function deflectionRate(metrics = {}) {
  const m = normalizeMetrics(metrics);
  if (m.conversations == null || m.conversations <= 0) return null;
  if (m.resolvedNoEscalation == null) return null;
  const pct = Math.round((m.resolvedNoEscalation / m.conversations) * 100);
  return Math.max(0, Math.min(100, pct));
}

function pilotMaturity(pilot, now) {
  if (!pilot || !pilot.started_at) return null;
  const t = Date.parse(pilot.started_at);
  if (!Number.isFinite(t)) return null;
  return pilotStatus({ startedAt: t, days: pilot.days || undefined, now }).state;
}

function daysOnAria(pilot, now) {
  if (!pilot || !pilot.started_at) return null;
  const t = Date.parse(pilot.started_at);
  if (!Number.isFinite(t)) return null;
  const d = Math.floor((now - t) / DAY_MS);
  return d >= 0 ? d : null;
}

// What real inputs are still missing before an HONEST case study can exist.
export function caseStudyReadiness({ pilot, metrics, activation } = {}, { now = Date.now() } = {}) {
  const missing = [];
  if (!pilot || !scrubField(pilot.org)) missing.push("pilot-intake");     // a real, signed pilot
  const m = normalizeMetrics(metrics);
  if (m.fixes == null || m.fixes <= 0) missing.push("resolved-fixes");     // >= 1 REAL resolved fix
  const maturity = pilotMaturity(pilot, now);
  if (maturity !== "expiring" && maturity !== "expired") missing.push("pilot-matured"); // day 10–14+
  return { ready: missing.length === 0, missing, maturity };
}

// Compose the one-page proof — REAL-OR-EMPTY. Returns {ready:false, missing} until every real input exists.
export function buildCaseStudy(
  { pilot, metrics, activation, vertical = "generic", hourlyRate, minutesPerFix } = {},
  { now = Date.now() } = {}
) {
  const readiness = caseStudyReadiness({ pilot, metrics, activation }, { now });
  if (!readiness.ready) return { ready: false, missing: readiness.missing, record: null };
  const m = normalizeMetrics(metrics);
  const roi = computeRoi({ fixes: m.fixes, hourlyRate, minutesPerFix });
  const ttfvMs = activation ? timeToFirstValueMs(activation) : null;
  const v = VERTICALS.includes(vertical) ? vertical : "generic";
  return {
    ready: true,
    missing: [],
    record: {
      schema: CASE_STUDY_SCHEMA,
      generated_at: new Date(now).toISOString(),
      vertical: v,
      org: scrubField(pilot.org),
      size: pilot.size != null ? String(pilot.size) : null,
      pains: Array.isArray(pilot.pains) ? pilot.pains.map(scrubField).filter(Boolean) : [],
      days_on_aria: daysOnAria(pilot, now),
      metrics: {
        fixes: m.fixes,
        conversations: m.conversations,
        resolved_no_escalation: m.resolvedNoEscalation,
        deflection_pct: deflectionRate(metrics),
        avg_first_response_sec: m.avgFirstResponseSec,
        time_to_first_value_ms: ttfvMs,
        hours_saved: roi.hoursSaved,
        dollars_saved: roi.dollarsSaved,
        hourly_rate: roi.hourlyRate,
        minutes_per_fix: roi.minutesPerFix,
      },
      // Rule 14: a quote is NEVER fabricated — it stays null until a real, consented customer quote is added.
      quote: null,
      // Consent gate (mirrors the case-study templates' "Permission record — do NOT publish" line).
      consent: { granted: false, anonymous: true, attribution: "", consented_at: null, draft_reviewed: false },
    },
  };
}

// Record explicit, dated customer consent. Nothing here is inferred; default stays anonymous (safer).
export function withConsent(caseStudy, consent = {}) {
  if (!caseStudy || !caseStudy.record) return caseStudy;
  const granted = consent.granted === true;
  const anonymous = consent.anonymous !== false; // default true
  return {
    ...caseStudy,
    record: {
      ...caseStudy.record,
      quote: granted && consent.quote ? scrubField(consent.quote) : caseStudy.record.quote,
      consent: {
        granted,
        anonymous,
        attribution: granted && !anonymous ? scrubField(consent.attribution || "") : "",
        consented_at: granted && consent.consentedAt ? String(consent.consentedAt) : null,
        draft_reviewed: consent.draftReviewed === true,
      },
    },
  };
}

// Returns the record ONLY when consent is explicitly granted (and the draft was reviewed). Else null —
// staged, never auto-published. This is the one-click gate for Ahmad, not an autonomous publish.
export function publishableCaseStudy(caseStudy, { requireDraftReview = true } = {}) {
  if (!caseStudy || !caseStudy.ready || !caseStudy.record) return null;
  const c = caseStudy.record.consent || {};
  if (c.granted !== true) return null;
  if (requireDraftReview && c.draft_reviewed !== true) return null;
  return caseStudy.record;
}

// The day-10–14 pilot→paid moment. Fires ONLY when the pilot has matured AND there is REAL proof — we
// never make a hollow ask. Non-blocking: the free Manual tier always remains after expiry (matches
// pilot-state's upgrade prompt).
export function conversionMoment(
  { pilot, metrics, checkoutPath = PILOT_CHECKOUT_PATH } = {},
  { now = Date.now() } = {}
) {
  const maturity = pilotMaturity(pilot, now);
  if (maturity !== "expiring" && maturity !== "expired") return { show: false, reason: "pilot-not-matured" };
  const m = normalizeMetrics(metrics);
  if (m.fixes == null || m.fixes <= 0) return { show: false, reason: "no-real-proof" };
  const roi = computeRoi({ fixes: m.fixes });
  return {
    show: true,
    stage: maturity,
    non_blocking: true,
    proof: {
      fixes: m.fixes,
      deflection_pct: deflectionRate(metrics),
      hours_saved: roi.hoursSaved,
      dollars_saved: roi.dollarsSaved,
    },
    cta: {
      label: maturity === "expired" ? "Keep ARIA — choose a plan" : "Continue on a paid plan",
      path: checkoutPath,
    },
  };
}
