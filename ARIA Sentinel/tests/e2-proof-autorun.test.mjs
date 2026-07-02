// RUN-E E2 — pilot → paid PROOF AUTORUN. A matured REAL pilot auto-drafts the honest one-page proof
// (real deflection % + hours/ROI straight from the audited model) and surfaces the /plans conversion
// moment — write-once, consent-gated, staged for Ahmad's explicit one-click. 🔒 Rule 14 real-or-empty:
// an immature or zero-fix pilot produces NO draft and NO ask, ever. Nothing here fabricates a number,
// a quote, or a customer; nothing publishes autonomously.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  autorunCaseStudy, buildCaseStudy, conversionMoment, publishableCaseStudy, withConsent, CASE_STUDY_SCHEMA
} from "../src/shared/case-study.mjs";
import { pilotProofMetrics } from "../src/shared/resolution-outcome.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-02T00:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();
const startedAgo = (d) => ({ org: "Northside Clinic", size: "11-50", pains: ["printers", "vpn"], started_at: iso(NOW - d * DAY) });

// ── autorun is REAL-OR-EMPTY: no pilot / immature / zero-fix => changed:false with the honest reason ──
assert.equal(autorunCaseStudy({}, { now: NOW }).changed, false, "no inputs => no draft");
const immature = autorunCaseStudy({ pilot: startedAgo(2), metrics: { fixes: 9 } }, { now: NOW });
assert.equal(immature.changed, false, "day-2 pilot NEVER drafts, even with real fixes");
assert.match(immature.reason, /pilot-matured/, "reason names the missing real input");
const zeroFix = autorunCaseStudy({ pilot: startedAgo(12), metrics: { fixes: 0 } }, { now: NOW });
assert.equal(zeroFix.changed, false, "matured but 0 real fixes => NO draft (no hollow proof)");
assert.match(zeroFix.reason, /resolved-fixes/);
assert.equal(zeroFix.record, null, "empty means EMPTY — no partial record");

// ── the autorun moment: matured + real proof => drafted once, consent ungranted ───────────────────────
const first = autorunCaseStudy({ pilot: startedAgo(12), metrics: { fixes: 3, conversations: 10, resolvedNoEscalation: 7 } }, { now: NOW });
assert.equal(first.changed, true, "day-12 + 3 real fixes => the proof drafts itself");
assert.equal(first.reason, "drafted");
assert.equal(first.record.schema, CASE_STUDY_SCHEMA);
assert.equal(first.record.metrics.fixes, 3, "fixes = the real count, untouched");
assert.equal(first.record.metrics.deflection_pct, 70, "deflection = real resolved/conversations (7/10)");
assert.equal(first.record.quote, null, "a quote is NEVER fabricated");
assert.equal(first.record.consent.granted, false, "consent starts UNGRANTED — publish stays Ahmad's one-click");

// ── write-once: an existing draft is never rewritten (autorun refuses to rewrite history) ─────────────
const again = autorunCaseStudy({ pilot: startedAgo(13), metrics: { fixes: 99, conversations: 1, resolvedNoEscalation: 1 }, existingDraft: first.record }, { now: NOW + DAY });
assert.equal(again.changed, false, "write-once: a second maturity pass never redrafts");
assert.equal(again.reason, "already-drafted");
assert.equal(again.record.metrics.fixes, 3, "the ORIGINAL record survives untouched");
assert.equal(autorunCaseStudy({ pilot: startedAgo(12), metrics: { fixes: 2 }, existingDraft: { schema: "bogus" } }, { now: NOW }).changed, true, "a non-draft blob does not block a real draft");

// ── consent gate end-to-end: draft => not publishable => explicit consent + review => publishable ─────
assert.equal(publishableCaseStudy({ ready: true, missing: [], record: first.record }), null, "fresh draft is NOT publishable");
assert.equal(publishableCaseStudy({ ready: true, missing: [], record: null }), null, "no draft => nothing to publish");
const consented = withConsent({ ready: true, missing: [], record: first.record }, { granted: true, quote: "ARIA fixed it before we called anyone.", consentedAt: iso(NOW), draftReviewed: false });
assert.equal(publishableCaseStudy(consented), null, "consent WITHOUT draft review still does not publish");
const reviewed = withConsent({ ready: true, missing: [], record: first.record }, { granted: true, consentedAt: iso(NOW), draftReviewed: true });
assert.ok(publishableCaseStudy(reviewed), "explicit consent + reviewed draft => publishable (Ahmad's one-click, never auto)");
assert.equal(first.record.consent.granted, false, "pure: consenting a copy never mutates the original draft");

