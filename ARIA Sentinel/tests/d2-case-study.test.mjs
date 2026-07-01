// RUN-D D2 — pilot→paid capture engine. Proves: a case study is REAL-OR-EMPTY (Rule 14) — it does not
// exist until there is a real signed pilot, >=1 real resolved fix, and a matured pilot; numbers come
// straight from the real ROI model (never invented); quotes are never fabricated; a proof is only
// publishable after EXPLICIT consent + draft review (staged, never auto); and the day-10–14 conversion
// moment fires only when there is real proof (no hollow ask) and never blocks the free tier.
import assert from "node:assert/strict";
import {
  buildCaseStudy, caseStudyReadiness, withConsent, publishableCaseStudy, conversionMoment,
  normalizeMetrics, deflectionRate, scrubField,
  CASE_STUDY_SCHEMA, VERTICALS, PILOT_CHECKOUT_PATH,
} from "../src/shared/case-study.mjs";
import { computeRoi } from "../src/shared/roi.mjs";
import { startJourney, recordMilestone, timeToFirstValueMs } from "../src/shared/onboarding-activation.mjs";

let n = 0; const t = () => { n++; };
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-06-30T12:00:00.000Z");
const startedDaysAgo = (d) => new Date(NOW - d * DAY).toISOString();

// A real, matured (day-12 → "expiring") pilot with real fixes/conversations.
const REAL_PILOT = { schema: "pilot.v1", started_at: startedDaysAgo(12), org: "Northwind Books", size: "11-50", pains: ["printer queue", "Outlook loops"] };
const REAL_METRICS = { fixes: 40, conversations: 50, resolvedNoEscalation: 44, avgFirstResponseSec: 3 };
function realActivation() {
  let j = startJourney({ now: NOW - 12 * DAY });
  j = recordMilestone(j, "first_value", { now: NOW - 12 * DAY + 60_000, kind: "kb_answer" });
  return j;
}

// 1 — empty in, empty out: nothing is invented. No pilot / no metrics → not ready, every gap named.
{
  const r = caseStudyReadiness({}, { now: NOW });
  assert.equal(r.ready, false);
  assert.deepEqual(r.missing.sort(), ["pilot-intake", "pilot-matured", "resolved-fixes"]);
  const cs = buildCaseStudy({}, { now: NOW });
  assert.equal(cs.ready, false);
  assert.equal(cs.record, null, "no record fabricated from nothing");
  t();
}

// 2 — a real matured pilot but ZERO resolved fixes → still not ready (a diagnosis is not a proof).
{
  const cs = buildCaseStudy({ pilot: REAL_PILOT, metrics: { fixes: 0, conversations: 30 } }, { now: NOW });
  assert.equal(cs.ready, false);
  assert.ok(cs.missing.includes("resolved-fixes"), "0 fixes → resolved-fixes gap");
  assert.ok(!cs.missing.includes("pilot-intake"));
  assert.ok(!cs.missing.includes("pilot-matured"));
  t();
}

// 3 — real fixes but the pilot is only 2 days in → not mature enough for a case study yet.
{
  const young = { ...REAL_PILOT, started_at: startedDaysAgo(2) };
  const cs = buildCaseStudy({ pilot: young, metrics: REAL_METRICS }, { now: NOW });
  assert.equal(cs.ready, false);
  assert.ok(cs.missing.includes("pilot-matured"), "day-2 pilot is not matured");
  t();
}

// 4 — everything real → ready, and every field is composed from the REAL inputs (nothing guessed).
{
  const cs = buildCaseStudy({ pilot: REAL_PILOT, metrics: REAL_METRICS, activation: realActivation(), vertical: "finance" }, { now: NOW });
  assert.equal(cs.ready, true);
  const rec = cs.record;
  assert.equal(rec.schema, CASE_STUDY_SCHEMA);
  assert.equal(rec.vertical, "finance");
  assert.equal(rec.org, "Northwind Books");
  assert.equal(rec.size, "11-50");
  assert.deepEqual(rec.pains, ["printer queue", "Outlook loops"]);
  assert.equal(rec.days_on_aria, 12, "days on ARIA is the real elapsed count");
  const roi = computeRoi({ fixes: 40 });
  assert.equal(rec.metrics.fixes, 40);
  assert.equal(rec.metrics.hours_saved, roi.hoursSaved, "hours come straight from the real ROI model");
  assert.equal(rec.metrics.dollars_saved, roi.dollarsSaved, "dollars come straight from the real ROI model");
  assert.equal(rec.metrics.deflection_pct, 88, "44/50 = 88% real deflection");
  assert.equal(rec.metrics.time_to_first_value_ms, 60_000, "TTFV is the real onboarding elapsed time");
  assert.equal(rec.quote, null, "no quote is ever fabricated");
  t();
}

