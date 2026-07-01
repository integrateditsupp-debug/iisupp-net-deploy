// RUN-D D2 wiring — the pilot->paid capture engine plumbed into the app: conversion moment fed by REAL
// audit-log fixes, surfaced on the SAME pilot-expiry pending surface, exposed over IPC + preload; the
// case-study draft stays staged + consent-gated. Rule 14: real-or-empty — no premature or hollow ask, ever.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { conversionMoment, buildCaseStudy, caseStudyReadiness, PILOT_CHECKOUT_PATH } from "../src/shared/case-study.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-01T00:00:00.000Z");
const startedAgo = (d) => ({ org: "Acme Dental", size: "11-50", pains: ["vpn"], started_at: new Date(NOW - d * DAY).toISOString() });

// ── Real-or-empty: a MATURED pilot with NO real fix makes no hollow ask ─────────────────────────────
assert.equal(conversionMoment({ pilot: startedAgo(12), metrics: { fixes: 0 } }, { now: NOW }).show, false);
assert.equal(conversionMoment({ pilot: startedAgo(12), metrics: {} }, { now: NOW }).reason, "no-real-proof");

// ── Never a premature ask: an IMMATURE pilot (day 2) does not fire even with real fixes ─────────────
const early = conversionMoment({ pilot: startedAgo(2), metrics: { fixes: 5 } }, { now: NOW });
assert.equal(early.show, false);
assert.equal(early.reason, "pilot-not-matured");

// ── The moment: matured (day 12 => expiring) + real proof => fires, NON-blocking, points at the funnel ─
const m = conversionMoment({ pilot: startedAgo(12), metrics: { fixes: 3 } }, { now: NOW });
assert.equal(m.show, true);
assert.equal(m.stage, "expiring");
assert.equal(m.non_blocking, true, "the ask NEVER blocks — free Manual always remains");
assert.equal(m.proof.fixes, 3, "proof is the real fix count");
assert.equal(m.cta.path, "/plans");
assert.equal(m.cta.path, PILOT_CHECKOUT_PATH, "CTA uses the funnel PAGE, never a fabricated checkout URL");

// ── Expired + proof still fires the "keep ARIA" ask (post-expiry, free tier remains) ────────────────
const e = conversionMoment({ pilot: startedAgo(20), metrics: { fixes: 1 } }, { now: NOW });
assert.equal(e.show, true);
assert.equal(e.stage, "expired");
assert.match(e.cta.label, /keep aria/i);

// ── Case-study readiness/build are real-or-empty (no intake / no fix / not matured => not ready) ─────
assert.equal(caseStudyReadiness({}, { now: NOW }).ready, false);
assert.ok(caseStudyReadiness({}, { now: NOW }).missing.includes("pilot-intake"));
assert.ok(caseStudyReadiness({ pilot: startedAgo(12), metrics: { fixes: 0 } }, { now: NOW }).missing.includes("resolved-fixes"));
assert.ok(caseStudyReadiness({ pilot: startedAgo(2), metrics: { fixes: 2 } }, { now: NOW }).missing.includes("pilot-matured"));
assert.equal(caseStudyReadiness({ pilot: startedAgo(12), metrics: { fixes: 2 } }, { now: NOW }).ready, true);
assert.equal(buildCaseStudy({ pilot: startedAgo(2), metrics: { fixes: 0 } }, { now: NOW }).ready, false);
const built = buildCaseStudy({ pilot: startedAgo(12), metrics: { fixes: 2 } }, { now: NOW });
assert.equal(built.ready, true);
assert.equal(built.record.quote, null, "a quote is NEVER fabricated");
assert.equal(built.record.consent.granted, false, "publish stays consent-gated (Ahmad one-click), never auto");

// ── Wiring proof: conversion moment is actually plumbed into main + preload + the pilot-expiry surface ─
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
const runAll = fs.readFileSync(path.join(root, "tests", "run-all.mjs"), "utf8");
assert.match(main, /from "\.\.\/shared\/case-study\.mjs"/, "main imports case-study");
assert.match(main, /function conversionMomentNow\(/, "main defines conversionMomentNow");
assert.match(main, /transparencyLog[\s\S]{0,80}tag === "RUN"/, "conversion is fed by REAL audit-log RUN fixes (not a fabricated number)");
assert.match(main, /sentinel:conversion-moment/, "main exposes the conversion-moment IPC");
assert.match(main, /sentinel:case-study-draft/, "main exposes the case-study-draft IPC");
assert.match(main, /conversion:\s*conversionMomentNow\(\)/, "gateStatus surfaces the conversion block");
assert.match(main, /if \(conv && conv\.show\) pending\.push/, "conversion is surfaced on the pilot-expiry pending UI");
assert.match(preload, /conversionMoment:/, "preload bridges conversionMoment");
assert.match(preload, /sentinel:conversion-moment/, "preload wires the conversion-moment channel");
assert.match(preload, /caseStudyDraft:/, "preload bridges caseStudyDraft");
assert.match(runAll, /d2-wire-conversion\.test\.mjs/, "run-all registers the D2 wiring test");

console.log("D2 wiring test passed (real-or-empty: immature/no-proof => no ask; matured+real fixes => non-blocking /plans moment; case-study staged+consent-gated; main IPC + preload + pilot-expiry pending surface wired).");