// ── e2e on a REAL matured-pilot audit-log fixture — the exact signals main.mjs feeds the autorun ──────
// transparencyLog is newest-first, mixed tags; fixes = RUN entries only. Outcomes drive the B1 deflection.
const auditLog = [
  { ts: iso(NOW - 1 * DAY), tag: "PILOT", text: "noise" },
  { ts: iso(NOW - 2 * DAY), tag: "RUN", text: "Cleared stuck print queue" },
  { ts: iso(NOW - 5 * DAY), tag: "DIAGNOSE", text: "noise" },
  { ts: iso(NOW - 8 * DAY), tag: "RUN", text: "Reset VPN adapter" },
  { ts: iso(NOW - 11 * DAY), tag: "RUN", text: "Repaired Outlook profile" }
];
const fixes = auditLog.filter((e) => e.tag === "RUN").length;
const outcomes = [
  { id: "c1", outcome: "resolved", escalated: false, ts: iso(NOW - 8 * DAY) },
  { id: "c2", outcome: "resolved", escalated: false, ts: iso(NOW - 6 * DAY) },
  { id: "c3", outcome: "not_resolved", escalated: true, ts: iso(NOW - 3 * DAY) }
];
const metrics = pilotProofMetrics(outcomes, { fixes });
assert.equal(metrics.fixes, 3, "fixture: 3 real RUN fixes");
const e2e = autorunCaseStudy({ pilot: startedAgo(12), metrics }, { now: NOW });
assert.equal(e2e.changed, true, "matured pilot + real audit-log fixes => the system emits the draft");
assert.equal(e2e.record.metrics.fixes, 3);
assert.ok(e2e.record.metrics.deflection_pct == null || (e2e.record.metrics.deflection_pct >= 0 && e2e.record.metrics.deflection_pct <= 100), "deflection is real-or-empty, never invented");
assert.ok(e2e.record.metrics.hours_saved == null || e2e.record.metrics.hours_saved > 0, "ROI hours come from the audited model or stay empty");
assert.equal(e2e.record.days_on_aria, 12, "days-on-ARIA measured from the real start date");
const ask = conversionMoment({ pilot: startedAgo(12), metrics }, { now: NOW });
assert.equal(ask.show, true, "the SAME real inputs surface the /plans conversion moment");
assert.equal(ask.cta.path, "/plans");
assert.equal(ask.proof.fixes, 3, "the ask's proof is the same audited fix count");
// …and the same fixture one week earlier (day 5, immature) produces NEITHER the draft NOR the ask.
assert.equal(autorunCaseStudy({ pilot: startedAgo(5), metrics }, { now: NOW }).changed, false);
assert.equal(conversionMoment({ pilot: startedAgo(5), metrics }, { now: NOW }).show, false);

// ── wiring locks (grep main + preload + run-all — same style as the E1/D2 batteries) ──────────────────
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
assert.ok(main.includes("function maybeAutorunCaseStudy()"), "main wires the proof autorun");
assert.ok(main.includes('if (tag === "RUN") { try { maybeAutorunCaseStudy(); }'), "every real RUN fix re-checks the autorun at log time");
assert.ok(main.includes("try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — a pilot that matured between sessions"), "startup catch-up wired (maturity reached while closed)");
assert.ok(main.includes("try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — maturity arrives with TIME"), "live pending surface catches time-based maturity");
assert.ok(main.includes("function writeCaseStudyDraft(record)"), "single local draft writer (write-once file, like pilot.json)");
assert.ok(main.includes('pending.push({ text: caseStudyPendingText(csDraft), cta: "Review proof"'), "drafted proof lands on the pending surface as a REVIEW card");
assert.ok(main.includes("sentinel:case-study-consent"), "consent is an explicit IPC one-click, never inferred");
assert.ok(main.includes("sentinel:case-study-publishable"), "publishable stays null until consent + review");
assert.ok(main.includes("persisted: readCaseStudyDraft()"), "draft IPC also returns the persisted write-once record");
assert.ok(!main.includes("consent: { granted: true"), "nothing in main ever self-grants consent");
assert.ok(preload.includes("caseStudyConsent:"), "preload bridges the consent one-click");
assert.ok(preload.includes("caseStudyPublishable:"), "preload bridges the publishable gate");
const runAll = fs.readFileSync(path.join(root, "tests", "run-all.mjs"), "utf8");
assert.ok(runAll.includes("e2-proof-autorun.test.mjs"), "run-all registers the E2 battery");
assert.ok(runAll.indexOf("deploy-safety-denylist") < runAll.indexOf("e2-proof-autorun"), "registered AFTER the denylist gate");

console.log("e2-proof-autorun: all assertions passed (matured real pilot => honest draft + /plans moment; immature/zero-fix => nothing; write-once; consent-gated one-click publish).");