// 5 — Rule 14 no-fabrication: deflection null when conversations absent; dollars never invented; paths scrubbed.
{
  // deflection needs BOTH real counts — otherwise null, never a guess.
  assert.equal(deflectionRate({ fixes: 5 }), null, "no conversations → null deflection");
  assert.equal(deflectionRate({ conversations: 0, resolvedNoEscalation: 0 }), null, "0 conversations → null, not 0%/100%");
  assert.equal(deflectionRate({ conversations: 20, resolvedNoEscalation: 15 }), 75);
  // normalizeMetrics never invents a flattering default.
  assert.deepEqual(normalizeMetrics({}), { fixes: null, conversations: null, resolvedNoEscalation: null, avgFirstResponseSec: null });
  assert.equal(normalizeMetrics({ fixes: -3 }).fixes, null, "negative is not a real count");
  // dollars pass through the same audited model on main (no separate/inflated math).
  const cs = buildCaseStudy({ pilot: REAL_PILOT, metrics: { fixes: 7 } }, { now: NOW });
  assert.equal(cs.record.metrics.dollars_saved, computeRoi({ fixes: 7 }).dollarsSaved);
  // a filesystem path in the org/pains is scrubbed before it can ever leave the machine.
  const leaky = { ...REAL_PILOT, org: "Acme C:\\Users\\bob\\secret Ltd", pains: ["/home/ahmad/db down"] };
  const csl = buildCaseStudy({ pilot: leaky, metrics: REAL_METRICS }, { now: NOW });
  assert.ok(!/bob|secret/.test(csl.record.org), "no local path leaks into the org name");
  assert.ok(csl.record.org.includes("[path]"));
  assert.ok(!/\/home\/ahmad/.test(JSON.stringify(csl.record.pains)), "no local path leaks into pains");
  t();
}

// 6 — CONSENT GATE: a proof is not publishable until consent is explicitly granted AND the draft reviewed.
{
  const cs = buildCaseStudy({ pilot: REAL_PILOT, metrics: REAL_METRICS }, { now: NOW });
  assert.equal(publishableCaseStudy(cs), null, "ready but no consent → not publishable (staged, never auto)");
  const granted = withConsent(cs, { granted: true });
  assert.equal(publishableCaseStudy(granted), null, "consent but draft NOT reviewed → still not publishable");
  const ok = withConsent(cs, { granted: true, draftReviewed: true });
  const pub = publishableCaseStudy(ok);
  assert.ok(pub && pub.schema === CASE_STUDY_SCHEMA, "granted + reviewed → publishable record returned");
  assert.equal(pub.consent.anonymous, true, "anonymous is the safe default");
  assert.equal(pub.consent.attribution, "", "no attribution unless anonymity is explicitly waived");
  // named attribution + a real consented quote only when the customer explicitly waives anonymity.
  const named = withConsent(cs, { granted: true, draftReviewed: true, anonymous: false, attribution: "J. Doe, Firm Admin", quote: "ARIA answered before we opened a ticket." });
  const npub = publishableCaseStudy(named);
  assert.equal(npub.consent.anonymous, false);
  assert.equal(npub.consent.attribution, "J. Doe, Firm Admin");
  assert.equal(npub.quote, "ARIA answered before we opened a ticket.");
  // withdrawing consent (granted:false) keeps the quote empty — never carried over silently.
  const revoked = withConsent(cs, { granted: false, quote: "put words in their mouth" });
  assert.equal(revoked.record.quote, null, "no consent → no quote, ever");
  assert.equal(publishableCaseStudy(revoked), null);
  t();
}

// 7 — CONVERSION MOMENT: fires only on a matured pilot WITH real proof; never blocks; points at the real funnel.
{
  // active (day-2) pilot → no conversion push yet.
  const young = { ...REAL_PILOT, started_at: startedDaysAgo(2) };
  assert.deepEqual(conversionMoment({ pilot: young, metrics: REAL_METRICS }, { now: NOW }), { show: false, reason: "pilot-not-matured" });
  // matured but no real fixes → we do NOT make a hollow ask.
  assert.deepEqual(conversionMoment({ pilot: REAL_PILOT, metrics: { fixes: 0 } }, { now: NOW }), { show: false, reason: "no-real-proof" });
  // matured (expiring) + real proof → show, non-blocking, real numbers, real on-site funnel path.
  const cm = conversionMoment({ pilot: REAL_PILOT, metrics: REAL_METRICS }, { now: NOW });
  assert.equal(cm.show, true);
  assert.equal(cm.stage, "expiring");
  assert.equal(cm.non_blocking, true, "the conversion moment never locks the user out");
  assert.equal(cm.proof.fixes, 40);
  assert.equal(cm.proof.dollars_saved, computeRoi({ fixes: 40 }).dollarsSaved);
  assert.equal(cm.proof.deflection_pct, 88);
  assert.equal(cm.cta.path, PILOT_CHECKOUT_PATH);
  assert.equal(cm.cta.path, "/plans");
  // expired pilot → still shows, with the "keep ARIA" framing.
  const expired = { ...REAL_PILOT, started_at: startedDaysAgo(20) };
  const cmx = conversionMoment({ pilot: expired, metrics: REAL_METRICS }, { now: NOW });
  assert.equal(cmx.show, true);
  assert.equal(cmx.stage, "expired");
  assert.equal(cmx.cta.label, "Keep ARIA — choose a plan");
  t();
}

// 8 — sanity: constants + unknown vertical falls back to generic (never an invented vertical).
{
  assert.equal(CASE_STUDY_SCHEMA, "case-study.v1");
  assert.deepEqual(VERTICALS, ["finance", "healthcare", "legal", "generic"]);
  assert.equal(PILOT_CHECKOUT_PATH, "/plans");
  const cs = buildCaseStudy({ pilot: REAL_PILOT, metrics: REAL_METRICS, vertical: "aerospace" }, { now: NOW });
  assert.equal(cs.record.vertical, "generic", "unknown vertical → generic, not fabricated");
  assert.equal(scrubField(null), "");
  t();
}

assert.equal(n, 8, "8 case-study (D2) test groups");
console.log(`d2-case-study test passed (${n} groups · real-or-empty proof · numbers from the audited ROI model · quotes never fabricated · consent+draft gate before publish · conversion moment only on real proof, never blocking · funnel path /plans).`);
