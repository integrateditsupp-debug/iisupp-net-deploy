// RUN-D D2 - pilot-to-paid capture: case study stays consent-gated; conversion moment is proof-based.
import assert from "node:assert/strict";
import { conversionMoment, buildCaseStudy, caseStudyReadiness } from "../src/shared/case-study.mjs";

const started = "2026-06-20T00:00:00.000Z";
const now = Date.parse("2026-07-04T00:00:00.000Z");
const metrics = { fixes: 3, resolved: 2, hours_saved: 2.4, deflectionPct: 66.7 };

let conv = conversionMoment({ pilot: { started_at: started }, metrics: {}, now });
assert.equal(conv.show, false, "no proof means no conversion ask");
conv = conversionMoment({ pilot: { started_at: started }, metrics, now });
assert.equal(conv.show, true);
assert.equal(conv.cta.label, "Review pilot proof");

assert.equal(caseStudyReadiness({ pilot: { started_at: started }, metrics }).ready, false, "case study requires consent");
const draft = buildCaseStudy({ pilot: { started_at: started, case_study_consent: true }, metrics, vertical: "legal" });
assert.equal(draft.ready, true);
assert.equal(draft.publishable, false, "draft is staged, never auto-published");
assert.equal(draft.consent, true);
assert.equal(draft.proof.fixes, 3);

console.log("D2 case-study test passed (proof-based conversion, consent-gated draft, no auto-publish).");
