// A1 EXIT CRITERIA — RULE 14 enforcement (real-or-empty). Re-applied 2026-06-30 on fresh branch off current main
// (the 2026-06-29 branch became un-mergeable: base Jun-24, +101 commits, would delete 101 live files).
// Asserts: with NO real data, every DERIVED/vanity metric renders empty-state "--", NEVER a fabricated
// number (100% uptime, 100 calibration, $ from a made-up multiplier, hours from *0.4). True counts
// (breaches, anomalies, incidents) may still show 0. AND: real data still renders real (no over-masking).
import assert from "node:assert/strict";
import { operationalTilesHtml, aiTilesHtml } from "../src/renderer/tabs/performance.mjs";
import { heroTiles } from "../src/shared/dashboard-status.mjs";
import { tilesHtml } from "../src/renderer/tabs/dashboard.mjs";
import { emailBody } from "../src/shared/quarterly-email.mjs";
import { previewText } from "../src/renderer/tabs/reports.mjs";
import { executiveSummary } from "../src/main/report-generator.mjs";
import { uptimeTilesHtml, severityRowsHtml } from "../src/renderer/tabs/sla.mjs";

const hasEmpty = (s) => s.includes("--");

// 1. Operational tiles: null rate/time metrics -> "--", not "0%"/"0"
const opHtml = operationalTilesHtml({});
assert.ok(hasEmpty(opHtml),          "operational tiles must show -- for null metrics");
assert.ok(!opHtml.includes(">0%<"),  "operational tiles must not show 0% for null rate metrics");

// 2. AI tiles: null accuracy/calibration/cost/hours -> "--"; no fabricated 100 or $0
const aiHtml = aiTilesHtml({});
assert.ok(hasEmpty(aiHtml),          "AI tiles must show -- for null metrics");
assert.ok(!aiHtml.includes(">100<"), "calibration must not fabricate 100 with no data");
assert.ok(!aiHtml.includes("/100<") || aiHtml.includes("--"), "calibration null must be -- not N/100");
assert.ok(!aiHtml.includes("$0<"),   "cost saved must be -- not $0 when null");
assert.ok(!aiHtml.includes(">0%<"),  "AI rate tiles must not show 0% for null");

// 3. Overview hero tiles: uptime must NOT fabricate 100%
const heroHtml = tilesHtml(heroTiles({}));
assert.ok(hasEmpty(heroHtml),           "hero tiles must show -- for null uptime/mttr/accuracy/hours");
assert.ok(!heroHtml.includes("100%"),   "uptime must not fabricate 100% with no data (was ?? 100)");

// 4. Quarterly email: no ?? 100 uptime; null -> "--"; no fake savings sentence
const email = emailBody({ kpis: {}, company: "Acme", quarter: "2026-Q2" });
assert.ok(!email.includes("100%"),          "email must not fabricate 100% uptime");
assert.ok(hasEmpty(email),                  "email tiles must show -- for null kpis");
assert.ok(!email.includes("saving ~<b>0</b>"), "email must not claim saving ~0 hours");
assert.ok(!email.includes("<b>0%</b> automatically"), "email must not claim 0% automatically");

// 5. Reports preview: null derived -> "--"
const preview = previewText({});
assert.ok(!preview.includes("avoided: 0"),    "preview must not show avoided: 0 for null hoursSaved");
assert.ok(!preview.includes("accuracy: 0%"),  "preview must not show accuracy: 0% for null accuracy");
assert.ok(hasEmpty(preview),                  "preview must show -- for null metrics");

// 6. Report generator exec summary: no fake savings/rates
const summary = executiveSummary({});
assert.ok(!summary[0].includes("saving ~0 hours"),   "exec summary must not say saving ~0 hours");
assert.ok(!summary[0].includes("0% automatically"),  "exec summary must not say 0% automatically");
assert.ok(!summary[1].includes("0% against"),        "exec summary must not say 0% against for null SLA");
assert.ok(summary[1].includes("--"),                 "exec summary SLA line must use -- for null composite/floor");

// 6b. SLA tab: uptime + severity must not fabricate 100% with no data
const slaUp = uptimeTilesHtml({});
assert.ok(!slaUp.includes("100%"), "SLA uptime tiles must not fabricate 100% with no data");
assert.ok(slaUp.includes("--"),    "SLA uptime tiles must show -- for no data");
const slaSev = severityRowsHtml({});
assert.ok(!slaSev.includes("100% met"), "SLA severity must not fabricate 100% met with no data");
assert.ok(slaSev.includes("--"),        "SLA severity must show -- for no data");

// 7. REAL DATA STILL RENDERS REAL (no over-masking — real-or-empty, not empty-always)
const aiReal = aiTilesHtml({ calibration: 87, costSaved: 1200, hoursSaved: 33 });
assert.ok(aiReal.includes("87"),   "real calibration must render");
assert.ok(aiReal.includes("1200"), "real cost saved must render");
const emailReal = emailBody({ kpis: { uptime7d: 99.9, hoursSaved: 33 } });
assert.ok(emailReal.includes("99.9%"), "real uptime must render as 99.9%");
assert.ok(uptimeTilesHtml({ d7: 99.95 }).includes("99.95"), "real SLA uptime must render");

console.log("a1-empty-state-no-fabrication test passed (7 groups · null derived metrics render -- · no fabricated 100/$0/multiplier · real data still real · Rule 14).");
