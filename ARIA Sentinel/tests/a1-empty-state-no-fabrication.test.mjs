// A1 EXIT CRITERIA -- RULE 14 enforcement test.
// Asserts: with no real incident data, every DERIVED metric shows an empty-state marker "--",
// NEVER a fabricated number (0 for null, 100 for uncalibrated, derived multiplier).
// Counts that legitimately start at 0 (anomalies, breaches, incidents) are allowed to show 0.
import assert from "node:assert/strict";
import { operationalTilesHtml, aiTilesHtml } from "../src/renderer/tabs/performance.mjs";
import { emailBody } from "../src/shared/quarterly-email.mjs";
import { previewText } from "../src/renderer/tabs/reports.mjs";
import { executiveSummary } from "../src/main/report-generator.mjs";

// "--" is used by performance.mjs; em-dash by email/reports/report-gen
const hasEmpty = (s) => s.includes("--") || s.includes("—");

// 1. Performance tab: null rate/pct/savings tiles must show "--", not "0" or "100"
const opHtml = operationalTilesHtml({});
assert.ok(hasEmpty(opHtml),               "operational tiles must show empty-state for null metrics");
// MTTD, MTTR, FTR, autoPct, recipeSuccess all null -> "--"
assert.ok(!opHtml.includes(">0%<"),       "operational tiles must not show >0%< for null rate metrics");
assert.ok(!opHtml.includes(">0 <"),       "operational tiles must not show >0 < for null time metrics");

const aiHtml = aiTilesHtml({});
assert.ok(hasEmpty(aiHtml),               "AI tiles must show empty-state for null metrics");
// accuracy, calibration, confirmRate, kbHitRate, top3, hoursSaved, costSaved all null -> "--"
assert.ok(!aiHtml.includes(">0%<"),       "AI tiles must not show >0%< for null rate metrics");
assert.ok(!aiHtml.includes(">100<"),      "AI tiles must not show >100< for null calibration");
assert.ok(!aiHtml.includes(">$0<"),       "AI tiles must not show >$0< for null costSaved");
assert.ok(!aiHtml.includes(">0/100<"),    "AI tiles must not show >0/100< for null calibration");
// hoursSaved null must show "--"
assert.ok(aiHtml.includes('data-kpi="hours"'), "hours tile must exist");
const hoursBlock = aiHtml.slice(aiHtml.indexOf('data-kpi="hours"'), aiHtml.indexOf('data-kpi="hours"') + 200);
assert.ok(hoursBlock.includes("--"),      "hours saved tile must show -- for null hoursSaved");
// costSaved null must show "--"
const costBlock = aiHtml.slice(aiHtml.indexOf('data-kpi="cost"'), aiHtml.indexOf('data-kpi="cost"') + 200);
assert.ok(costBlock.includes("--"),       "cost saved tile must show -- for null costSaved");

// 2. Quarterly email: uptime7d must NOT fall back to 100; null metrics -> "--"
const email = emailBody({ kpis: {}, company: "Acme", quarter: "2026-Q2" });
assert.ok(!email.includes(">100%<"),      "email must not show 100% uptime when uptime7d is null (was ?? 100 bug)");
assert.ok(email.includes("--"),           "email tiles must show -- for null kpis");
assert.ok(!email.includes("saving ~0"),   "email must not claim saving ~0 hours");
assert.ok(!email.includes("0% automatically"), "email must not claim 0% automatically");

// 3. Reports previewText: null derived metrics -> "--"
const preview = previewText({});
assert.ok(!preview.includes("avoided: 0"), "preview must not show 'avoided: 0' for null hoursSaved");
assert.ok(!preview.includes("accuracy: 0%"), "preview must not show 'accuracy: 0%' for null accuracy");
assert.ok(preview.includes("--"),            "preview must show -- for null metrics");

// 4. Report generator executiveSummary: no fake savings or rates in narrative
const summary = executiveSummary({});
assert.ok(!summary[0].includes("saving ~0"),       "exec summary must not say saving ~0 hours");
assert.ok(!summary[0].includes("0% automatically"), "exec summary must not say 0% automatically");
assert.ok(!summary[1].includes("0% against"),       "exec summary must not say 0% against for null SLA");
assert.ok(summary[1].includes("--"),                "exec summary SLA line must use -- for null composite/floor");

console.log("A1 empty-state test PASSED: no fabricated metrics; all null derived values render as -- (Rule 14 enforced).");
